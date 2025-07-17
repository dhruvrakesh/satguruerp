-- Create materialized views for analytics performance optimization
CREATE MATERIALIZED VIEW IF NOT EXISTS public.satguru_analytics_stock_metrics AS
SELECT 
  s.item_code,
  s.current_qty,
  im.item_name,
  im.unit_cost,
  c.category_name,
  s.current_qty * COALESCE(im.unit_cost, 0) as total_value,
  CASE 
    WHEN s.current_qty <= 0 THEN 'out_of_stock'
    WHEN s.current_qty <= COALESCE(im.reorder_level, 10) THEN 'low_stock'
    WHEN s.current_qty >= COALESCE(im.max_stock_level, 1000) THEN 'overstock'
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

-- Create consumption pattern analysis materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS public.satguru_analytics_consumption_patterns AS
WITH monthly_consumption AS (
  SELECT 
    item_code,
    DATE_TRUNC('month', issue_date) as month,
    SUM(qty_issued) as monthly_qty,
    COUNT(*) as transaction_count
  FROM public.satguru_issue_log
  WHERE issue_date >= CURRENT_DATE - INTERVAL '24 months'
  GROUP BY item_code, DATE_TRUNC('month', issue_date)
),
item_stats AS (
  SELECT 
    mc.item_code,
    AVG(mc.monthly_qty) as avg_monthly_consumption,
    STDDEV(mc.monthly_qty) as consumption_stddev,
    COUNT(mc.month) as active_months,
    MIN(mc.month) as first_consumption_month,
    MAX(mc.month) as last_consumption_month,
    -- Calculate trend using linear regression slope
    COALESCE(
      (COUNT(mc.month) * SUM(EXTRACT(EPOCH FROM mc.month) * mc.monthly_qty) - 
       SUM(EXTRACT(EPOCH FROM mc.month)) * SUM(mc.monthly_qty)) /
      NULLIF(COUNT(mc.month) * SUM(POWER(EXTRACT(EPOCH FROM mc.month), 2)) - 
             POWER(SUM(EXTRACT(EPOCH FROM mc.month)), 2), 0),
      0
    ) as trend_slope,
    SUM(mc.monthly_qty) as total_consumption_24m
  FROM monthly_consumption mc
  GROUP BY mc.item_code
)
SELECT 
  ist.item_code,
  im.item_name,
  c.category_name,
  ist.avg_monthly_consumption,
  ist.consumption_stddev,
  ist.active_months,
  ist.total_consumption_24m,
  -- Coefficient of variation for irregularity detection
  CASE 
    WHEN ist.avg_monthly_consumption > 0 
    THEN (ist.consumption_stddev / ist.avg_monthly_consumption) * 100 
    ELSE 0 
  END as coefficient_of_variation,
  -- Trend classification
  CASE 
    WHEN ist.trend_slope > 0.1 THEN 'increasing'
    WHEN ist.trend_slope < -0.1 THEN 'decreasing'
    ELSE 'stable'
  END as trend_direction,
  ABS(ist.trend_slope) * 100 as trend_percentage,
  -- Seasonality score (simplified - based on coefficient of variation)
  CASE 
    WHEN ist.consumption_stddev / NULLIF(ist.avg_monthly_consumption, 0) > 0.5 THEN 0.8
    WHEN ist.consumption_stddev / NULLIF(ist.avg_monthly_consumption, 0) > 0.3 THEN 0.5
    WHEN ist.consumption_stddev / NULLIF(ist.avg_monthly_consumption, 0) > 0.1 THEN 0.3
    ELSE 0.1
  END as seasonality_score,
  -- Simple forecast for next month using exponential smoothing
  CASE 
    WHEN ist.avg_monthly_consumption > 0 THEN
      ist.avg_monthly_consumption * (1 + LEAST(GREATEST(ist.trend_slope, -0.5), 0.5))
    ELSE 0
  END as forecast_next_month,
  -- Safety stock recommendation
  CEIL(ist.avg_monthly_consumption * (1 + (ist.consumption_stddev / NULLIF(ist.avg_monthly_consumption, 0))) * 0.5) as safety_stock_recommended,
  -- Consumption pattern classification
  CASE 
    WHEN ist.consumption_stddev / NULLIF(ist.avg_monthly_consumption, 0) > 0.5 THEN 'irregular'
    WHEN ist.trend_slope < -0.2 THEN 'declining'
    WHEN ist.consumption_stddev / NULLIF(ist.avg_monthly_consumption, 0) > 0.25 THEN 'seasonal'
    ELSE 'regular'
  END as consumption_pattern,
  CURRENT_TIMESTAMP as last_refreshed
FROM item_stats ist
JOIN public.satguru_item_master im ON ist.item_code = im.item_code
LEFT JOIN public.categories c ON im.category_id = c.id
WHERE ist.avg_monthly_consumption > 0;

-- Create indexes for consumption patterns
CREATE INDEX IF NOT EXISTS idx_consumption_patterns_item_code ON public.satguru_analytics_consumption_patterns(item_code);
CREATE INDEX IF NOT EXISTS idx_consumption_patterns_category ON public.satguru_analytics_consumption_patterns(category_name);
CREATE INDEX IF NOT EXISTS idx_consumption_patterns_trend ON public.satguru_analytics_consumption_patterns(trend_direction);
CREATE INDEX IF NOT EXISTS idx_consumption_patterns_pattern ON public.satguru_analytics_consumption_patterns(consumption_pattern);

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION public.refresh_analytics_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.satguru_analytics_stock_metrics;
  REFRESH MATERIALIZED VIEW public.satguru_analytics_consumption_patterns;
  
  -- Log the refresh
  RAISE LOG 'Analytics materialized views refreshed at %', CURRENT_TIMESTAMP;
END;
$$;

-- Create a function to detect anomalies in consumption patterns
CREATE OR REPLACE FUNCTION public.detect_consumption_anomalies(
  p_item_code TEXT DEFAULT NULL,
  p_threshold_factor NUMERIC DEFAULT 2.0
)
RETURNS TABLE(
  item_code TEXT,
  item_name TEXT,
  anomaly_date DATE,
  expected_consumption NUMERIC,
  actual_consumption NUMERIC,
  deviation_factor NUMERIC,
  anomaly_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH daily_consumption AS (
    SELECT 
      il.item_code,
      il.issue_date,
      SUM(il.qty_issued) as daily_qty
    FROM public.satguru_issue_log il
    WHERE (p_item_code IS NULL OR il.item_code = p_item_code)
    AND il.issue_date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY il.item_code, il.issue_date
  ),
  consumption_stats AS (
    SELECT 
      dc.item_code,
      AVG(dc.daily_qty) as avg_daily_consumption,
      STDDEV(dc.daily_qty) as stddev_daily_consumption
    FROM daily_consumption dc
    GROUP BY dc.item_code
    HAVING COUNT(*) >= 10 -- Need sufficient data points
  )
  SELECT 
    dc.item_code,
    im.item_name,
    dc.issue_date,
    cs.avg_daily_consumption,
    dc.daily_qty,
    ABS(dc.daily_qty - cs.avg_daily_consumption) / NULLIF(cs.stddev_daily_consumption, 0) as deviation_factor,
    CASE 
      WHEN dc.daily_qty > cs.avg_daily_consumption + (p_threshold_factor * cs.stddev_daily_consumption) THEN 'high_consumption'
      WHEN dc.daily_qty < cs.avg_daily_consumption - (p_threshold_factor * cs.stddev_daily_consumption) THEN 'low_consumption'
      ELSE 'normal'
    END as anomaly_type
  FROM daily_consumption dc
  JOIN consumption_stats cs ON dc.item_code = cs.item_code
  JOIN public.satguru_item_master im ON dc.item_code = im.item_code
  WHERE ABS(dc.daily_qty - cs.avg_daily_consumption) > (p_threshold_factor * cs.stddev_daily_consumption)
  ORDER BY dc.issue_date DESC, deviation_factor DESC;
END;
$$;

-- Create advanced forecasting function using multiple methods
CREATE OR REPLACE FUNCTION public.advanced_demand_forecast(
  p_item_code TEXT,
  p_forecast_months INTEGER DEFAULT 6
)
RETURNS TABLE(
  forecast_month DATE,
  simple_moving_average NUMERIC,
  exponential_smoothing NUMERIC,
  linear_trend NUMERIC,
  seasonal_adjusted NUMERIC,
  confidence_score NUMERIC,
  recommended_forecast NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  avg_monthly NUMERIC;
  trend_slope NUMERIC;
  seasonal_factor NUMERIC[];
  smoothing_alpha NUMERIC := 0.3;
  i INTEGER;
BEGIN
  -- Get historical data for calculations
  SELECT 
    cp.avg_monthly_consumption,
    cp.trend_percentage / 100.0,
    ARRAY[1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0] -- Simplified seasonal factors
  INTO avg_monthly, trend_slope, seasonal_factor
  FROM public.satguru_analytics_consumption_patterns cp
  WHERE cp.item_code = p_item_code;
  
  -- If no data found, return empty result
  IF avg_monthly IS NULL THEN
    RETURN;
  END IF;
  
  -- Generate forecasts for each month
  FOR i IN 1..p_forecast_months LOOP
    forecast_month := DATE_TRUNC('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
    
    -- Simple Moving Average (baseline)
    simple_moving_average := avg_monthly;
    
    -- Exponential Smoothing
    exponential_smoothing := avg_monthly * (1 + (trend_slope * i * smoothing_alpha));
    
    -- Linear Trend
    linear_trend := avg_monthly * (1 + (trend_slope * i));
    
    -- Seasonal Adjustment
    seasonal_adjusted := avg_monthly * seasonal_factor[(EXTRACT(MONTH FROM forecast_month)::INTEGER)];
    
    -- Calculate confidence score (simplified)
    confidence_score := GREATEST(0.1, 1.0 - (i * 0.1)); -- Decreases with distance
    
    -- Recommended forecast (weighted average)
    recommended_forecast := (
      simple_moving_average * 0.2 +
      exponential_smoothing * 0.3 +
      linear_trend * 0.3 +
      seasonal_adjusted * 0.2
    );
    
    RETURN NEXT;
  END LOOP;
END;
$$;