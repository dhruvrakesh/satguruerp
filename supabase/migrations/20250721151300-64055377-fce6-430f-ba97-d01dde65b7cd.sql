
-- Emergency Stock Calculation Crisis Resolution Plan
-- Phase 1: Complete Database Foundation Rebuild

-- Step 1: Drop and recreate the broken triggers and functions
DROP TRIGGER IF EXISTS satguru_grn_stock_update ON satguru_grn_log;
DROP TRIGGER IF EXISTS satguru_issue_stock_update ON satguru_issue_log;
DROP FUNCTION IF EXISTS satguru_update_stock_on_grn();
DROP FUNCTION IF EXISTS satguru_update_stock_on_issue();

-- Step 2: Create corrected GRN trigger function that handles opening stock properly
CREATE OR REPLACE FUNCTION satguru_update_stock_on_grn() 
RETURNS trigger 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only update stock for operational GRNs, not opening stock entries
    IF NEW.transaction_type IN ('REGULAR_GRN', 'RETURN', 'ADJUSTMENT') OR NEW.transaction_type IS NULL THEN
        INSERT INTO public.satguru_stock (item_code, current_qty, last_updated)
        VALUES (NEW.item_code, NEW.qty_received, now())
        ON CONFLICT (item_code)
        DO UPDATE SET 
            current_qty = satguru_stock.current_qty + NEW.qty_received,
            last_updated = now();
    END IF;
    
    RETURN NEW;
END;
$$;

-- Step 3: Create corrected Issue trigger function
CREATE OR REPLACE FUNCTION satguru_update_stock_on_issue() 
RETURNS trigger 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update stock by subtracting issued quantity
    UPDATE public.satguru_stock 
    SET 
        current_qty = current_qty - NEW.qty_issued,
        last_updated = now()
    WHERE item_code = NEW.item_code;
    
    -- If item doesn't exist in stock table, create it with negative quantity
    -- This handles edge cases where issues happen before any GRNs
    INSERT INTO public.satguru_stock (item_code, current_qty, last_updated)
    SELECT NEW.item_code, -NEW.qty_issued, now()
    WHERE NOT EXISTS (
        SELECT 1 FROM public.satguru_stock WHERE item_code = NEW.item_code
    );
    
    RETURN NEW;
END;
$$;

-- Step 4: Recreate the triggers
CREATE TRIGGER satguru_grn_stock_update
    AFTER INSERT ON public.satguru_grn_log
    FOR EACH ROW
    EXECUTE FUNCTION public.satguru_update_stock_on_grn();

CREATE TRIGGER satguru_issue_stock_update
    AFTER INSERT ON public.satguru_issue_log
    FOR EACH ROW
    EXECUTE FUNCTION public.satguru_update_stock_on_issue();

-- Step 5: Completely rebuild the satguru_stock table with correct calculations
-- First, clear the corrupted data
TRUNCATE TABLE public.satguru_stock;

-- Rebuild with accurate calculations: Opening Stock + GRNs - Issues
INSERT INTO public.satguru_stock (item_code, current_qty, last_updated)
SELECT 
    im.item_code,
    COALESCE(opening.qty, 0) + COALESCE(grns.qty, 0) - COALESCE(issues.qty, 0) as calculated_stock,
    GREATEST(
        COALESCE(grns.last_date, '1900-01-01'::date),
        COALESCE(issues.last_date, '1900-01-01'::date),
        CURRENT_DATE
    )::timestamp with time zone as last_updated
FROM satguru_item_master im
LEFT JOIN (
    -- Opening stock from transaction_type = 'OPENING_STOCK'
    SELECT item_code, SUM(qty_received) as qty
    FROM satguru_grn_log 
    WHERE transaction_type = 'OPENING_STOCK'
    GROUP BY item_code
) opening ON im.item_code = opening.item_code
LEFT JOIN (
    -- Regular GRNs (excluding opening stock)
    SELECT 
        item_code, 
        SUM(qty_received) as qty,
        MAX(date) as last_date
    FROM satguru_grn_log 
    WHERE transaction_type IS NULL OR transaction_type != 'OPENING_STOCK'
    GROUP BY item_code
) grns ON im.item_code = grns.item_code
LEFT JOIN (
    -- All issues
    SELECT 
        item_code, 
        SUM(qty_issued) as qty,
        MAX(date) as last_date
    FROM satguru_issue_log 
    GROUP BY item_code
) issues ON im.item_code = issues.item_code
WHERE im.is_active = true;

-- Step 6: Update the satguru_stock_summary_view to use corrected calculations
DROP VIEW IF EXISTS satguru_stock_summary_view;

CREATE VIEW satguru_stock_summary_view AS
SELECT 
    im.item_code,
    im.item_name,
    COALESCE(im.uom, 'KG') as uom,
    COALESCE(im.usage_type, 'FINISHED_GOOD') as category_name,
    COALESCE(im.category_id::text, '') as category_id,
    COALESCE(im.reorder_level, 0) as reorder_level,
    
    -- Use the corrected stock table values
    COALESCE(s.current_qty, 0) as current_qty,
    COALESCE(s.last_updated, CURRENT_DATE::text) as last_updated,
    
    -- Calculate metrics from transaction logs
    COALESCE(opening.opening_stock, 0) as opening_stock,
    COALESCE(grns.total_grns, 0) as total_grns,
    COALESCE(issues.total_issues, 0) as total_issues,
    COALESCE(grns.received_30_days, 0) as received_30_days,
    COALESCE(issues.consumption_30_days, 0) as consumption_30_days,
    
    -- Stock status based on corrected values
    CASE 
        WHEN COALESCE(s.current_qty, 0) <= 0 THEN 'out_of_stock'
        WHEN COALESCE(s.current_qty, 0) <= COALESCE(im.reorder_level, 0) THEN 'low_stock'
        WHEN COALESCE(s.current_qty, 0) > (COALESCE(im.reorder_level, 0) * 3) THEN 'overstock'
        ELSE 'normal'
    END as stock_status
    
FROM satguru_item_master im
LEFT JOIN satguru_stock s ON im.item_code = s.item_code
LEFT JOIN (
    SELECT item_code, SUM(qty_received) as opening_stock
    FROM satguru_grn_log 
    WHERE transaction_type = 'OPENING_STOCK'
    GROUP BY item_code
) opening ON im.item_code = opening.item_code
LEFT JOIN (
    SELECT 
        item_code, 
        SUM(qty_received) as total_grns,
        SUM(CASE WHEN date >= (CURRENT_DATE - INTERVAL '30 days') THEN qty_received ELSE 0 END) as received_30_days
    FROM satguru_grn_log 
    WHERE transaction_type IS NULL OR transaction_type != 'OPENING_STOCK'
    GROUP BY item_code
) grns ON im.item_code = grns.item_code
LEFT JOIN (
    SELECT 
        item_code, 
        SUM(qty_issued) as total_issues,
        SUM(CASE WHEN date >= (CURRENT_DATE - INTERVAL '30 days') THEN qty_issued ELSE 0 END) as consumption_30_days
    FROM satguru_issue_log 
    GROUP BY item_code
) issues ON im.item_code = issues.item_code
WHERE im.is_active = true;

-- Step 7: Verification queries to confirm the fix
-- Check that LDPELAM_MILKY_815_25 now shows +358 instead of -784
SELECT 
    'CRITICAL_ITEM_VERIFICATION' as check_type,
    item_code,
    current_qty,
    opening_stock,
    total_grns,
    total_issues,
    stock_status
FROM satguru_stock_summary_view 
WHERE item_code = 'LDPELAM_MILKY_815_25';

-- Verify no negative stock items remain
SELECT 
    'NEGATIVE_STOCK_CHECK' as check_type,
    COUNT(*) as negative_items,
    MIN(current_qty) as lowest_value,
    MAX(current_qty) as highest_value
FROM satguru_stock_summary_view 
WHERE current_qty < 0;

-- Show the most problematic items that were fixed
SELECT 
    'TOP_FIXED_ITEMS' as check_type,
    item_code,
    current_qty,
    stock_status
FROM satguru_stock_summary_view 
WHERE item_code IN ('LDPELAM_MILKY_815_25', 'HDPELAM_CLEAR_700_25', 'LDPELAM_CLEAR_860_25')
ORDER BY item_code;
