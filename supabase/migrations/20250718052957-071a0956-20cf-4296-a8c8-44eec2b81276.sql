-- Create the calculate_order_progress function
CREATE OR REPLACE FUNCTION calculate_order_progress()
RETURNS TABLE(
  uiorn text,
  progress_percentage numeric,
  current_stage text,
  estimated_completion timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    op.uiorn,
    CASE 
      WHEN op.status = 'PENDING' THEN 0::numeric
      WHEN op.status = 'IN_PROGRESS' THEN 50::numeric
      WHEN op.status = 'COMPLETED' THEN 100::numeric
      WHEN op.status = 'ON_HOLD' THEN 25::numeric
      ELSE 0::numeric
    END as progress_percentage,
    op.status as current_stage,
    CASE 
      WHEN op.delivery_date IS NOT NULL THEN op.delivery_date::timestamp with time zone
      ELSE (op.created_at + INTERVAL '7 days')::timestamp with time zone
    END as estimated_completion
  FROM order_punching op
  ORDER BY op.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create the get_workflow_bottlenecks function
CREATE OR REPLACE FUNCTION get_workflow_bottlenecks()
RETURNS TABLE(
  stage text,
  avg_processing_time numeric,
  pending_orders integer,
  bottleneck_score numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    op.status as stage,
    EXTRACT(EPOCH FROM (AVG(COALESCE(op.updated_at, op.created_at) - op.created_at) / 3600))::numeric as avg_processing_time,
    COUNT(*)::integer as pending_orders,
    (COUNT(*) * EXTRACT(EPOCH FROM (AVG(COALESCE(op.updated_at, op.created_at) - op.created_at) / 3600)))::numeric as bottleneck_score
  FROM order_punching op
  WHERE op.status != 'COMPLETED'
  GROUP BY op.status
  ORDER BY bottleneck_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a materialized view for manufacturing analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS manufacturing_analytics AS
SELECT 
  COUNT(*) FILTER (WHERE status = 'PENDING') as pending_orders,
  COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as active_orders,
  COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_orders,
  COUNT(*) FILTER (WHERE status = 'ON_HOLD') as on_hold_orders,
  COUNT(*) FILTER (WHERE priority_level = 'HIGH') as high_priority_orders,
  COUNT(*) FILTER (WHERE delivery_date < CURRENT_DATE AND status != 'COMPLETED') as overdue_orders,
  ROUND(AVG(order_quantity)::numeric, 2) as avg_order_quantity,
  COUNT(DISTINCT customer_name) as unique_customers
FROM order_punching;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW manufacturing_analytics;

-- Create function to refresh analytics
CREATE OR REPLACE FUNCTION refresh_manufacturing_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW manufacturing_analytics;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-refresh analytics when orders change
CREATE OR REPLACE FUNCTION trigger_refresh_analytics()
RETURNS trigger AS $$
BEGIN
  PERFORM refresh_manufacturing_analytics();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS refresh_analytics_trigger ON order_punching;

-- Create trigger for automatic analytics refresh
CREATE TRIGGER refresh_analytics_trigger
  AFTER INSERT OR UPDATE OR DELETE ON order_punching
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_analytics();