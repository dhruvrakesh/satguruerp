-- CORRECTED VIEW: Fix the status filter 
DROP VIEW IF EXISTS satguru_stock_summary_view;

CREATE VIEW satguru_stock_summary_view AS
SELECT 
    im.item_code,
    im.item_name,
    COALESCE(im.uom, 'KG') as uom,
    COALESCE(im.usage_type, 'FINISHED_GOOD') as category_name,
    COALESCE(im.category_id::text, '') as category_id,
    0 as reorder_level,
    
    -- CRITICAL FIX: Calculate current_qty directly from transactions
    COALESCE(opening.opening_stock, 0) + COALESCE(grns.total_grns, 0) - COALESCE(issues.total_issues, 0) as current_qty,
    COALESCE(GREATEST(grns.last_grn_date, issues.last_issue_date), CURRENT_DATE) as last_updated,
    
    -- Calculate metrics from transaction logs
    COALESCE(opening.opening_stock, 0) as opening_stock,
    COALESCE(grns.total_grns, 0) as total_grns,
    COALESCE(issues.total_issues, 0) as total_issues,
    COALESCE(grns.received_30_days, 0) as received_30_days,
    COALESCE(issues.consumption_30_days, 0) as consumption_30_days,
    
    -- Stock status based on CORRECTED calculations
    CASE 
        WHEN (COALESCE(opening.opening_stock, 0) + COALESCE(grns.total_grns, 0) - COALESCE(issues.total_issues, 0)) <= 0 THEN 'out_of_stock'
        WHEN (COALESCE(opening.opening_stock, 0) + COALESCE(grns.total_grns, 0) - COALESCE(issues.total_issues, 0)) <= 50 THEN 'low_stock'
        WHEN (COALESCE(opening.opening_stock, 0) + COALESCE(grns.total_grns, 0) - COALESCE(issues.total_issues, 0)) > 1000 THEN 'overstock'
        ELSE 'normal'
    END as stock_status
    
FROM satguru_item_master im
LEFT JOIN (
    SELECT 
        item_code, 
        SUM(qty_received) as opening_stock
    FROM satguru_grn_log 
    WHERE transaction_type = 'OPENING_STOCK'
    GROUP BY item_code
) opening ON im.item_code = opening.item_code
LEFT JOIN (
    SELECT 
        item_code, 
        SUM(qty_received) as total_grns,
        SUM(CASE WHEN date >= (CURRENT_DATE - INTERVAL '30 days') THEN qty_received ELSE 0 END) as received_30_days,
        MAX(date)::timestamp with time zone as last_grn_date
    FROM satguru_grn_log 
    WHERE transaction_type IS NULL OR transaction_type != 'OPENING_STOCK'
    GROUP BY item_code
) grns ON im.item_code = grns.item_code
LEFT JOIN (
    SELECT 
        item_code, 
        SUM(qty_issued) as total_issues,
        SUM(CASE WHEN date >= (CURRENT_DATE - INTERVAL '30 days') THEN qty_issued ELSE 0 END) as consumption_30_days,
        MAX(date)::timestamp with time zone as last_issue_date
    FROM satguru_issue_log 
    GROUP BY item_code
) issues ON im.item_code = issues.item_code
WHERE im.status = 'active' OR im.status IS NULL;

-- Final verification
SELECT 
    'FINAL_SUCCESS_CHECK' as status,
    item_code,
    current_qty,
    opening_stock,
    total_grns,
    total_issues,
    stock_status
FROM satguru_stock_summary_view 
WHERE item_code = 'LDPELAM_MILKY_815_25';