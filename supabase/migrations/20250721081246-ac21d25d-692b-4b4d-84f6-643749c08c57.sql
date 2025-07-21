
-- Create a new batch processing function that handles large datasets
CREATE OR REPLACE FUNCTION validate_issue_batch_chunked(
    p_items jsonb,
    p_chunk_size integer DEFAULT 1000,
    p_chunk_index integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_chunk_start integer;
    v_chunk_end integer;
    v_chunk_items jsonb;
    v_result jsonb;
    v_total_items integer;
    v_processed_items integer;
BEGIN
    -- Get total number of items
    v_total_items := jsonb_array_length(p_items);
    
    -- Calculate chunk boundaries
    v_chunk_start := p_chunk_index * p_chunk_size;
    v_chunk_end := LEAST(v_chunk_start + p_chunk_size, v_total_items);
    
    -- Extract chunk from items array
    v_chunk_items := jsonb_build_array();
    FOR i IN v_chunk_start..v_chunk_end-1 LOOP
        v_chunk_items := v_chunk_items || jsonb_build_array(p_items->i);
    END LOOP;
    
    -- Process the chunk using existing validation logic
    WITH item_validation AS (
        SELECT 
            (item->>'item_code')::text as item_code,
            (item->>'qty_issued')::numeric as qty_issued,
            (item->>'row_num')::integer as row_num
        FROM jsonb_array_elements(v_chunk_items) as item
    ),
    stock_check AS (
        SELECT 
            iv.item_code,
            iv.qty_issued as requested_qty,
            iv.row_num,
            COALESCE(s.current_qty, 0) as available_qty,
            CASE 
                WHEN im.item_code IS NULL THEN 'not_found'
                WHEN COALESCE(s.current_qty, 0) >= iv.qty_issued THEN 'sufficient'
                ELSE 'insufficient_stock'
            END as validation_status,
            CASE 
                WHEN im.item_code IS NULL THEN 'Item code not found in master data'
                WHEN COALESCE(s.current_qty, 0) < iv.qty_issued THEN 
                    'Insufficient stock. Available: ' || COALESCE(s.current_qty, 0) || ', Requested: ' || iv.qty_issued
                ELSE 'Stock sufficient'
            END as error_message,
            im.item_name
        FROM item_validation iv
        LEFT JOIN satguru_item_master im ON iv.item_code = im.item_code
        LEFT JOIN satguru_stock s ON iv.item_code = s.item_code
    )
    SELECT jsonb_build_object(
        'results', jsonb_agg(
            jsonb_build_object(
                'row_num', sc.row_num,
                'item_code', sc.item_code,
                'item_name', COALESCE(sc.item_name, ''),
                'available_qty', sc.available_qty,
                'requested_qty', sc.requested_qty,
                'validation_status', sc.validation_status,
                'error_message', sc.error_message
            )
        ),
        'chunk_info', jsonb_build_object(
            'chunk_index', p_chunk_index,
            'chunk_size', p_chunk_size,
            'chunk_start', v_chunk_start,
            'chunk_end', v_chunk_end,
            'total_items', v_total_items,
            'processed_items', v_chunk_end - v_chunk_start,
            'has_more', v_chunk_end < v_total_items
        )
    ) INTO v_result
    FROM stock_check sc;
    
    RETURN v_result;
END;
$$;

-- Create a wrapper function that processes all chunks automatically
CREATE OR REPLACE FUNCTION validate_issue_batch_all(p_items jsonb) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_items integer;
    v_chunk_size integer := 1000;
    v_chunk_index integer := 0;
    v_all_results jsonb := '[]'::jsonb;
    v_chunk_result jsonb;
    v_chunk_data jsonb;
    v_has_more boolean := true;
BEGIN
    v_total_items := jsonb_array_length(p_items);
    
    -- Log the start of processing
    RAISE LOG 'Starting batch validation for % items', v_total_items;
    
    -- Process chunks until all items are processed
    WHILE v_has_more LOOP
        -- Get chunk result
        v_chunk_result := validate_issue_batch_chunked(p_items, v_chunk_size, v_chunk_index);
        
        -- Extract results and append to all_results
        v_chunk_data := v_chunk_result->'results';
        v_all_results := v_all_results || v_chunk_data;
        
        -- Check if there are more chunks
        v_has_more := (v_chunk_result->'chunk_info'->>'has_more')::boolean;
        v_chunk_index := v_chunk_index + 1;
        
        -- Log progress
        RAISE LOG 'Processed chunk %, total results so far: %', v_chunk_index, jsonb_array_length(v_all_results);
    END LOOP;
    
    RAISE LOG 'Batch validation complete. Total results: %', jsonb_array_length(v_all_results);
    
    -- Return all results
    RETURN v_all_results;
END;
$$;
