
-- Add debugging and fix the validate_issue_batch_all function
CREATE OR REPLACE FUNCTION validate_issue_batch_all(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_items integer;
    v_results jsonb := '[]'::jsonb;
    v_item jsonb;
    v_item_code text;
    v_qty_issued numeric;
    v_row_num integer;
    v_stock_data jsonb;
    v_validation_status text;
    v_error_message text;
    v_current_stock numeric;
    v_item_name text;
BEGIN
    v_total_items := jsonb_array_length(p_items);
    
    RAISE LOG 'Starting validation for % items', v_total_items;
    
    -- Process each item
    FOR i IN 0..v_total_items-1 LOOP
        v_item := p_items->i;
        v_item_code := v_item->>'item_code';
        v_qty_issued := COALESCE((v_item->>'qty_issued')::numeric, (v_item->>'requested_qty')::numeric, 0);
        v_row_num := COALESCE((v_item->>'row_num')::integer, i + 1);
        
        -- Skip if no item code
        IF v_item_code IS NULL OR TRIM(v_item_code) = '' THEN
            v_results := v_results || jsonb_build_array(
                jsonb_build_object(
                    'row_num', v_row_num,
                    'item_code', '',
                    'item_name', '',
                    'available_qty', 0,
                    'requested_qty', v_qty_issued,
                    'validation_status', 'not_found',
                    'error_message', 'Missing item code'
                )
            );
            CONTINUE;
        END IF;
        
        -- Get stock data using the same method as Stock Summary
        -- First, get from satguru_stock table directly
        SELECT COALESCE(current_qty, 0) INTO v_current_stock
        FROM satguru_stock 
        WHERE item_code = v_item_code;
        
        -- If no record in satguru_stock, try calculating from scratch
        IF v_current_stock IS NULL THEN
            v_stock_data := calculate_current_stock(v_item_code);
            v_current_stock := COALESCE((v_stock_data->>'current_stock')::numeric, 0);
            v_item_name := COALESCE(v_stock_data->>'item_name', '');
            
            RAISE LOG 'Calculated stock for %: current_stock=%, item_name=%', 
                v_item_code, v_current_stock, v_item_name;
        ELSE
            -- Get item name from master table
            SELECT item_name INTO v_item_name
            FROM satguru_item_master
            WHERE item_code = v_item_code;
            
            RAISE LOG 'Direct stock lookup for %: current_stock=%, item_name=%', 
                v_item_code, v_current_stock, v_item_name;
        END IF;
        
        -- Determine validation status
        IF v_item_name IS NULL THEN
            v_validation_status := 'not_found';
            v_error_message := 'Item code not found in master data';
        ELSIF v_current_stock >= v_qty_issued THEN
            v_validation_status := 'sufficient';
            v_error_message := format('Stock sufficient. Available: %s KG', v_current_stock);
        ELSE
            v_validation_status := 'insufficient_stock';
            v_error_message := format('Insufficient stock. Available: %s KG, Requested: %s KG, Short by: %s KG',
                v_current_stock, v_qty_issued, v_qty_issued - v_current_stock);
        END IF;
        
        -- Add to results
        v_results := v_results || jsonb_build_array(
            jsonb_build_object(
                'row_num', v_row_num,
                'item_code', v_item_code,
                'item_name', COALESCE(v_item_name, ''),
                'available_qty', v_current_stock,
                'requested_qty', v_qty_issued,
                'validation_status', v_validation_status,
                'error_message', v_error_message
            )
        );
        
        RAISE LOG 'Validation result for %: status=%, available=%, requested=%', 
            v_item_code, v_validation_status, v_current_stock, v_qty_issued;
    END LOOP;
    
    RAISE LOG 'Validation complete. Total results: %', jsonb_array_length(v_results);
    
    RETURN v_results;
END;
$$;
