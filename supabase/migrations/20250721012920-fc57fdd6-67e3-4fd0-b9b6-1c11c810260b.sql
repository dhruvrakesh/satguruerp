
-- Enable RLS and add read-only SELECT policies for satguru_item_master
ALTER TABLE public.satguru_item_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_read_sim_anon ON public.satguru_item_master;
CREATE POLICY app_read_sim_anon
  ON public.satguru_item_master FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS app_read_sim_auth ON public.satguru_item_master;
CREATE POLICY app_read_sim_auth
  ON public.satguru_item_master FOR SELECT TO authenticated USING (true);

-- Enable RLS and add read-only SELECT policies for satguru_stock
ALTER TABLE public.satguru_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_read_stock_anon ON public.satguru_stock;
CREATE POLICY app_read_stock_anon
  ON public.satguru_stock FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS app_read_stock_auth ON public.satguru_stock;
CREATE POLICY app_read_stock_auth
  ON public.satguru_stock FOR SELECT TO authenticated USING (true);

-- Create bulk validation function for issue uploads
CREATE OR REPLACE FUNCTION public.validate_issue_batch(
  p_items jsonb
)
RETURNS TABLE(
  row_num integer,
  item_code text,
  item_name text,
  available_qty numeric,
  requested_qty numeric,
  validation_status text,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (item->>'row_num')::integer as row_num,
    TRIM(item->>'item_code') as item_code,
    COALESCE(im.item_name, 'Unknown Item') as item_name,
    COALESCE(s.current_qty, 0)::numeric as available_qty,
    (item->>'qty_issued')::numeric as requested_qty,
    CASE
      WHEN im.item_code IS NULL THEN 'not_found'
      WHEN COALESCE(s.current_qty, 0) < (item->>'qty_issued')::numeric THEN 'insufficient_stock'
      ELSE 'sufficient'
    END as validation_status,
    CASE
      WHEN im.item_code IS NULL THEN 'Item code not found in master data'
      WHEN COALESCE(s.current_qty, 0) < (item->>'qty_issued')::numeric THEN 
        'Insufficient stock: Available ' || COALESCE(s.current_qty, 0) || ', Requested ' || (item->>'qty_issued')::numeric
      ELSE 'Stock available'
    END as error_message
  FROM jsonb_array_elements(p_items) item
  LEFT JOIN public.satguru_item_master im ON TRIM(im.item_code) = TRIM(item->>'item_code')
  LEFT JOIN public.satguru_stock s ON s.item_code = im.item_code
  ORDER BY (item->>'row_num')::integer;
END;
$$;

-- Create process issue batch function for bulk insert
CREATE OR REPLACE FUNCTION public.process_issue_batch(
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  processed_count integer := 0;
  error_count integer := 0;
  result jsonb;
BEGIN
  -- Insert only validated rows with sufficient stock
  INSERT INTO public.satguru_issue_log (
    item_code,
    qty_issued,
    date,
    purpose,
    remarks,
    created_at
  )
  SELECT 
    TRIM(row_data->>'item_code'),
    (row_data->>'qty_issued')::numeric,
    COALESCE((row_data->>'date')::date, CURRENT_DATE),
    COALESCE(row_data->>'purpose', 'Bulk Upload'),
    COALESCE(row_data->>'remarks', 'Bulk issue upload - Row ' || (row_data->>'row_num')),
    now()
  FROM jsonb_array_elements(p_rows) row_data
  WHERE row_data->>'validation_status' = 'sufficient';

  GET DIAGNOSTICS processed_count = ROW_COUNT;
  
  -- Count errors
  SELECT COUNT(*) INTO error_count
  FROM jsonb_array_elements(p_rows) row_data
  WHERE row_data->>'validation_status' != 'sufficient';

  result := jsonb_build_object(
    'processed_count', processed_count,
    'error_count', error_count,
    'total_count', jsonb_array_length(p_rows),
    'success', processed_count > 0
  );

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.validate_issue_batch(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_issue_batch(jsonb) TO anon, authenticated;
