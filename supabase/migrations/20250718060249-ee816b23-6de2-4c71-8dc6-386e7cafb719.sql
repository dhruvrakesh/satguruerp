-- Phase 1: Historical Process Integration
-- Create a view to connect process_logs_se with order_punching
CREATE OR REPLACE VIEW order_process_history AS
SELECT 
  pl.id,
  pl.uiorn,
  pl.stage,
  pl.metric,
  pl.value,
  pl.txt_value,
  pl.captured_at,
  pl.captured_by,
  op.customer_name,
  op.product_description,
  op.order_quantity,
  op.priority_level,
  op.status as current_order_status,
  op.created_at as order_created_at
FROM process_logs_se pl
LEFT JOIN order_punching op ON pl.uiorn = op.uiorn
ORDER BY pl.captured_at DESC;

-- Create a function to get process history for a specific order
CREATE OR REPLACE FUNCTION get_order_process_history(p_uiorn text)
RETURNS TABLE(
  id uuid,
  stage text,
  metric text,
  value numeric,
  txt_value text,
  captured_at timestamp with time zone,
  captured_by uuid,
  customer_name text,
  product_description text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oph.id,
    oph.stage,
    oph.metric,
    oph.value,
    oph.txt_value,
    oph.captured_at,
    oph.captured_by,
    oph.customer_name,
    oph.product_description
  FROM order_process_history oph
  WHERE oph.uiorn = p_uiorn
  ORDER BY oph.captured_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get process statistics
CREATE OR REPLACE FUNCTION get_process_statistics()
RETURNS TABLE(
  stage text,
  total_entries integer,
  latest_activity timestamp with time zone,
  unique_orders integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pl.stage,
    COUNT(*)::integer as total_entries,
    MAX(pl.captured_at) as latest_activity,
    COUNT(DISTINCT pl.uiorn)::integer as unique_orders
  FROM process_logs_se pl
  GROUP BY pl.stage
  ORDER BY total_entries DESC;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on the view (inherits from underlying tables)
ALTER VIEW order_process_history OWNER TO postgres;

-- Grant necessary permissions
GRANT SELECT ON order_process_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_process_history(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_process_statistics() TO authenticated;