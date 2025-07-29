-- Fix the generate_po_number function to use integer fiscal year to match table schema
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    next_sequence integer;
    po_number text;
    fiscal_year integer;
BEGIN
    -- Get current fiscal year as integer (April to March)
    IF EXTRACT(MONTH FROM NOW()) >= 4 THEN
        fiscal_year := EXTRACT(YEAR FROM NOW())::integer;
    ELSE
        fiscal_year := (EXTRACT(YEAR FROM NOW()) - 1)::integer;
    END IF;
    
    -- Update the sequence counter for current fiscal year
    UPDATE public.purchase_order_sequences 
    SET last_sequence = purchase_order_sequences.last_sequence + 1,
        updated_at = NOW()
    WHERE purchase_order_sequences.fiscal_year = fiscal_year
    RETURNING purchase_order_sequences.last_sequence INTO next_sequence;
    
    -- If no row was updated (fiscal year doesn't exist), initialize it
    IF next_sequence IS NULL THEN
        INSERT INTO public.purchase_order_sequences (fiscal_year, last_sequence, updated_at)
        VALUES (fiscal_year, 1, NOW())
        ON CONFLICT (fiscal_year) DO UPDATE SET 
            last_sequence = 1,
            updated_at = NOW()
        RETURNING last_sequence INTO next_sequence;
    END IF;
    
    -- Generate PO number with format PO-YYYY-NNNN
    po_number := 'PO-' || fiscal_year::text || '-' || LPAD(next_sequence::text, 4, '0');
    
    RETURN po_number;
END;
$function$;