
-- Phase 1: Fix Unique Identifier Throughout Project (Database Level)

-- Add composite unique constraints for GRN records
ALTER TABLE public.satguru_grn_log 
ADD CONSTRAINT unique_grn_item_combo UNIQUE (grn_number, item_code);

-- Add composite unique constraints for Issue records  
ALTER TABLE public.satguru_issue_log 
ADD CONSTRAINT unique_issue_item_combo UNIQUE (id, item_code);

-- Create function to check for duplicate bulk uploads
CREATE OR REPLACE FUNCTION public.check_duplicate_bulk_upload(
    p_items jsonb,
    p_upload_type text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item jsonb;
    v_duplicates jsonb := '[]'::jsonb;
    v_item_code text;
    v_grn_number text;
    v_duplicate_count integer;
    v_total_checked integer := 0;
    v_total_duplicates integer := 0;
BEGIN
    -- Check each item for duplicates
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_code := v_item->>'item_code';
        v_total_checked := v_total_checked + 1;
        
        IF p_upload_type = 'GRN' THEN
            v_grn_number := v_item->>'grn_number';
            
            -- Check if GRN + item_code combination already exists
            SELECT COUNT(*) INTO v_duplicate_count
            FROM public.satguru_grn_log
            WHERE grn_number = v_grn_number AND item_code = v_item_code;
            
            IF v_duplicate_count > 0 THEN
                v_duplicates := v_duplicates || jsonb_build_array(
                    jsonb_build_object(
                        'item_code', v_item_code,
                        'grn_number', v_grn_number,
                        'duplicate_type', 'GRN_ITEM_EXISTS',
                        'existing_records', v_duplicate_count
                    )
                );
                v_total_duplicates := v_total_duplicates + 1;
            END IF;
            
        ELSIF p_upload_type = 'ISSUE' THEN
            -- For issues, check if similar recent issue exists (within 24 hours)
            SELECT COUNT(*) INTO v_duplicate_count
            FROM public.satguru_issue_log
            WHERE item_code = v_item_code
              AND date >= (v_item->>'date')::date - INTERVAL '1 day'
              AND date <= (v_item->>'date')::date + INTERVAL '1 day'
              AND qty_issued = (v_item->>'qty_issued')::numeric;
            
            IF v_duplicate_count > 0 THEN
                v_duplicates := v_duplicates || jsonb_build_array(
                    jsonb_build_object(
                        'item_code', v_item_code,
                        'date', v_item->>'date',
                        'qty_issued', v_item->>'qty_issued',
                        'duplicate_type', 'SIMILAR_ISSUE_EXISTS',
                        'existing_records', v_duplicate_count
                    )
                );
                v_total_duplicates := v_total_duplicates + 1;
            END IF;
        END IF;
    END LOOP;
    
    -- Return comprehensive duplicate report
    RETURN jsonb_build_object(
        'total_checked', v_total_checked,
        'total_duplicates', v_total_duplicates,
        'has_duplicates', v_total_duplicates > 0,
        'duplicates', v_duplicates,
        'upload_type', p_upload_type,
        'check_timestamp', now()
    );
END;
$$;

-- Fix calculate_current_stock to never return NULL
CREATE OR REPLACE FUNCTION public.calculate_current_stock(
    p_item_code text, 
    p_opening_stock_date date DEFAULT '2024-01-01'::date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_opening_stock numeric := 0;
    v_total_grns numeric := 0;
    v_total_issues numeric := 0;
    v_current_stock numeric := 0;
    v_item_name text := '';
    v_has_explicit_opening boolean := false;
BEGIN
    -- Get item name from master data - ensure never NULL
    SELECT COALESCE(item_name, '') INTO v_item_name
    FROM satguru_item_master
    WHERE item_code = p_item_code;
    
    -- If item not found in master, return explicit error
    IF v_item_name = '' THEN
        RETURN jsonb_build_object(
            'item_code', p_item_code,
            'item_name', 'ITEM_NOT_FOUND',
            'opening_stock', 0,
            'total_grns', 0,
            'total_issues', 0,
            'current_stock', 0,
            'calculation_date', CURRENT_DATE,
            'opening_stock_date', p_opening_stock_date,
            'has_explicit_opening', false,
            'error', 'Item code not found in master data'
        );
    END IF;
    
    -- Check if there's an explicit opening stock record
    SELECT COALESCE(qty_received, 0), true INTO v_opening_stock, v_has_explicit_opening
    FROM satguru_grn_log
    WHERE item_code = p_item_code
      AND transaction_type = 'OPENING_STOCK'
    LIMIT 1;
    
    -- If no explicit opening stock found, check for earliest GRN before opening date
    IF NOT v_has_explicit_opening THEN
        SELECT COALESCE(SUM(qty_received), 0) INTO v_opening_stock
        FROM satguru_grn_log
        WHERE item_code = p_item_code
          AND date < p_opening_stock_date
          AND transaction_type IN ('REGULAR_GRN', 'RETURN', 'ADJUSTMENT');
    END IF;
    
    -- Get sum of GRNs from opening stock date to now (excluding opening stock records)
    SELECT COALESCE(SUM(qty_received), 0) INTO v_total_grns
    FROM satguru_grn_log
    WHERE item_code = p_item_code
      AND date >= p_opening_stock_date
      AND transaction_type IN ('REGULAR_GRN', 'RETURN', 'ADJUSTMENT');
    
    -- Get sum of Issues from opening stock date to now
    SELECT COALESCE(SUM(qty_issued), 0) INTO v_total_issues
    FROM satguru_issue_log
    WHERE item_code = p_item_code
      AND date >= p_opening_stock_date;
    
    -- Calculate current stock: Opening + GRNs - Issues (ensure never NULL)
    v_current_stock := COALESCE(v_opening_stock, 0) + COALESCE(v_total_grns, 0) - COALESCE(v_total_issues, 0);
    
    -- Log calculation for debugging
    RAISE LOG 'Stock calculation for %: Opening=%, GRNs=%, Issues=%, Current=%', 
        p_item_code, v_opening_stock, v_total_grns, v_total_issues, v_current_stock;
    
    -- Return the result (ensure all fields are non-NULL)
    RETURN jsonb_build_object(
        'item_code', p_item_code,
        'item_name', COALESCE(v_item_name, ''),
        'opening_stock', COALESCE(v_opening_stock, 0),
        'total_grns', COALESCE(v_total_grns, 0),
        'total_issues', COALESCE(v_total_issues, 0),
        'current_stock', COALESCE(v_current_stock, 0),
        'calculation_date', CURRENT_DATE,
        'opening_stock_date', p_opening_stock_date,
        'has_explicit_opening', COALESCE(v_has_explicit_opening, false),
        'error', NULL
    );
END;
$$;

-- Update validate_issue_batch_all to use composite keys and better error handling
CREATE OR REPLACE FUNCTION public.validate_issue_batch_all(p_items jsonb)
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
    v_composite_key text;
BEGIN
    v_total_items := jsonb_array_length(p_items);
    
    RAISE LOG 'Starting validation for % items', v_total_items;
    
    -- Process each item
    FOR i IN 0..v_total_items-1 LOOP
        v_item := p_items->i;
        v_item_code := v_item->>'item_code';
        v_qty_issued := COALESCE((v_item->>'qty_issued')::numeric, (v_item->>'requested_qty')::numeric, 0);
        v_row_num := COALESCE((v_item->>'row_num')::integer, i + 1);
        
        -- Create composite key for tracking
        v_composite_key := 'ISSUE_' || v_row_num || '_' || COALESCE(v_item_code, 'UNKNOWN');
        
        -- Skip if no item code
        IF v_item_code IS NULL OR TRIM(v_item_code) = '' THEN
            v_results := v_results || jsonb_build_array(
                jsonb_build_object(
                    'composite_key', v_composite_key,
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
        
        -- Get stock data using the fixed calculate_current_stock function
        v_stock_data := calculate_current_stock(v_item_code);
        
        -- Extract values with proper NULL handling
        v_current_stock := COALESCE((v_stock_data->>'current_stock')::numeric, 0);
        v_item_name := COALESCE(v_stock_data->>'item_name', '');
        
        -- Check if item was found
        IF v_stock_data->>'error' IS NOT NULL THEN
            v_validation_status := 'not_found';
            v_error_message := v_stock_data->>'error';
        ELSIF v_current_stock >= v_qty_issued THEN
            v_validation_status := 'sufficient';
            v_error_message := format('Stock sufficient. Available: %s KG', v_current_stock);
        ELSE
            v_validation_status := 'insufficient_stock';
            v_error_message := format('Insufficient stock. Available: %s KG, Requested: %s KG, Short by: %s KG',
                v_current_stock, v_qty_issued, v_qty_issued - v_current_stock);
        END IF;
        
        -- Add to results with composite key
        v_results := v_results || jsonb_build_array(
            jsonb_build_object(
                'composite_key', v_composite_key,
                'row_num', v_row_num,
                'item_code', v_item_code,
                'item_name', v_item_name,
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

-- Create function to generate retry-ready CSV for failed records
CREATE OR REPLACE FUNCTION public.generate_retry_ready_csv(
    p_validation_results jsonb,
    p_original_csv_data jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_retry_records jsonb := '[]'::jsonb;
    v_result jsonb;
    v_original_record jsonb;
    v_row_num integer;
    v_retry_count integer := 0;
BEGIN
    -- Process each validation result
    FOR v_result IN SELECT * FROM jsonb_array_elements(p_validation_results) LOOP
        -- Only include records that have errors (not sufficient)
        IF (v_result->>'validation_status') != 'sufficient' THEN
            v_row_num := (v_result->>'row_num')::integer;
            
            -- Find corresponding original record
            SELECT * INTO v_original_record
            FROM jsonb_array_elements(p_original_csv_data) WITH ORDINALITY AS t(item, row_index)
            WHERE row_index = v_row_num;
            
            IF v_original_record IS NOT NULL THEN
                -- Add error details to original record
                v_retry_records := v_retry_records || jsonb_build_array(
                    v_original_record || jsonb_build_object(
                        'validation_error', v_result->>'error_message',
                        'validation_status', v_result->>'validation_status',
                        'available_qty', v_result->>'available_qty'
                    )
                );
                v_retry_count := v_retry_count + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'retry_records', v_retry_records,
        'retry_count', v_retry_count,
        'total_validated', jsonb_array_length(p_validation_results),
        'generated_at', now()
    );
END;
$$;
