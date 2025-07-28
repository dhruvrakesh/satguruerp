-- Create supplier code sequences table
CREATE TABLE IF NOT EXISTS public.supplier_code_sequences (
    id SERIAL PRIMARY KEY,
    last_sequence INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial record if not exists
INSERT INTO public.supplier_code_sequences (last_sequence) 
SELECT 0 
WHERE NOT EXISTS (SELECT 1 FROM public.supplier_code_sequences);

-- Create function to generate supplier codes
CREATE OR REPLACE FUNCTION public.generate_supplier_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_sequence INTEGER;
    supplier_code TEXT;
BEGIN
    -- Get next sequence number
    UPDATE public.supplier_code_sequences 
    SET last_sequence = last_sequence + 1,
        updated_at = NOW()
    RETURNING last_sequence INTO next_sequence;
    
    -- Generate supplier code in format SUP001, SUP002, etc.
    supplier_code := 'SUP' || LPAD(next_sequence::TEXT, 3, '0');
    
    -- Ensure uniqueness (in case of manual insertions)
    WHILE EXISTS (SELECT 1 FROM public.suppliers WHERE supplier_code = supplier_code) LOOP
        UPDATE public.supplier_code_sequences 
        SET last_sequence = last_sequence + 1,
            updated_at = NOW()
        RETURNING last_sequence INTO next_sequence;
        
        supplier_code := 'SUP' || LPAD(next_sequence::TEXT, 3, '0');
    END LOOP;
    
    RETURN supplier_code;
END;
$$;

-- Enable RLS on supplier_code_sequences
ALTER TABLE public.supplier_code_sequences ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read sequences
CREATE POLICY "Authenticated users can read supplier sequences" 
ON public.supplier_code_sequences 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create policy for system to update sequences
CREATE POLICY "System can update supplier sequences" 
ON public.supplier_code_sequences 
FOR UPDATE 
USING (true);