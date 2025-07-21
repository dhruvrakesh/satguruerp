-- Final trigger creation fix
DROP TRIGGER IF EXISTS satguru_grn_stock_update ON satguru_grn_log;
DROP TRIGGER IF EXISTS satguru_issue_stock_update ON satguru_issue_log;

-- Recreate trigger functions to ensure they exist
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

-- Create triggers with explicit schema references
CREATE TRIGGER satguru_grn_stock_update
    AFTER INSERT ON public.satguru_grn_log
    FOR EACH ROW
    EXECUTE FUNCTION public.satguru_update_stock_on_grn();

CREATE TRIGGER satguru_issue_stock_update
    AFTER INSERT ON public.satguru_issue_log
    FOR EACH ROW
    EXECUTE FUNCTION public.satguru_update_stock_on_issue();