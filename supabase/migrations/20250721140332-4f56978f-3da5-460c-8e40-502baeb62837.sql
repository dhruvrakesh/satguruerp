
-- Create missing triggers for real-time stock updates
-- This will enable automatic stock level updates when GRNs or Issues are inserted

-- Drop existing triggers if they exist to avoid conflicts
DROP TRIGGER IF EXISTS satguru_grn_stock_update ON satguru_grn_log;
DROP TRIGGER IF EXISTS satguru_issue_stock_update ON satguru_issue_log;

-- Drop existing functions to recreate them properly
DROP FUNCTION IF EXISTS satguru_update_stock_on_grn();
DROP FUNCTION IF EXISTS satguru_update_stock_on_issue();

-- Create GRN trigger function
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

-- Create Issue trigger function
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

-- Create the actual triggers
CREATE TRIGGER satguru_grn_stock_update
    AFTER INSERT ON public.satguru_grn_log
    FOR EACH ROW
    EXECUTE FUNCTION public.satguru_update_stock_on_grn();

CREATE TRIGGER satguru_issue_stock_update
    AFTER INSERT ON public.satguru_issue_log
    FOR EACH ROW
    EXECUTE FUNCTION public.satguru_update_stock_on_issue();

-- Verify triggers were created successfully
SELECT 
    schemaname,
    tablename,
    trigname,
    tgtype,
    tgenabled
FROM pg_trigger pt
JOIN pg_class pc ON pt.tgrelid = pc.oid
JOIN pg_namespace pn ON pc.relnamespace = pn.oid
WHERE pn.nspname = 'public'
  AND pc.relname IN ('satguru_grn_log', 'satguru_issue_log')
  AND pt.tgname LIKE 'satguru_%'
ORDER BY tablename, trigname;
