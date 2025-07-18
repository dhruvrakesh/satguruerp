-- Fix the functions to properly cast the enum types
DROP FUNCTION IF EXISTS calculate_order_progress();
DROP FUNCTION IF EXISTS get_workflow_bottlenecks();

-- Create the calculate_order_progress function with proper casting
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
      WHEN op.status::text = 'PENDING' THEN 0::numeric
      WHEN op.status::text = 'IN_PROGRESS' THEN 50::numeric
      WHEN op.status::text = 'COMPLETED' THEN 100::numeric
      WHEN op.status::text = 'ON_HOLD' THEN 25::numeric
      ELSE 0::numeric
    END as progress_percentage,
    op.status::text as current_stage,
    CASE 
      WHEN op.delivery_date IS NOT NULL THEN op.delivery_date::timestamp with time zone
      ELSE (op.created_at + INTERVAL '7 days')::timestamp with time zone
    END as estimated_completion
  FROM order_punching op
  ORDER BY op.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create the get_workflow_bottlenecks function with proper casting
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
    op.status::text as stage,
    CASE 
      WHEN COUNT(*) = 0 THEN 0::numeric
      ELSE EXTRACT(EPOCH FROM (AVG(COALESCE(op.updated_at, op.created_at) - op.created_at) / 3600))::numeric
    END as avg_processing_time,
    COUNT(*)::integer as pending_orders,
    CASE 
      WHEN COUNT(*) = 0 THEN 0::numeric
      ELSE (COUNT(*) * EXTRACT(EPOCH FROM (AVG(COALESCE(op.updated_at, op.created_at) - op.created_at) / 3600)))::numeric
    END as bottleneck_score
  FROM order_punching op
  WHERE op.status::text != 'COMPLETED'
  GROUP BY op.status::text
  ORDER BY bottleneck_score DESC;
END;
$$ LANGUAGE plpgsql;