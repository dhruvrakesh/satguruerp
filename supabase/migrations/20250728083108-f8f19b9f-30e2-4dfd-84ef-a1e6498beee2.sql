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
$function$

-- Now insert Agastya Sales vendor with complete realistic data
INSERT INTO public.suppliers (
    supplier_code,
    supplier_name,
    supplier_type,
    category,
    contact_person,
    email,
    phone,
    address,
    tax_details,
    bank_details,
    payment_terms,
    credit_limit,
    minimum_order_value,
    lead_time_days,
    material_categories,
    certifications,
    performance_rating,
    is_active,
    is_approved,
    created_at,
    updated_at
) VALUES (
    generate_supplier_code(),
    'Agastya Sales',
    'DISTRIBUTOR',
    'STANDARD',
    'Rajendra Agastya',
    'rajendra@agastyasales.com',
    '+91-9876543214',
    '{"street": "Plot 42, Industrial Area Phase II", "city": "Chandigarh", "state": "Punjab", "postal_code": "160002", "country": "India"}',
    '{"gst_number": "03ABCDE1234F1Z5", "pan_number": "ABCDE1234F", "registration_type": "Regular"}',
    '{"bank_name": "State Bank of India", "account_number": "123456789012", "ifsc_code": "SBIN0001234", "account_type": "Current", "beneficiary_name": "Agastya Sales"}',
    'NET_30',
    500000,
    25000,
    12,
    ARRAY['BOPP', 'ADHESIVES'],
    ARRAY['ISO_9001'],
    70,
    true,
    false,
    now(),
    now()
);