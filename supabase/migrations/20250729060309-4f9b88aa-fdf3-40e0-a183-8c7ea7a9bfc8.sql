-- Fix the generate_supplier_code function to properly update the sequence table
CREATE OR REPLACE FUNCTION public.generate_supplier_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    next_sequence integer;
    supplier_code text;
BEGIN
    -- Update the sequence counter (target the single row with id = 1)
    UPDATE public.supplier_code_sequences 
    SET last_sequence = last_sequence + 1,
        updated_at = NOW()
    WHERE id = 1
    RETURNING last_sequence INTO next_sequence;
    
    -- If no row was updated (table is empty), initialize it
    IF next_sequence IS NULL THEN
        INSERT INTO public.supplier_code_sequences (id, last_sequence, updated_at)
        VALUES (1, 1, NOW())
        ON CONFLICT (id) DO UPDATE SET 
            last_sequence = 1,
            updated_at = NOW()
        RETURNING last_sequence INTO next_sequence;
    END IF;
    
    -- Generate supplier code with format SUP-YYYY-NNNN
    supplier_code := 'SUP-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(next_sequence::text, 4, '0');
    
    RETURN supplier_code;
END;
$function$;