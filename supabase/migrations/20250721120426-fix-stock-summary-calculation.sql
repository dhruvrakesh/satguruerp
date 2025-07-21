
-- Create a new function to get stock summary using accurate calculate_current_stock
CREATE OR REPLACE FUNCTION get_stock_summary_with_calculation(
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0,
    p_search text DEFAULT NULL,
    p_category text DEFAULT NULL,
    p_stock_status text DEFAULT NULL,
    p_min_qty numeric DEFAULT NULL,
    p_max_qty numeric DEFAULT NULL,
    p_opening_stock_date date DEFAULT '2024-01-01'
)
RETURNS TABLE(
    item_code text,
    item_name text,
    category_name text,
    category_id text,
    current_qty numeric,
    received_30_days numeric,
    consumption_30_days numeric,
    reorder_level numeric,
    stock_status text,
    last_updated text,
    opening_stock numeric,
    total_grns numeric,
    total_issues numeric,
    uom text,
    total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_query text;
    v_count_query text;
    v_where_conditions text := '';
    v_total_count bigint;
BEGIN
    -- Build WHERE conditions for filtering
    IF p_search IS NOT NULL AND p_search != '' THEN
        v_where_conditions := v_where_conditions || ' AND (im.item_code ILIKE ''%' || p_search || '%'' OR im.item_name ILIKE ''%' || p_search || '%'')';
    END IF;
    
    IF p_category IS NOT NULL AND p_category != '' AND p_category != 'all' THEN
        v_where_conditions := v_where_conditions || ' AND c.category_name = ''' || p_category || '''';
    END IF;

    -- First get the total count for pagination
    v_count_query := 'SELECT COUNT(*) FROM satguru_item_master im 
                      LEFT JOIN categories c ON im.category_id = c.id 
                      WHERE im.is_active = true' || v_where_conditions;
    
    EXECUTE v_count_query INTO v_total_count;

    -- Build main query with pagination
    v_query := '
    SELECT 
        im.item_code,
        im.item_name,
        COALESCE(c.category_name, ''Uncategorized'') as category_name,
        COALESCE(c.id::text, '''') as category_id,
        im.reorder_level,
        im.uom
    FROM satguru_item_master im
    LEFT JOIN categories c ON im.category_id = c.id
    WHERE im.is_active = true' || v_where_conditions || '
    ORDER BY im.item_code
    LIMIT ' || p_limit || ' OFFSET ' || p_offset;

    -- Return results with calculated stock for each item
    RETURN QUERY
    WITH base_items AS (
        SELECT * FROM (
            SELECT 
                im.item_code,
                im.item_name,
                COALESCE(c.category_name, 'Uncategorized') as category_name,
                COALESCE(c.id::text, '') as category_id,
                im.reorder_level,
                im.uom
            FROM satguru_item_master im
            LEFT JOIN categories c ON im.category_id = c.id
            WHERE im.is_active = true
        ) filtered_items
        WHERE (p_search IS NULL OR p_search = '' OR 
               filtered_items.item_code ILIKE '%' || p_search || '%' OR 
               filtered_items.item_name ILIKE '%' || p_search || '%')
          AND (p_category IS NULL OR p_category = '' OR p_category = 'all' OR 
               filtered_items.category_name = p_category)
        ORDER BY filtered_items.item_code
        LIMIT p_limit OFFSET p_offset
    ),
    stock_calculations AS (
        SELECT 
            bi.*,
            calculate_current_stock(bi.item_code, p_opening_stock_date) as stock_data
        FROM base_items bi
    ),
    enriched_data AS (
        SELECT 
            sc.*,
            COALESCE((sc.stock_data->>'current_stock')::numeric, 0) as calculated_current_qty,
            COALESCE((sc.stock_data->>'opening_stock')::numeric, 0) as calculated_opening_stock,
            COALESCE((sc.stock_data->>'total_grns')::numeric, 0) as calculated_total_grns,
            COALESCE((sc.stock_data->>'total_issues')::numeric, 0) as calculated_total_issues,
            -- Calculate 30-day metrics
            COALESCE((
                SELECT SUM(qty_received) 
                FROM satguru_grn_log 
                WHERE item_code = sc.item_code 
                AND date >= (CURRENT_DATE - INTERVAL '30 days')
            ), 0) as received_30_days,
            COALESCE((
                SELECT SUM(qty_issued) 
                FROM satguru_issue_log 
                WHERE item_code = sc.item_code 
                AND date >= (CURRENT_DATE - INTERVAL '30 days')
            ), 0) as consumption_30_days
        FROM stock_calculations sc
    )
    SELECT 
        ed.item_code,
        ed.item_name,
        ed.category_name,
        ed.category_id,
        ed.calculated_current_qty as current_qty,
        ed.received_30_days,
        ed.consumption_30_days,
        COALESCE(ed.reorder_level, 0) as reorder_level,
        CASE 
            WHEN ed.calculated_current_qty <= 0 THEN 'out_of_stock'
            WHEN ed.calculated_current_qty <= COALESCE(ed.reorder_level, 0) THEN 'low_stock'
            WHEN ed.calculated_current_qty > (COALESCE(ed.reorder_level, 0) * 3) THEN 'overstock'
            ELSE 'normal'
        END as stock_status,
        CURRENT_DATE::text as last_updated,
        ed.calculated_opening_stock as opening_stock,
        ed.calculated_total_grns as total_grns,
        ed.calculated_total_issues as total_issues,
        COALESCE(ed.uom, 'KG') as uom,
        v_total_count as total_count
    FROM enriched_data ed
    WHERE (p_stock_status IS NULL OR p_stock_status = '' OR p_stock_status = 'all' OR 
           CASE 
               WHEN ed.calculated_current_qty <= 0 THEN 'out_of_stock'
               WHEN ed.calculated_current_qty <= COALESCE(ed.reorder_level, 0) THEN 'low_stock'
               WHEN ed.calculated_current_qty > (COALESCE(ed.reorder_level, 0) * 3) THEN 'overstock'
               ELSE 'normal'
           END = p_stock_status)
      AND (p_min_qty IS NULL OR ed.calculated_current_qty >= p_min_qty)
      AND (p_max_qty IS NULL OR ed.calculated_current_qty <= p_max_qty)
    ORDER BY ed.item_code;
END;
$$;
