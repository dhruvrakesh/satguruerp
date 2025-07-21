
-- Enhanced process_issue_batch function with better error handling and null checks
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
            
            -- Extract and validate required fields
            v_item_code := v_current_row->>'item_code';
            v_qty_issued := (v_current_row->>'requested_qty')::numeric;
            
            -- Validate required fields
            IF v_item_code IS NULL OR TRIM(v_item_code) = '' THEN
                RAISE EXCEPTION 'Missing item_code in row %', i + 1;
            END IF;
            
            IF v_qty_issued IS NULL OR v_qty_issued <= 0 THEN
                RAISE EXCEPTION 'Invalid qty_issued (%) in row % for item %', v_qty_issued, i + 1, v_item_code;
            END IF;
            
            -- Verify item exists and has sufficient stock
            IF NOT EXISTS (
                SELECT 1 FROM satguru_item_master 
                WHERE item_code = v_item_code
            ) THEN
                RAISE EXCEPTION 'Item % not found in master data', v_item_code;
            END IF;
            
            -- Check current stock
            IF NOT EXISTS (
                SELECT 1 FROM satguru_stock 
                WHERE item_code = v_item_code 
                AND current_qty >= v_qty_issued
            ) THEN
                RAISE EXCEPTION 'Insufficient stock for item %. Required: %, Available: %', 
                    v_item_code, v_qty_issued, 
                    COALESCE((SELECT current_qty FROM satguru_stock WHERE item_code = v_item_code), 0);
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
            
            -- Update stock
            UPDATE satguru_stock 
            SET 
                current_qty = current_qty - v_qty_issued,
                last_updated = NOW()
            WHERE item_code = v_item_code;
            
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
