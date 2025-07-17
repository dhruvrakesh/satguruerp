-- First add unit_cost column to item_master table if it doesn't exist
ALTER TABLE public.satguru_item_master 
ADD COLUMN IF NOT EXISTS unit_cost NUMERIC DEFAULT 0;

-- Create materialized views for analytics performance optimization (CORRECTED VERSION)
DROP MATERIALIZED VIEW IF EXISTS public.satguru_analytics_stock_metrics;
CREATE MATERIALIZED VIEW public.satguru_analytics_stock_metrics AS
SELECT 
  s.item_code,
  s.current_qty,
  im.item_name,
  COALESCE(im.unit_cost, 0) as unit_cost,
  c.category_name,
  s.current_qty * COALESCE(im.unit_cost, 0) as total_value,
  CASE 
    WHEN s.current_qty <= 0 THEN 'out_of_stock'
    WHEN s.current_qty <= COALESCE(s.reorder_level, 10) THEN 'low_stock'
    WHEN s.current_qty >= COALESCE(s.max_stock_level, 1000) THEN 'overstock'
    ELSE 'normal'
  END as stock_status,
  -- Calculate ABC classification based on value
  CASE
    WHEN s.current_qty * COALESCE(im.unit_cost, 0) >= (
      SELECT PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY current_qty * COALESCE(unit_cost, 0))
      FROM public.satguru_stock st 
      JOIN public.satguru_item_master itm ON st.item_code = itm.item_code
    ) THEN 'A'
    WHEN s.current_qty * COALESCE(im.unit_cost, 0) >= (
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY current_qty * COALESCE(unit_cost, 0))
      FROM public.satguru_stock st 
      JOIN public.satguru_item_master itm ON st.item_code = itm.item_code
    ) THEN 'B'
    ELSE 'C'
  END as abc_class,
  -- Last transaction date
  GREATEST(
    COALESCE((SELECT MAX(grn_date) FROM public.satguru_grn_log WHERE item_code = s.item_code), '1900-01-01'),
    COALESCE((SELECT MAX(issue_date) FROM public.satguru_issue_log WHERE item_code = s.item_code), '1900-01-01')
  ) as last_transaction_date,
  -- Days since last transaction
  EXTRACT(DAYS FROM (CURRENT_DATE - GREATEST(
    COALESCE((SELECT MAX(grn_date) FROM public.satguru_grn_log WHERE item_code = s.item_code), '1900-01-01'),
    COALESCE((SELECT MAX(issue_date) FROM public.satguru_issue_log WHERE item_code = s.item_code), '1900-01-01')
  ))) as days_since_last_transaction,
  -- Inventory turnover ratio (consumption in last 90 days / average stock)
  CASE 
    WHEN s.current_qty > 0 THEN
      COALESCE((
        SELECT SUM(qty_issued) 
        FROM public.satguru_issue_log 
        WHERE item_code = s.item_code 
        AND issue_date >= CURRENT_DATE - INTERVAL '90 days'
      ), 0) / NULLIF(s.current_qty, 0)
    ELSE 0
  END as turnover_ratio_90d,
  -- Monthly consumption average
  COALESCE((
    SELECT AVG(monthly_consumption) 
    FROM (
      SELECT 
        DATE_TRUNC('month', issue_date) as month,
        SUM(qty_issued) as monthly_consumption
      FROM public.satguru_issue_log 
      WHERE item_code = s.item_code 
      AND issue_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', issue_date)
    ) monthly_data
  ), 0) as avg_monthly_consumption,
  CURRENT_TIMESTAMP as last_refreshed
FROM public.satguru_stock s
JOIN public.satguru_item_master im ON s.item_code = im.item_code
LEFT JOIN public.categories c ON im.category_id = c.id
WHERE s.current_qty > 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_analytics_stock_metrics_item_code ON public.satguru_analytics_stock_metrics(item_code);
CREATE INDEX IF NOT EXISTS idx_analytics_stock_metrics_category ON public.satguru_analytics_stock_metrics(category_name);
CREATE INDEX IF NOT EXISTS idx_analytics_stock_metrics_abc_class ON public.satguru_analytics_stock_metrics(abc_class);
CREATE INDEX IF NOT EXISTS idx_analytics_stock_metrics_stock_status ON public.satguru_analytics_stock_metrics(stock_status);
CREATE INDEX IF NOT EXISTS idx_analytics_stock_metrics_total_value ON public.satguru_analytics_stock_metrics(total_value);