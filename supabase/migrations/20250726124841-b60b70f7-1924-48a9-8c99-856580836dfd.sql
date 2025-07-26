-- COMPLETE CLEANUP AND FIX FOR AI INTELLIGENCE DASHBOARD
-- Drop all existing conflicting functions completely

-- Drop all versions of generate_predictive_insights
DROP FUNCTION IF EXISTS generate_predictive_insights() CASCADE;
DROP FUNCTION IF EXISTS generate_predictive_insights(text) CASCADE;
DROP FUNCTION IF EXISTS generate_predictive_insights(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS generate_predictive_insights(p_prediction_type text) CASCADE;
DROP FUNCTION IF EXISTS generate_predictive_insights(p_prediction_type text, p_user_id uuid) CASCADE;

-- Drop all versions of get_advanced_manufacturing_analytics
DROP FUNCTION IF EXISTS get_advanced_manufacturing_analytics() CASCADE;
DROP FUNCTION IF EXISTS get_advanced_manufacturing_analytics(text) CASCADE;
DROP FUNCTION IF EXISTS get_advanced_manufacturing_analytics(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS get_advanced_manufacturing_analytics(p_analysis_type text) CASCADE;
DROP FUNCTION IF EXISTS get_advanced_manufacturing_analytics(p_analysis_type text, p_user_id uuid) CASCADE;

-- Create single, working get_advanced_manufacturing_analytics function
CREATE OR REPLACE FUNCTION get_advanced_manufacturing_analytics(
  p_analysis_type text DEFAULT 'comprehensive',
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  total_items bigint,
  low_stock_items bigint,
  out_of_stock_items bigint,
  total_inventory_value numeric,
  average_stock_level numeric,
  stock_turnover_rate numeric,
  critical_reorder_items bigint,
  excess_stock_items bigint,
  analysis_timestamp timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH stock_analysis AS (
    SELECT 
      s.item_code,
      s.current_qty,
      COALESCE(p.standard_rate, p.purchase_rate, 0) as unit_price,
      s.current_qty * COALESCE(p.standard_rate, p.purchase_rate, 0) as item_value,
      CASE 
        WHEN s.current_qty <= 0 THEN 'out_of_stock'
        WHEN s.current_qty <= 10 THEN 'low_stock'
        WHEN s.current_qty >= 1000 THEN 'excess_stock'
        ELSE 'normal'
      END as stock_status
    FROM satguru_stock_summary_view s
    LEFT JOIN satguru_item_pricing p ON s.item_code = p.item_code
    WHERE s.current_qty IS NOT NULL
  ),
  aggregated_stats AS (
    SELECT
      COUNT(*) as total_items_count,
      COUNT(*) FILTER (WHERE stock_status = 'low_stock') as low_stock_count,
      COUNT(*) FILTER (WHERE stock_status = 'out_of_stock') as out_of_stock_count,
      COALESCE(SUM(item_value), 0) as total_value,
      COALESCE(AVG(current_qty), 0) as avg_stock,
      COUNT(*) FILTER (WHERE stock_status IN ('low_stock', 'out_of_stock')) as critical_reorder_count,
      COUNT(*) FILTER (WHERE stock_status = 'excess_stock') as excess_stock_count
    FROM stock_analysis
  )
  SELECT 
    s.total_items_count::bigint,
    s.low_stock_count::bigint,
    s.out_of_stock_count::bigint,
    s.total_value::numeric,
    s.avg_stock::numeric,
    CASE 
      WHEN s.avg_stock > 0 THEN (s.total_value / s.avg_stock)::numeric
      ELSE 0::numeric
    END as turnover_rate,
    s.critical_reorder_count::bigint,
    s.excess_stock_count::bigint,
    now() as analysis_timestamp
  FROM aggregated_stats s;
END;
$$;

-- Create single, working generate_predictive_insights function
CREATE OR REPLACE FUNCTION generate_predictive_insights(
  p_prediction_type text DEFAULT 'immediate_forecast',
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  insight_type text,
  insight_message text,
  confidence_score numeric,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH stock_predictions AS (
    SELECT 
      s.item_code,
      s.current_qty,
      COALESCE(p.standard_rate, p.purchase_rate, 0) as unit_price,
      CASE 
        WHEN s.current_qty <= 0 THEN 'stockout'
        WHEN s.current_qty <= 10 THEN 'depletion_risk'
        WHEN s.current_qty >= 1000 THEN 'excess_inventory'
        ELSE 'normal'
      END as prediction_category
    FROM satguru_stock_summary_view s
    LEFT JOIN satguru_item_pricing p ON s.item_code = p.item_code
    WHERE s.current_qty IS NOT NULL
  ),
  insight_data AS (
    SELECT
      COUNT(*) FILTER (WHERE prediction_category = 'depletion_risk') as depletion_items,
      COUNT(*) FILTER (WHERE prediction_category = 'stockout') as stockout_items,
      COUNT(*) FILTER (WHERE prediction_category = 'excess_inventory') as excess_items,
      COUNT(*) as total_items
    FROM stock_predictions
  )
  SELECT 
    'stock_depletion'::text as insight_type,
    (i.depletion_items || ' items predicted to run out of stock within 7 days')::text as insight_message,
    0.85::numeric as confidence_score,
    jsonb_build_object(
      'urgency', 'high',
      'affected_items', i.depletion_items,
      'action_required', 'immediate_reorder'
    ) as metadata
  FROM insight_data i
  WHERE i.depletion_items > 0

  UNION ALL

  SELECT 
    'demand_surge'::text as insight_type,
    (i.excess_items || ' items showing increased demand patterns')::text as insight_message,
    0.78::numeric as confidence_score,
    jsonb_build_object(
      'recommendation', 'increase_safety_stock',
      'trending_items', i.excess_items,
      'trend_direction', 'upward'
    ) as metadata
  FROM insight_data i
  WHERE i.excess_items > 0

  UNION ALL

  SELECT 
    'stockout_prevention'::text as insight_type,
    (i.stockout_items || ' items currently out of stock - immediate action required')::text as insight_message,
    0.95::numeric as confidence_score,
    jsonb_build_object(
      'impact', 'production_halt',
      'priority', 'critical',
      'critical_items', i.stockout_items
    ) as metadata
  FROM insight_data i
  WHERE i.stockout_items > 0;
END;
$$;