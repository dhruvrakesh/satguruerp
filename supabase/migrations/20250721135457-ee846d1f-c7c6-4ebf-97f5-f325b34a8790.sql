-- EMERGENCY STOCK CALCULATION RECOVERY PLAN - FINAL FIX
-- Phase 1: Complete database recovery

-- Fix function drop issue first
DROP FUNCTION IF EXISTS public.satguru_validate_stock_transaction(text, text, numeric);

-- Now fix the broken calculate_current_stock function
DROP FUNCTION IF EXISTS public.calculate_current_stock(text, date);

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
    v_item_name text;
    v_has_explicit_opening boolean := false;
BEGIN
    -- Get item name from master data
    SELECT item_name INTO v_item_name
    FROM satguru_item_master
    WHERE item_code = p_item_code;
    
    -- Check if there's an explicit opening stock record
    SELECT COALESCE(qty_received, 0) INTO v_opening_stock
    FROM satguru_grn_log
    WHERE item_code = p_item_code
      AND transaction_type = 'OPENING_STOCK'
    LIMIT 1;
    
    IF v_opening_stock > 0 THEN
        v_has_explicit_opening := true;
    ELSE
        -- If no explicit opening stock found, check for earliest GRN before opening date
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
    
    -- Calculate current stock: Opening + GRNs - Issues
    v_current_stock := COALESCE(v_opening_stock, 0) + COALESCE(v_total_grns, 0) - COALESCE(v_total_issues, 0);
    
    -- Return the result with proper NULL handling
    RETURN jsonb_build_object(
        'item_code', p_item_code,
        'item_name', COALESCE(v_item_name, ''),
        'opening_stock', COALESCE(v_opening_stock, 0),
        'total_grns', COALESCE(v_total_grns, 0),
        'total_issues', COALESCE(v_total_issues, 0),
        'current_stock', COALESCE(v_current_stock, 0),
        'calculation_date', CURRENT_DATE,
        'opening_stock_date', p_opening_stock_date,
        'has_explicit_opening', COALESCE(v_has_explicit_opening, false)
    );
END;
$$;

-- Recalculate and fix all stock levels using direct calculation
WITH stock_calculations AS (
    SELECT 
        im.item_code,
        -- Opening stock (explicit or pre-opening GRNs)
        COALESCE((
            SELECT qty_received 
            FROM satguru_grn_log 
            WHERE item_code = im.item_code 
              AND transaction_type = 'OPENING_STOCK' 
            LIMIT 1
        ), 0) + COALESCE((
            SELECT SUM(qty_received) 
            FROM satguru_grn_log 
            WHERE item_code = im.item_code 
              AND date < '2024-01-01'::date
              AND transaction_type IN ('REGULAR_GRN', 'RETURN', 'ADJUSTMENT')
        ), 0) as opening_stock,
        -- Total GRNs from opening date onwards
        COALESCE((
            SELECT SUM(qty_received) 
            FROM satguru_grn_log 
            WHERE item_code = im.item_code 
              AND date >= '2024-01-01'::date
              AND transaction_type IN ('REGULAR_GRN', 'RETURN', 'ADJUSTMENT')
        ), 0) as total_grns,
        -- Total Issues
        COALESCE((
            SELECT SUM(qty_issued) 
            FROM satguru_issue_log 
            WHERE item_code = im.item_code 
              AND date >= '2024-01-01'::date
        ), 0) as total_issues
    FROM satguru_item_master im
)
INSERT INTO satguru_stock (item_code, current_qty, last_updated)
SELECT 
    item_code,
    opening_stock + total_grns - total_issues as current_qty,
    now() as last_updated
FROM stock_calculations
ON CONFLICT (item_code) 
DO UPDATE SET 
    current_qty = EXCLUDED.current_qty,
    last_updated = now();

-- Create the missing triggers for real-time updates
CREATE OR REPLACE FUNCTION satguru_update_stock_on_grn() 
RETURNS trigger 
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.satguru_stock (item_code, current_qty, last_updated)
    VALUES (NEW.item_code, NEW.qty_received, now())
    ON CONFLICT (item_code)
    DO UPDATE SET 
        current_qty = satguru_stock.current_qty + NEW.qty_received,
        last_updated = now();
    
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION satguru_update_stock_on_issue() 
RETURNS trigger 
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.satguru_stock 
    SET 
        current_qty = current_qty - NEW.qty_issued,
        last_updated = now()
    WHERE item_code = NEW.item_code;
    
    RETURN NEW;
END;
$$;

-- Create the actual triggers
DROP TRIGGER IF EXISTS satguru_grn_stock_update ON satguru_grn_log;
CREATE TRIGGER satguru_grn_stock_update
    AFTER INSERT ON satguru_grn_log
    FOR EACH ROW
    EXECUTE FUNCTION satguru_update_stock_on_grn();

DROP TRIGGER IF EXISTS satguru_issue_stock_update ON satguru_issue_log;
CREATE TRIGGER satguru_issue_stock_update
    AFTER INSERT ON satguru_issue_log
    FOR EACH ROW
    EXECUTE FUNCTION satguru_update_stock_on_issue();

-- Rebuild the stock summary view with proper data
DROP VIEW IF EXISTS satguru_stock_summary_view;
CREATE VIEW satguru_stock_summary_view AS
SELECT 
    s.item_code,
    im.item_name,
    s.current_qty,
    s.last_updated,
    im.uom,
    im.usage_type as category_name,
    im.category_id,
    0 as reorder_level,
    -- Calculate opening stock properly
    COALESCE((
        SELECT qty_received 
        FROM satguru_grn_log 
        WHERE item_code = s.item_code 
          AND transaction_type = 'OPENING_STOCK' 
        LIMIT 1
    ), 0) as opening_stock,
    -- Calculate total GRNs
    COALESCE((
        SELECT SUM(qty_received) 
        FROM satguru_grn_log 
        WHERE item_code = s.item_code 
          AND date >= '2024-01-01'::date
          AND transaction_type IN ('REGULAR_GRN', 'RETURN', 'ADJUSTMENT')
    ), 0) as total_grns,
    -- Calculate total issues
    COALESCE((
        SELECT SUM(qty_issued) 
        FROM satguru_issue_log 
        WHERE item_code = s.item_code 
          AND date >= '2024-01-01'::date
    ), 0) as total_issues,
    -- 30-day metrics
    COALESCE((
        SELECT SUM(qty_received) 
        FROM satguru_grn_log 
        WHERE item_code = s.item_code 
          AND date >= CURRENT_DATE - INTERVAL '30 days'
          AND transaction_type IN ('REGULAR_GRN', 'RETURN', 'ADJUSTMENT')
    ), 0) as received_30_days,
    COALESCE((
        SELECT SUM(qty_issued) 
        FROM satguru_issue_log 
        WHERE item_code = s.item_code 
          AND date >= CURRENT_DATE - INTERVAL '30 days'
    ), 0) as consumption_30_days,
    -- Stock status calculation
    CASE 
        WHEN s.current_qty <= 0 THEN 'out_of_stock'
        WHEN s.current_qty <= 10 THEN 'low_stock'
        WHEN s.current_qty > 1000 THEN 'overstock'
        ELSE 'normal'
    END as stock_status
FROM satguru_stock s
LEFT JOIN satguru_item_master im ON s.item_code = im.item_code;