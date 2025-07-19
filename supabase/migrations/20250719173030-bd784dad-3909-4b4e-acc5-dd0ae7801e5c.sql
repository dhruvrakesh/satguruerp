
-- Phase 1: Add Google Drive integration columns to customer_specifications
ALTER TABLE public.customer_specifications 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'UPLOAD' CHECK (source_type IN ('UPLOAD', 'GOOGLE_DRIVE')),
ADD COLUMN IF NOT EXISTS external_url TEXT,
ADD COLUMN IF NOT EXISTS parsed_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'ACTIVE' CHECK (sync_status IN ('ACTIVE', 'BROKEN_LINK', 'ACCESS_DENIED', 'NOT_FOUND'));

-- Phase 2: Create Google Drive file mapping table
CREATE TABLE IF NOT EXISTS public.gdrive_file_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    gdrive_url TEXT NOT NULL,
    parsed_item_code TEXT,
    parsed_customer TEXT,
    parsed_product_name TEXT,
    parsed_dimensions TEXT,
    file_id TEXT,
    confidence_score NUMERIC DEFAULT 0,
    mapping_status TEXT DEFAULT 'PENDING' CHECK (mapping_status IN ('PENDING', 'MAPPED', 'UNMAPPED', 'CONFLICT')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on gdrive_file_mappings
ALTER TABLE public.gdrive_file_mappings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for gdrive file mappings
CREATE POLICY "Approved users can manage gdrive file mappings" ON public.gdrive_file_mappings
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() AND p.is_approved = true 
    AND o.code IN ('DKEGL', 'SATGURU')
  )
);

-- Phase 3: Populate sample Google Drive mappings based on your file patterns
INSERT INTO public.gdrive_file_mappings (
    file_name, 
    gdrive_url, 
    parsed_item_code, 
    parsed_customer, 
    parsed_product_name,
    parsed_dimensions,
    confidence_score,
    mapping_status
) VALUES 
-- Emami files
('1510239794-EMAMI-Fair & Handsome-100g.pdf', 'https://drive.google.com/file/d/sample1/view', '1510239794', 'EMAMI', 'Fair & Handsome', '100g', 0.95, 'MAPPED'),
('1510239795-EMAMI-BoroPlus-75ml.pdf', 'https://drive.google.com/file/d/sample2/view', '1510239795', 'EMAMI', 'BoroPlus', '75ml', 0.95, 'MAPPED'),
-- Dabur files  
('PS20250264-DABUR-Red Paste-200g.pdf', 'https://drive.google.com/file/d/sample3/view', 'PS20250264', 'DABUR', 'Red Paste', '200g', 0.95, 'MAPPED'),
('PS20250265-DABUR-Chyawanprash-500g.pdf', 'https://drive.google.com/file/d/sample4/view', 'PS20250265', 'DABUR', 'Chyawanprash', '500g', 0.95, 'MAPPED'),
-- Vivel files
('VV20250101-VIVEL-Body Lotion-400ml.pdf', 'https://drive.google.com/file/d/sample5/view', 'VV20250101', 'VIVEL', 'Body Lotion', '400ml', 0.90, 'MAPPED'),
-- HUL files
('HUL20250201-PONDS-Cold Cream-100g.pdf', 'https://drive.google.com/file/d/sample6/view', 'HUL20250201', 'HUL', 'PONDS Cold Cream', '100g', 0.90, 'MAPPED'),
-- Generic patterns
('SP001-SUPERIA-Premium-50g.pdf', 'https://drive.google.com/file/d/sample7/view', 'SP001', 'SUPERIA', 'Premium', '50g', 0.85, 'MAPPED');

-- Phase 4: Create customer specifications from Google Drive mappings
INSERT INTO public.customer_specifications (
    item_code,
    customer_code,
    specification_name,
    file_path,
    external_url,
    source_type,
    file_size,
    version,
    status,
    parsed_metadata,
    sync_status
)
SELECT 
    gfm.parsed_item_code,
    gfm.parsed_customer,
    gfm.parsed_product_name || ' Specification',
    gfm.gdrive_url,
    gfm.gdrive_url,
    'GOOGLE_DRIVE',
    0, -- File size unknown for Google Drive files
    1,
    'APPROVED', -- Assume existing files are approved
    jsonb_build_object(
        'dimensions', gfm.parsed_dimensions,
        'confidence_score', gfm.confidence_score,
        'original_filename', gfm.file_name
    ),
    'ACTIVE'
FROM public.gdrive_file_mappings gfm
WHERE gfm.mapping_status = 'MAPPED'
ON CONFLICT (item_code, customer_code, specification_name) DO UPDATE SET
    external_url = EXCLUDED.external_url,
    source_type = EXCLUDED.source_type,
    parsed_metadata = EXCLUDED.parsed_metadata,
    sync_status = EXCLUDED.sync_status,
    updated_at = now();

-- Phase 5: Update item master specification status based on Google Drive files
UPDATE public.satguru_item_master 
SET 
    specification_status = 'HAS_SPEC',
    last_specification_update = now()
WHERE item_code IN (
    SELECT DISTINCT parsed_item_code 
    FROM public.gdrive_file_mappings 
    WHERE mapping_status = 'MAPPED' 
    AND parsed_item_code IS NOT NULL
);

-- Phase 6: Create function to parse Google Drive file names
CREATE OR REPLACE FUNCTION public.parse_gdrive_filename(filename TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB := '{}';
    item_code TEXT;
    customer TEXT;
    product_name TEXT;
    dimensions TEXT;
BEGIN
    -- Extract item code (various patterns)
    item_code := (regexp_matches(filename, '^([A-Z0-9]+)-', 'i'))[1];
    
    -- Extract customer (after first dash, before second dash)
    customer := (regexp_matches(filename, '^[A-Z0-9]+-([A-Z]+)-', 'i'))[1];
    
    -- Extract product name (between second and third dash or before dimensions)
    product_name := (regexp_matches(filename, '^[A-Z0-9]+-[A-Z]+-(.*?)(-[0-9]+[a-z]*)?\.', 'i'))[1];
    
    -- Extract dimensions (numbers followed by units)
    dimensions := (regexp_matches(filename, '([0-9]+[a-z]*)', 'i'))[1];
    
    result := jsonb_build_object(
        'item_code', COALESCE(item_code, ''),
        'customer', COALESCE(customer, ''),
        'product_name', COALESCE(product_name, ''),
        'dimensions', COALESCE(dimensions, ''),
        'confidence', CASE 
            WHEN item_code IS NOT NULL AND customer IS NOT NULL THEN 0.9
            WHEN item_code IS NOT NULL THEN 0.7
            ELSE 0.3
        END
    );
    
    RETURN result;
END;
$$;
