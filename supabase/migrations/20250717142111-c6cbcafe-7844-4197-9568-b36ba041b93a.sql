-- Create demand planning optimization function
CREATE OR REPLACE FUNCTION public.optimize_inventory_levels(
  p_category_id UUID DEFAULT NULL,
  p_service_level NUMERIC DEFAULT 0.95
)
RETURNS TABLE(
  item_code TEXT,
  item_name TEXT,
  current_stock NUMERIC,
  recommended_reorder_point NUMERIC,
  recommended_max_stock NUMERIC,
  economic_order_quantity NUMERIC,
  total_cost_reduction NUMERIC,
  implementation_priority TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  z_score NUMERIC := 1.96; -- 95% service level
BEGIN
  -- Adjust z_score based on service level
  z_score := CASE 
    WHEN p_service_level >= 0.99 THEN 2.58
    WHEN p_service_level >= 0.95 THEN 1.96
    WHEN p_service_level >= 0.90 THEN 1.65
    ELSE 1.28
  END;
  
  RETURN QUERY
  WITH inventory_analysis AS (
    SELECT 
      s.item_code,
      im.item_name,
      s.current_qty,
      cp.avg_monthly_consumption,
      cp.consumption_stddev,
      COALESCE(im.unit_cost, 0) as unit_cost,
      sm.turnover_ratio_90d,
      -- Calculate lead time (assumed 1 month for simplicity)
      1 as lead_time_months,
      -- Calculate safety stock
      z_score * cp.consumption_stddev * SQRT(1) as safety_stock,
      -- Calculate reorder point
      (cp.avg_monthly_consumption * 1) + (z_score * cp.consumption_stddev * SQRT(1)) as new_reorder_point,
      -- Calculate economic order quantity (simplified Wilson formula)
      SQRT((2 * cp.avg_monthly_consumption * 12 * 100) / NULLIF(im.unit_cost * 0.2, 0)) as eoq,
      -- Current costs vs optimized costs
      s.current_qty * im.unit_cost as current_holding_cost
    FROM public.satguru_stock s
    JOIN public.satguru_item_master im ON s.item_code = im.item_code
    JOIN public.satguru_analytics_consumption_patterns cp ON s.item_code = cp.item_code
    JOIN public.satguru_analytics_stock_metrics sm ON s.item_code = sm.item_code
    WHERE (p_category_id IS NULL OR im.category_id = p_category_id)
    AND cp.avg_monthly_consumption > 0
  )
  SELECT 
    ia.item_code,
    ia.item_name,
    ia.current_qty,
    CEIL(ia.new_reorder_point) as recommended_reorder_point,
    CEIL(ia.new_reorder_point + ia.eoq) as recommended_max_stock,
    CEIL(ia.eoq) as economic_order_quantity,
    -- Calculate potential cost savings
    GREATEST(0, ia.current_holding_cost - ((ia.new_reorder_point + ia.eoq/2) * ia.unit_cost)) as total_cost_reduction,
    -- Priority based on potential savings and turnover
    CASE 
      WHEN ia.turnover_ratio_90d > 2 AND ia.current_holding_cost > 10000 THEN 'HIGH'
      WHEN ia.turnover_ratio_90d > 1 OR ia.current_holding_cost > 5000 THEN 'MEDIUM'
      ELSE 'LOW'
    END as implementation_priority
  FROM inventory_analysis ia
  WHERE ia.avg_monthly_consumption > 0
  ORDER BY total_cost_reduction DESC;
END;
$$;