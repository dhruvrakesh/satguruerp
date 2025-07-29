-- Fix the generate_po_number function to properly handle the unique constraint on (fiscal_year, prefix)
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    next_sequence integer;
    po_number text;
    current_fiscal_year integer;
    po_prefix text := 'PO';
BEGIN
    -- Get current fiscal year as integer (April to March)
    IF EXTRACT(MONTH FROM NOW()) >= 4 THEN
        current_fiscal_year := EXTRACT(YEAR FROM NOW())::integer;
    ELSE
        current_fiscal_year := (EXTRACT(YEAR FROM NOW()) - 1)::integer;
    END IF;
    
    -- Try to update existing sequence for current fiscal year and prefix
    UPDATE public.purchase_order_sequences 
    SET last_sequence = purchase_order_sequences.last_sequence + 1
    WHERE purchase_order_sequences.fiscal_year = current_fiscal_year 
      AND purchase_order_sequences.prefix = po_prefix
    RETURNING purchase_order_sequences.last_sequence INTO next_sequence;
    
    -- If no row was updated (fiscal year + prefix combination doesn't exist), initialize it
    IF next_sequence IS NULL THEN
        INSERT INTO public.purchase_order_sequences (fiscal_year, prefix, last_sequence)
        VALUES (current_fiscal_year, po_prefix, 1)
        ON CONFLICT (fiscal_year, prefix) DO UPDATE SET 
            last_sequence = purchase_order_sequences.last_sequence + 1
        RETURNING last_sequence INTO next_sequence;
    END IF;
    
    -- Generate PO number with format PO-YYYY-NNNN
    po_number := po_prefix || '-' || current_fiscal_year::text || '-' || LPAD(next_sequence::text, 4, '0');
    
    RETURN po_number;
END;
$function$;