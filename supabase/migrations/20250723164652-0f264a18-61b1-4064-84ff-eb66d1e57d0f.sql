-- Fix pricing hierarchy to respect legacy data boundaries and implement correct pricing order

-- First, create a robust pricing hierarchy function that respects the intended logic:
-- 1. Primary: item_pricing_master (user-curated)
-- 2. Guidance: Recent operational GRN averages (post cutoff date, FRONTEND_ENTRY only)
-- 3. Fallback: satguru_item_master.unit_cost

CREATE OR REPLACE FUNCTION public.get_item_pricing_hierarchy(
  p_item_code TEXT,
  p_valuation_method TEXT DEFAULT 'WEIGHTED_AVG',
  p_days_lookback INTEGER DEFAULT 90
)
RETURNS TABLE(
  item_code TEXT,
  pricing_source TEXT,
  unit_cost NUMERIC,
  confidence_score NUMERIC,
  last_updated DATE,
  pricing_details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pricing_master_cost NUMERIC;
  v_operational_grn_cost NUMERIC;
  v_fallback_cost NUMERIC;
  v_operational_cutoff DATE;
  v_lookback_date DATE;
BEGIN
  -- Get operational cutoff date
  SELECT public.get_operational_cutoff_date() INTO v_operational_cutoff;
  v_lookback_date := CURRENT_DATE - INTERVAL '1 day' * p_days_lookback;
  
  -- Priority 1: Check item_pricing_master (user-curated pricing)
  SELECT current_price INTO v_pricing_master_cost
  FROM public.item_pricing_master
  WHERE item_pricing_master.item_code = p_item_code
    AND is_active = true
    AND approval_status = 'APPROVED'
  ORDER BY updated_at DESC
  LIMIT 1;
  
  IF v_pricing_master_cost IS NOT NULL AND v_pricing_master_cost > 0 THEN
    RETURN QUERY
    SELECT 
      p_item_code,
      'PRICING_MASTER'::TEXT,
      v_pricing_master_cost,
      1.0::NUMERIC,
      CURRENT_DATE,
      jsonb_build_object(
        'source', 'item_pricing_master',
        'method', 'user_curated',
        'confidence', 'high'
      );
    RETURN;
  END IF;
  
  -- Priority 2: Use operational GRN data for real-time pricing (clean data only)
  IF p_valuation_method = 'FIFO' THEN
    SELECT g.amount_inr / NULLIF(g.qty_received, 0) INTO v_operational_grn_cost
    FROM satguru_grn_log g
    WHERE g.item_code = p_item_code 
      AND g.qty_received > 0
      AND g.amount_inr > 0
      AND g.data_source = 'FRONTEND_ENTRY'  -- Only operational data
      AND g.date >= v_operational_cutoff    -- Post cutoff date
      AND g.date >= v_lookback_date         -- Within lookback period
    ORDER BY g.date ASC
    LIMIT 1;
  ELSIF p_valuation_method = 'LIFO' THEN
    SELECT g.amount_inr / NULLIF(g.qty_received, 0) INTO v_operational_grn_cost
    FROM satguru_grn_log g
    WHERE g.item_code = p_item_code 
      AND g.qty_received > 0
      AND g.amount_inr > 0
      AND g.data_source = 'FRONTEND_ENTRY'  -- Only operational data
      AND g.date >= v_operational_cutoff    -- Post cutoff date
      AND g.date >= v_lookback_date         -- Within lookback period
    ORDER BY g.date DESC
    LIMIT 1;
  ELSE -- WEIGHTED_AVG
    SELECT SUM(g.amount_inr) / NULLIF(SUM(g.qty_received), 0) INTO v_operational_grn_cost
    FROM satguru_grn_log g
    WHERE g.item_code = p_item_code 
      AND g.qty_received > 0
      AND g.amount_inr > 0
      AND g.data_source = 'FRONTEND_ENTRY'  -- Only operational data
      AND g.date >= v_operational_cutoff    -- Post cutoff date
      AND g.date >= v_lookback_date;        -- Within lookback period
  END IF;
  
  IF v_operational_grn_cost IS NOT NULL AND v_operational_grn_cost > 0 THEN
    RETURN QUERY
    SELECT 
      p_item_code,
      'OPERATIONAL_GRN'::TEXT,
      v_operational_grn_cost,
      0.8::NUMERIC,
      CURRENT_DATE,
      jsonb_build_object(
        'source', 'operational_grn',
        'method', p_valuation_method,
        'confidence', 'medium',
        'days_lookback', p_days_lookback,
        'cutoff_date', v_operational_cutoff
      );
    RETURN;
  END IF;
  
  -- Priority 3: Fallback to item master unit cost
  SELECT unit_cost INTO v_fallback_cost
  FROM public.satguru_item_master
  WHERE satguru_item_master.item_code = p_item_code;
  
  IF v_fallback_cost IS NOT NULL AND v_fallback_cost > 0 THEN
    RETURN QUERY
    SELECT 
      p_item_code,
      'ITEM_MASTER_FALLBACK'::TEXT,
      v_fallback_cost,
      0.3::NUMERIC,
      CURRENT_DATE,
      jsonb_build_object(
        'source', 'item_master',
        'method', 'fallback',
        'confidence', 'low'
      );
    RETURN;
  END IF;
  
  -- No pricing found - return zero cost with warning
  RETURN QUERY
  SELECT 
    p_item_code,
    'NO_PRICING_DATA'::TEXT,
    0::NUMERIC,
    0::NUMERIC,
    CURRENT_DATE,
    jsonb_build_object(
      'source', 'none',
      'method', 'default',
      'confidence', 'none',
      'warning', 'No pricing data found for item'
    );
END;
$$;

-- Update calculate_stock_valuation to use the new pricing hierarchy
CREATE OR REPLACE FUNCTION public.calculate_stock_valuation(
  p_item_code TEXT DEFAULT NULL,
  p_valuation_method TEXT DEFAULT 'WEIGHTED_AVG',
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  item_code TEXT,
  item_name TEXT,
  category_name TEXT,
  current_qty NUMERIC,
  unit_cost NUMERIC,
  total_value NUMERIC,
  valuation_method TEXT,
  last_transaction_date DATE,
  cost_layers JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH stock_data AS (
    SELECT 
      s.item_code,
      s.item_name,
      s.category_name,
      s.current_qty,
      p.unit_cost as calculated_unit_cost,
      p.pricing_source,
      p.confidence_score,
      p.pricing_details,
      p_valuation_method as method,
      (
        SELECT MAX(g.date)
        FROM satguru_grn_log g
        WHERE g.item_code = s.item_code
          AND g.data_source = 'FRONTEND_ENTRY'  -- Only operational data for transaction dates
          AND g.date >= public.get_operational_cutoff_date()
      ) as last_operational_transaction_date
    FROM satguru_stock_summary_view s
    CROSS JOIN LATERAL public.get_item_pricing_hierarchy(
      s.item_code, 
      p_valuation_method,
      90  -- 90 day lookback for operational GRN pricing
    ) p
    WHERE (p_item_code IS NULL OR s.item_code = p_item_code)
    AND s.current_qty > 0
  )
  SELECT 
    sd.item_code,
    sd.item_name,
    sd.category_name,
    sd.current_qty,
    sd.calculated_unit_cost,
    sd.current_qty * sd.calculated_unit_cost as total_value,
    sd.method,
    sd.last_operational_transaction_date,
    jsonb_build_object(
      'method', sd.method,
      'calculation_date', CURRENT_DATE,
      'pricing_source', sd.pricing_source,
      'confidence_score', sd.confidence_score,
      'pricing_details', sd.pricing_details,
      'respects_legacy_boundary', true,
      'operational_cutoff_date', public.get_operational_cutoff_date()
    ) as cost_layers
  FROM stock_data sd
  ORDER BY (sd.current_qty * sd.calculated_unit_cost) DESC;
END;
$$;

-- Create function to get GRN-derived price suggestions for updating pricing master
CREATE OR REPLACE FUNCTION public.get_grn_price_suggestions(
  p_item_code TEXT DEFAULT NULL,
  p_days_lookback INTEGER DEFAULT 30,
  p_min_transactions INTEGER DEFAULT 3
)
RETURNS TABLE(
  item_code TEXT,
  item_name TEXT,
  suggested_price NUMERIC,
  transaction_count INTEGER,
  price_variance NUMERIC,
  min_price NUMERIC,
  max_price NUMERIC,
  last_grn_date DATE,
  confidence_level TEXT,
  recommendation JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_operational_cutoff DATE;
  v_lookback_date DATE;
BEGIN
  SELECT public.get_operational_cutoff_date() INTO v_operational_cutoff;
  v_lookback_date := CURRENT_DATE - INTERVAL '1 day' * p_days_lookback;
  
  RETURN QUERY
  WITH grn_prices AS (
    SELECT 
      g.item_code,
      g.amount_inr / NULLIF(g.qty_received, 0) as unit_price,
      g.date as grn_date,
      g.qty_received
    FROM satguru_grn_log g
    WHERE g.qty_received > 0
      AND g.amount_inr > 0
      AND g.data_source = 'FRONTEND_ENTRY'  -- Only clean operational data
      AND g.date >= v_operational_cutoff    -- Post cutoff date
      AND g.date >= v_lookback_date         -- Within lookback period
      AND (p_item_code IS NULL OR g.item_code = p_item_code)
  ),
  price_stats AS (
    SELECT 
      gp.item_code,
      im.item_name,
      SUM(gp.unit_price * gp.qty_received) / NULLIF(SUM(gp.qty_received), 0) as weighted_avg_price,
      COUNT(*) as transaction_count,
      STDDEV(gp.unit_price) as price_std_dev,
      MIN(gp.unit_price) as min_price,
      MAX(gp.unit_price) as max_price,
      MAX(gp.grn_date) as last_grn_date
    FROM grn_prices gp
    JOIN satguru_item_master im ON gp.item_code = im.item_code
    GROUP BY gp.item_code, im.item_name
    HAVING COUNT(*) >= p_min_transactions
  )
  SELECT 
    ps.item_code,
    ps.item_name,
    ps.weighted_avg_price as suggested_price,
    ps.transaction_count,
    COALESCE(ps.price_std_dev, 0) as price_variance,
    ps.min_price,
    ps.max_price,
    ps.last_grn_date,
    CASE 
      WHEN ps.transaction_count >= 10 AND COALESCE(ps.price_std_dev, 0) / ps.weighted_avg_price <= 0.1 THEN 'HIGH'
      WHEN ps.transaction_count >= 5 AND COALESCE(ps.price_std_dev, 0) / ps.weighted_avg_price <= 0.2 THEN 'MEDIUM'
      ELSE 'LOW'
    END as confidence_level,
    jsonb_build_object(
      'data_source', 'operational_grn_only',
      'cutoff_date', v_operational_cutoff,
      'lookback_days', p_days_lookback,
      'min_transactions_required', p_min_transactions,
      'coefficient_of_variation', CASE 
        WHEN ps.weighted_avg_price > 0 THEN COALESCE(ps.price_std_dev, 0) / ps.weighted_avg_price 
        ELSE NULL 
      END,
      'clean_data_only', true
    ) as recommendation
  FROM price_stats ps
  ORDER BY ps.transaction_count DESC, ps.weighted_avg_price DESC;
END;
$$;

-- Create function to analyze pricing hierarchy usage
CREATE OR REPLACE FUNCTION public.analyze_pricing_hierarchy_usage()
RETURNS TABLE(
  pricing_source TEXT,
  item_count INTEGER,
  percentage NUMERIC,
  avg_confidence NUMERIC,
  total_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH pricing_breakdown AS (
    SELECT 
      p.pricing_source,
      COUNT(*) as item_count,
      AVG(p.confidence_score) as avg_confidence,
      SUM(s.current_qty * p.unit_cost) as total_value
    FROM satguru_stock_summary_view s
    CROSS JOIN LATERAL public.get_item_pricing_hierarchy(s.item_code, 'WEIGHTED_AVG') p
    WHERE s.current_qty > 0
    GROUP BY p.pricing_source
  ),
  totals AS (
    SELECT SUM(item_count) as total_items FROM pricing_breakdown
  )
  SELECT 
    pb.pricing_source,
    pb.item_count,
    ROUND((pb.item_count::NUMERIC / t.total_items::NUMERIC) * 100, 2) as percentage,
    ROUND(pb.avg_confidence, 3) as avg_confidence,
    ROUND(pb.total_value, 2) as total_value
  FROM pricing_breakdown pb
  CROSS JOIN totals t
  ORDER BY pb.item_count DESC;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION public.get_item_pricing_hierarchy IS 'Implements correct pricing hierarchy: 1) pricing_master (primary), 2) operational GRN (guidance), 3) item_master (fallback). Respects legacy data boundaries.';
COMMENT ON FUNCTION public.calculate_stock_valuation IS 'Updated to use pricing hierarchy and only clean operational GRN data. Eliminates legacy data contamination.';
COMMENT ON FUNCTION public.get_grn_price_suggestions IS 'Provides GRN-derived price suggestions for updating pricing master using only clean operational data.';
COMMENT ON FUNCTION public.analyze_pricing_hierarchy_usage IS 'Analyzes which pricing sources are being used across the inventory.';