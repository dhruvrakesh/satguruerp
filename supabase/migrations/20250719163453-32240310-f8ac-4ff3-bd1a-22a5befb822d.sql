
-- Create function to get artwork items for selection (FG items)
CREATE OR REPLACE FUNCTION get_artwork_items_for_selection()
RETURNS TABLE (
  item_code text,
  item_name text,
  customer_name text,
  no_of_colours text,
  dimensions text,
  file_hyperlink text,
  file_id text,
  usage_type text,
  uom text,
  status text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mda.item_code,
    mda.item_name,
    mda.customer_name,
    mda.no_of_colours,
    mda.dimensions,
    mda.file_hyperlink,
    mda.file_id,
    'FG'::text as usage_type,
    'PCS'::text as uom,
    'ACTIVE'::text as status
  FROM master_data_artworks_se mda
  WHERE mda.item_code IS NOT NULL 
    AND mda.item_name IS NOT NULL
  ORDER BY mda.item_code;
END;
$$;

-- Create function to handle manufacturing orders with artwork items
CREATE OR REPLACE FUNCTION create_manufacturing_order_with_artwork(
  p_order_data jsonb,
  p_selected_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id text;
  v_item jsonb;
  v_result jsonb;
BEGIN
  -- Generate UIORN for the order
  v_order_id := next_uiorn(CURRENT_DATE);
  
  -- Insert main order
  INSERT INTO orders_dashboard_se (
    uiorn,
    item_name,
    substrate,
    po_number,
    created_by
  ) VALUES (
    v_order_id,
    p_order_data->>'product_description',
    p_order_data->>'product_description',
    'PO-' || extract(epoch from now())::text,
    auth.uid()
  );
  
  -- Process selected items (both RM and FG)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_selected_items)
  LOOP
    -- Insert item requirements into a manufacturing_order_items table if needed
    -- This would be created based on your specific requirements
    NULL; -- Placeholder for item processing logic
  END LOOP;
  
  -- Return result
  v_result := jsonb_build_object(
    'success', true,
    'uiorn', v_order_id,
    'message', 'Manufacturing order created successfully'
  );
  
  RETURN v_result;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_artwork_items_for_selection() TO authenticated;
GRANT EXECUTE ON FUNCTION create_manufacturing_order_with_artwork(jsonb, jsonb) TO authenticated;
