
-- Fix the process_issue_batch function to handle proper field mapping and null validation
CREATE OR REPLACE FUNCTION process_issue_batch(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_processed_count integer := 0;
    v_error_count integer := 0;
    v_total_count integer;
    v_current_row jsonb;
    v_item_code text;
    v_qty_issued numeric;
    v_error_details jsonb := '[]'::jsonb;
BEGIN
    -- Get total count of rows to process
    v_total_count := jsonb_array_length(p_rows);
    
    RAISE LOG 'Starting batch processing for % rows', v_total_count;
    
    -- Validate input
    IF v_total_count = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'processed_count', 0,
            'error_count', 0,
            'total_count', 0,
            'message', 'No rows to process'
        );
    END IF;
    
    -- Process each row
    FOR i IN 0..v_total_count-1 LOOP
        BEGIN
            v_current_row := p_rows->i;
            
            -- Extract and validate required fields with proper mapping
            v_item_code := v_current_row->>'item_code';
            
            -- Handle both qty_issued and requested_qty field names
            v_qty_issued := COALESCE(
                (v_current_row->>'qty_issued')::numeric,
                (v_current_row->>'requested_qty')::numeric
            );
            
            -- Validate required fields
            IF v_item_code IS NULL OR TRIM(v_item_code) = '' THEN
                RAISE EXCEPTION 'Missing item_code in row %', i + 1;
            END IF;
            
            IF v_qty_issued IS NULL OR v_qty_issued <= 0 THEN
                RAISE EXCEPTION 'Invalid qty_issued (%) in row % for item %', v_qty_issued, i + 1, v_item_code;
            END IF;
            
            -- Verify item exists in master data
            IF NOT EXISTS (
                SELECT 1 FROM satguru_item_master 
                WHERE item_code = v_item_code
            ) THEN
                RAISE EXCEPTION 'Item % not found in master data', v_item_code;
            END IF;
            
            -- Insert into issue log
            INSERT INTO satguru_issue_log (
                item_code,
                qty_issued,
                date,
                purpose,
                remarks,
                created_at
            ) VALUES (
                v_item_code,
                v_qty_issued,
                COALESCE((v_current_row->>'date')::date, CURRENT_DATE),
                COALESCE(v_current_row->>'purpose', 'Bulk upload'),
                COALESCE(v_current_row->>'remarks', 'Batch processed'),
                NOW()
            );
            
            -- Update stock in satguru_stock table
            INSERT INTO satguru_stock (item_code, current_qty, last_updated)
            VALUES (v_item_code, -v_qty_issued, NOW())
            ON CONFLICT (item_code)
            DO UPDATE SET 
                current_qty = satguru_stock.current_qty - v_qty_issued,
                last_updated = NOW();
            
            v_processed_count := v_processed_count + 1;
            
            RAISE LOG 'Successfully processed row % for item % with qty %', i + 1, v_item_code, v_qty_issued;
            
        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            
            -- Log the error details
            v_error_details := v_error_details || jsonb_build_array(
                jsonb_build_object(
                    'row_index', i + 1,
                    'item_code', COALESCE(v_item_code, 'unknown'),
                    'error_message', SQLERRM,
                    'error_state', SQLSTATE
                )
            );
            
            RAISE LOG 'Error processing row %: %', i + 1, SQLERRM;
            
            -- Continue processing other rows
            CONTINUE;
        END;
    END LOOP;
    
    RAISE LOG 'Batch processing complete. Processed: %, Errors: %, Total: %', 
        v_processed_count, v_error_count, v_total_count;
    
    -- Return results
    RETURN jsonb_build_object(
        'success', v_error_count = 0,
        'processed_count', v_processed_count,
        'error_count', v_error_count,
        'total_count', v_total_count,
        'error_details', v_error_details,
        'message', CASE 
            WHEN v_error_count = 0 THEN 'All rows processed successfully'
            WHEN v_processed_count = 0 THEN 'All rows failed to process'
            ELSE format('Partial success: %s processed, %s failed', v_processed_count, v_error_count)
        END
    );
END;
$$;

-- Create improved stock calculation function with proper date filtering
CREATE OR REPLACE FUNCTION calculate_current_stock(p_item_code text, p_opening_stock_date date DEFAULT '2024-01-01')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_opening_stock numeric := 0;
    v_total_grns numeric := 0;
    v_total_issues numeric := 0;
    v_current_stock numeric := 0;
    v_item_name text;
BEGIN
    -- Get item name
    SELECT item_name INTO v_item_name
    FROM satguru_item_master
    WHERE item_code = p_item_code;
    
    -- Get opening stock
    SELECT COALESCE(qty_received, 0) INTO v_opening_stock
    FROM satguru_grn_log
    WHERE item_code = p_item_code
      AND transaction_type = 'OPENING_STOCK';
    
    -- Get sum of GRNs from opening stock date to now
    SELECT COALESCE(SUM(qty_received), 0) INTO v_total_grns
    FROM satguru_grn_log
    WHERE item_code = p_item_code
      AND transaction_type IN ('REGULAR_GRN', 'RETURN', 'ADJUSTMENT')
      AND date >= p_opening_stock_date;
    
    -- Get sum of Issues from opening stock date to now
    SELECT COALESCE(SUM(qty_issued), 0) INTO v_total_issues
    FROM satguru_issue_log
    WHERE item_code = p_item_code
      AND date >= p_opening_stock_date;
    
    -- Calculate current stock: Opening + GRNs - Issues
    v_current_stock := v_opening_stock + v_total_grns - v_total_issues;
    
    RETURN jsonb_build_object(
        'item_code', p_item_code,
        'item_name', v_item_name,
        'opening_stock', v_opening_stock,
        'total_grns', v_total_grns,
        'total_issues', v_total_issues,
        'current_stock', v_current_stock,
        'calculation_date', CURRENT_DATE,
        'opening_stock_date', p_opening_stock_date
    );
END;
$$;

-- Update validate_issue_batch_all to use proper stock calculation
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
        
        -- Calculate current stock
        v_stock_data := calculate_current_stock(v_item_code);
        
        -- Determine validation status
        IF v_stock_data->>'item_name' IS NULL THEN
            v_validation_status := 'not_found';
            v_error_message := 'Item code not found in master data';
        ELSIF (v_stock_data->>'current_stock')::numeric >= v_qty_issued THEN
            v_validation_status := 'sufficient';
            v_error_message := 'Stock sufficient';
        ELSE
            v_validation_status := 'insufficient_stock';
            v_error_message := format('Insufficient stock. Available: %s, Requested: %s',
                v_stock_data->>'current_stock', v_qty_issued);
        END IF;
        
        -- Add to results
        v_results := v_results || jsonb_build_array(
            jsonb_build_object(
                'row_num', v_row_num,
                'item_code', v_item_code,
                'item_name', COALESCE(v_stock_data->>'item_name', ''),
                'available_qty', COALESCE((v_stock_data->>'current_stock')::numeric, 0),
                'requested_qty', v_qty_issued,
                'validation_status', v_validation_status,
                'error_message', v_error_message
            )
        );
    END LOOP;
    
    RAISE LOG 'Validation complete. Total results: %', jsonb_array_length(v_results);
    
    RETURN v_results;
END;
$$;
