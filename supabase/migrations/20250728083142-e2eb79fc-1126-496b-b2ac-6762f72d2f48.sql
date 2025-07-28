-- Fix the generate_supplier_code function ambiguous column reference
CREATE OR REPLACE FUNCTION public.generate_supplier_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    next_sequence INTEGER;
    new_supplier_code TEXT;
BEGIN
    -- Get next sequence number
    UPDATE public.supplier_code_sequences 
    SET last_sequence = last_sequence + 1,
        updated_at = NOW()
    RETURNING last_sequence INTO next_sequence;
    
    -- Generate supplier code in format SUP001, SUP002, etc.
    new_supplier_code := 'SUP' || LPAD(next_sequence::TEXT, 3, '0');
    
    -- Ensure uniqueness (in case of manual insertions)
    WHILE EXISTS (SELECT 1 FROM public.suppliers WHERE suppliers.supplier_code = new_supplier_code) LOOP
        UPDATE public.supplier_code_sequences 
        SET last_sequence = last_sequence + 1,
            updated_at = NOW()
        RETURNING last_sequence INTO next_sequence;
        
        new_supplier_code := 'SUP' || LPAD(next_sequence::TEXT, 3, '0');
    END LOOP;
    
    RETURN new_supplier_code;
END;
$function$;