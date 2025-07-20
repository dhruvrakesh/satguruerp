-- Create gdrive_file_mappings table
CREATE TABLE IF NOT EXISTS public.gdrive_file_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  gdrive_url TEXT NOT NULL,
  parsed_customer_code TEXT,
  parsed_item_code TEXT,
  parsed_product_name TEXT,
  parsed_dimensions TEXT,
  confidence_score NUMERIC DEFAULT 0,
  mapping_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gdrive_file_mappings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Approved users can manage gdrive file mappings"
ON public.gdrive_file_mappings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid() 
    AND p.is_approved = true 
    AND o.code IN ('DKEGL', 'SATGURU')
  )
);

-- Create parse_gdrive_filename function
CREATE OR REPLACE FUNCTION public.parse_gdrive_filename(filename TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB := '{}';
  customer_pattern TEXT := '[A-Z]{2,}';
  item_pattern TEXT := '[A-Z0-9]+';
  dimension_pattern TEXT := '\d+[xX]\d+';
BEGIN
  -- Initialize default values
  result := jsonb_build_object(
    'customer_code', NULL,
    'item_code', NULL, 
    'product_name', NULL,
    'dimensions', NULL,
    'confidence', 0.5
  );
  
  -- Basic parsing logic - extract patterns from filename
  BEGIN
    -- Try to extract customer code (first uppercase word)
    IF filename ~ customer_pattern THEN
      result := jsonb_set(result, '{customer_code}', 
        to_jsonb(substring(filename from customer_pattern)));
    END IF;
    
    -- Try to extract dimensions (pattern like 100x200)
    IF filename ~ dimension_pattern THEN
      result := jsonb_set(result, '{dimensions}', 
        to_jsonb(substring(filename from dimension_pattern)));
    END IF;
    
    -- Set confidence based on what we found
    IF result->>'customer_code' IS NOT NULL OR result->>'dimensions' IS NOT NULL THEN
      result := jsonb_set(result, '{confidence}', '0.8');
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    -- Return default result on any error
    result := jsonb_set(result, '{confidence}', '0.1');
  END;
  
  RETURN result;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gdrive_mappings_status ON public.gdrive_file_mappings(mapping_status);
CREATE INDEX IF NOT EXISTS idx_gdrive_mappings_created_at ON public.gdrive_file_mappings(created_at);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_gdrive_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gdrive_mappings_updated_at
  BEFORE UPDATE ON public.gdrive_file_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_gdrive_mappings_updated_at();