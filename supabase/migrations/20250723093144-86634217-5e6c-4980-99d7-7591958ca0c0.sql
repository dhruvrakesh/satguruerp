
-- Phase 1: Fix Critical Database Value Integration
-- Create enhanced category value calculation function
CREATE OR REPLACE FUNCTION calculate_enhanced_category_values()
RETURNS TABLE(
    category_id uuid,
    category_name text,
    total_items bigint,
    active_items bigint,
    fg_items bigint,
    rm_items bigint,
    packaging_items bigint,
    consumable_items bigint,
    last_item_added timestamp with time zone,
    avg_item_value numeric,
    total_category_value numeric,
    pricing_data_coverage numeric
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH category_item_counts AS (
        SELECT 
            c.id as category_id,
            c.category_name,
            COUNT(im.item_code) as total_items,
            COUNT(CASE WHEN im.is_active = true THEN 1 END) as active_items,
            COUNT(CASE WHEN im.usage_type = 'FG' THEN 1 END) as fg_items,
            COUNT(CASE WHEN im.usage_type = 'RM' THEN 1 END) as rm_items,
            COUNT(CASE WHEN im.usage_type = 'PACKAGING' THEN 1 END) as packaging_items,
            COUNT(CASE WHEN im.usage_type = 'CONSUMABLE' THEN 1 END) as consumable_items,
            MAX(im.created_at) as last_item_added
        FROM categories c
        LEFT JOIN satguru_item_master im ON c.id = im.category_id
        WHERE c.is_active = true
        GROUP BY c.id, c.category_name
    ),
    category_pricing AS (
        SELECT 
            c.id as category_id,
            -- Enhanced pricing calculation with fallbacks
            AVG(COALESCE(
                ipm.current_price,
                -- Fallback to latest GRN price
                (SELECT g.rate FROM satguru_grn_log g 
                 WHERE g.item_code = im.item_code 
                 ORDER BY g.date DESC LIMIT 1),
                -- Fallback to unit cost if available
                im.unit_cost,
                0
            )) as avg_item_value,
            SUM(COALESCE(
                ipm.current_price,
                (SELECT g.rate FROM satguru_grn_log g 
                 WHERE g.item_code = im.item_code 
                 ORDER BY g.date DESC LIMIT 1),
                im.unit_cost,
                0
            )) as total_category_value,
            -- Calculate pricing data coverage
            (COUNT(CASE WHEN ipm.current_price IS NOT NULL OR im.unit_cost IS NOT NULL THEN 1 END)::numeric / 
             NULLIF(COUNT(im.item_code), 0) * 100) as pricing_coverage
        FROM categories c
        LEFT JOIN satguru_item_master im ON c.id = im.category_id
        LEFT JOIN item_pricing_master ipm ON im.item_code = ipm.item_code 
            AND ipm.is_active = true 
            AND ipm.approval_status = 'APPROVED'
        WHERE c.is_active = true
        GROUP BY c.id
    )
    SELECT 
        cic.category_id,
        cic.category_name,
        cic.total_items,
        cic.active_items,
        cic.fg_items,
        cic.rm_items,
        cic.packaging_items,
        cic.consumable_items,
        cic.last_item_added,
        COALESCE(cp.avg_item_value, 0) as avg_item_value,
        COALESCE(cp.total_category_value, 0) as total_category_value,
        COALESCE(cp.pricing_coverage, 0) as pricing_data_coverage
    FROM category_item_counts cic
    LEFT JOIN category_pricing cp ON cic.category_id = cp.category_id
    ORDER BY cic.category_name;
END;
$$;

-- Drop and recreate the materialized view with enhanced calculations
DROP MATERIALIZED VIEW IF EXISTS category_stats_mv;
CREATE MATERIALIZED VIEW category_stats_mv AS
SELECT * FROM calculate_enhanced_category_values();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_category_stats_mv_category_id ON category_stats_mv(category_id);
CREATE INDEX IF NOT EXISTS idx_category_stats_mv_avg_value ON category_stats_mv(avg_item_value DESC);
CREATE INDEX IF NOT EXISTS idx_category_stats_mv_total_items ON category_stats_mv(total_items DESC);

-- Create function to refresh category stats
CREATE OR REPLACE FUNCTION refresh_category_stats() 
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW category_stats_mv;
END;
$$;

-- Create triggers to auto-refresh when pricing data changes
CREATE OR REPLACE FUNCTION trigger_category_stats_refresh()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM refresh_category_stats();
    RETURN NULL;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS item_pricing_refresh_trigger ON item_pricing_master;
DROP TRIGGER IF EXISTS item_master_refresh_trigger ON satguru_item_master;
DROP TRIGGER IF EXISTS grn_log_refresh_trigger ON satguru_grn_log;

-- Create triggers for real-time updates
CREATE TRIGGER item_pricing_refresh_trigger
    AFTER INSERT OR UPDATE OR DELETE ON item_pricing_master
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_category_stats_refresh();

CREATE TRIGGER item_master_refresh_trigger
    AFTER INSERT OR UPDATE OR DELETE ON satguru_item_master
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_category_stats_refresh();

CREATE TRIGGER grn_log_refresh_trigger
    AFTER INSERT OR UPDATE ON satguru_grn_log
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_category_stats_refresh();

-- Enhanced bulk update categories function
CREATE OR REPLACE FUNCTION bulk_update_categories(p_operations jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_operation jsonb;
    v_success_count integer := 0;
    v_error_count integer := 0;
    v_errors jsonb := '[]'::jsonb;
    v_total_count integer;
    v_category_id uuid;
    v_error_message text;
BEGIN
    v_total_count := jsonb_array_length(p_operations);
    
    FOR i IN 0..v_total_count-1 LOOP
        BEGIN
            v_operation := p_operations->i;
            v_category_id := (v_operation->>'id')::uuid;
            
            CASE v_operation->>'action'
                WHEN 'UPDATE' THEN
                    UPDATE satguru_categories 
                    SET 
                        category_name = COALESCE(v_operation->>'category_name', category_name),
                        description = COALESCE(v_operation->>'description', description),
                        is_active = COALESCE((v_operation->>'is_active')::boolean, is_active),
                        updated_at = now()
                    WHERE id = v_category_id;
                    
                WHEN 'DELETE' THEN
                    UPDATE satguru_categories 
                    SET is_active = false, updated_at = now()
                    WHERE id = v_category_id;
                    
                WHEN 'ACTIVATE' THEN
                    UPDATE satguru_categories 
                    SET is_active = true, updated_at = now()
                    WHERE id = v_category_id;
                    
                WHEN 'DEACTIVATE' THEN
                    UPDATE satguru_categories 
                    SET is_active = false, updated_at = now()
                    WHERE id = v_category_id;
                    
                ELSE
                    RAISE EXCEPTION 'Unknown action: %', v_operation->>'action';
            END CASE;
            
            v_success_count := v_success_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            v_error_message := SQLERRM;
            
            v_errors := v_errors || jsonb_build_array(
                jsonb_build_object(
                    'operation_index', i,
                    'category_id', v_category_id,
                    'action', v_operation->>'action',
                    'error_message', v_error_message
                )
            );
        END;
    END LOOP;
    
    -- Refresh category stats after bulk operations
    PERFORM refresh_category_stats();
    
    RETURN jsonb_build_object(
        'success', v_success_count,
        'failed', v_error_count,
        'errors', v_errors,
        'total_operations', v_total_count
    );
END;
$$;

-- Create category validation function
CREATE OR REPLACE FUNCTION validate_category_data(
    p_category_name text,
    p_category_code text DEFAULT NULL,
    p_parent_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_errors text[] := '{}';
    v_exists boolean;
BEGIN
    -- Validate category name
    IF p_category_name IS NULL OR trim(p_category_name) = '' THEN
        v_errors := array_append(v_errors, 'Category name is required');
    END IF;
    
    -- Check for duplicate category name
    SELECT EXISTS(
        SELECT 1 FROM satguru_categories 
        WHERE category_name = p_category_name 
        AND is_active = true
    ) INTO v_exists;
    
    IF v_exists THEN
        v_errors := array_append(v_errors, 'Category name already exists');
    END IF;
    
    -- Check for duplicate category code if provided
    IF p_category_code IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM satguru_categories 
            WHERE category_code = p_category_code 
            AND is_active = true
        ) INTO v_exists;
        
        IF v_exists THEN
            v_errors := array_append(v_errors, 'Category code already exists');
        END IF;
    END IF;
    
    -- Validate parent category exists if provided
    IF p_parent_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM satguru_categories 
            WHERE id = p_parent_id 
            AND is_active = true
        ) INTO v_exists;
        
        IF NOT v_exists THEN
            v_errors := array_append(v_errors, 'Parent category not found');
        END IF;
    END IF;
    
    RETURN jsonb_build_object(
        'valid', array_length(v_errors, 1) IS NULL,
        'errors', v_errors
    );
END;
$$;

-- Initial refresh of the materialized view
REFRESH MATERIALIZED VIEW category_stats_mv;
