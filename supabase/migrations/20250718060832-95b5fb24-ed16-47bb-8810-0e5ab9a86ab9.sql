-- Fix the process statistics function to handle enum types
DROP FUNCTION IF EXISTS get_process_statistics();

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
    pl.stage::text,
    COUNT(*)::integer as total_entries,
    MAX(pl.captured_at) as latest_activity,
    COUNT(DISTINCT pl.uiorn)::integer as unique_orders
  FROM process_logs_se pl
  GROUP BY pl.stage
  ORDER BY total_entries DESC;
END;
$$ LANGUAGE plpgsql;