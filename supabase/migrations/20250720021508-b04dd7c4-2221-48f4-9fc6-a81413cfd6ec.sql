
-- Create gdrive_file_mappings table
CREATE TABLE IF NOT EXISTS public.gdrive_file_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL UNIQUE,
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

-- Enhanced parse_gdrive_filename function for underscore delimited filenames
CREATE OR REPLACE FUNCTION public.parse_gdrive_filename(filename TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB := '{}';
  parts TEXT[];
  name_without_ext TEXT;
  item_code TEXT;
  customer_name TEXT;
  product_parts TEXT[] := '{}';
  product_name TEXT;
  dimensions TEXT;
  confidence_score NUMERIC := 0.1;
  i INTEGER;
  dimension_index INTEGER := -1;
BEGIN
  -- Remove file extension
  name_without_ext := regexp_replace(filename, '\.[^.]*$', '');
  
  -- Split by underscore
  parts := string_to_array(name_without_ext, '_');
  
  -- Initialize default values
  result := jsonb_build_object(
    'customer_code', NULL,
    'item_code', NULL, 
    'product_name', NULL,
    'dimensions', NULL,
    'confidence', 0.1
  );
  
  -- Enhanced parsing for underscore delimited format
  -- Expected: ITEM_CODE_CUSTOMER_PRODUCT_VARIANT_DIMENSIONS
  BEGIN
    IF array_length(parts, 1) >= 4 THEN
      -- Extract item code (first part)
      item_code := parts[1];
      result := jsonb_set(result, '{item_code}', to_jsonb(item_code));
      confidence_score := confidence_score + 0.3;
      
      -- Extract customer name (second part)
      customer_name := parts[2];
      result := jsonb_set(result, '{customer_code}', to_jsonb(customer_name));
      confidence_score := confidence_score + 0.2;
      
      -- Find dimensions part (contains pattern like 65x24MM, 312X168, etc.)
      FOR i IN 3..array_length(parts, 1) LOOP
        IF parts[i] ~ '\d+[xX×]\d+(?:[mM][mM])?$' THEN
          dimension_index := i;
          dimensions := parts[i];
          result := jsonb_set(result, '{dimensions}', to_jsonb(dimensions));
          confidence_score := confidence_score + 0.3;
          EXIT;
        END IF;
      END LOOP;
      
      -- Extract product name (parts between customer and dimensions)
      IF dimension_index > 3 THEN
        FOR i IN 3..(dimension_index - 1) LOOP
          product_parts := array_append(product_parts, parts[i]);
        END LOOP;
      ELSIF dimension_index = -1 AND array_length(parts, 1) > 2 THEN
        -- No dimensions found, take remaining parts as product
        FOR i IN 3..array_length(parts, 1) LOOP
          product_parts := array_append(product_parts, parts[i]);
        END LOOP;
      END IF;
      
      IF array_length(product_parts, 1) > 0 THEN
        product_name := array_to_string(product_parts, ' ');
        result := jsonb_set(result, '{product_name}', to_jsonb(product_name));
        confidence_score := confidence_score + 0.2;
      END IF;
    END IF;
    
    -- Ensure confidence doesn't exceed 1.0
    result := jsonb_set(result, '{confidence}', to_jsonb(LEAST(confidence_score, 1.0)));
    
  EXCEPTION WHEN OTHERS THEN
    -- Return safe default on any error
    result := jsonb_build_object(
      'customer_code', NULL,
      'item_code', NULL,
      'product_name', NULL,
      'dimensions', NULL,
      'confidence', 0.1
    );
  END;
  
  RETURN result;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gdrive_mappings_status ON public.gdrive_file_mappings(mapping_status);
CREATE INDEX IF NOT EXISTS idx_gdrive_mappings_created_at ON public.gdrive_file_mappings(created_at);
CREATE INDEX IF NOT EXISTS idx_gdrive_mappings_filename ON public.gdrive_file_mappings(file_name);
CREATE INDEX IF NOT EXISTS idx_gdrive_mappings_item_code ON public.gdrive_file_mappings(parsed_item_code);

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
