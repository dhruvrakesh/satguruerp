
-- Fix Customer Specifications Schema Issues
-- 1. Add unique constraint on file_name in gdrive_file_mappings to prevent upsert conflicts
ALTER TABLE public.gdrive_file_mappings 
ADD CONSTRAINT unique_gdrive_file_name UNIQUE (file_name);

-- 2. Update customer_specifications to properly reference master_data_artworks_se
-- First, let's add a proper foreign key constraint if it doesn't exist
DO $$
BEGIN
    -- Check if the foreign key constraint exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'customer_specifications_item_code_fkey' 
        AND table_name = 'customer_specifications'
    ) THEN
        -- Add foreign key constraint to link customer_specifications with master_data_artworks_se
        ALTER TABLE public.customer_specifications 
        ADD CONSTRAINT customer_specifications_item_code_fkey 
        FOREIGN KEY (item_code) REFERENCES public.master_data_artworks_se(item_code);
    END IF;
END $$;

-- 3. Update the database function to better handle parsing with proper error handling
CREATE OR REPLACE FUNCTION public.parse_gdrive_filename(filename TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB := '{}';
  customer_pattern TEXT := '([A-Z]{2,}[A-Z0-9]*)';
  item_pattern TEXT := '([A-Z0-9]{5,})';
  dimension_pattern TEXT := '(\d+[xX×]\d+)';
  gsm_pattern TEXT := '(\d+[gG][sS][mM]|\d+[gG])';
  parsed_customer TEXT;
  parsed_item TEXT;
  confidence_score NUMERIC := 0.1;
BEGIN
  -- Initialize default values
  result := jsonb_build_object(
    'customer_code', NULL,
    'item_code', NULL, 
    'product_name', NULL,
    'dimensions', NULL,
    'confidence', 0.1
  );
  
  -- Enhanced parsing logic
  BEGIN
    -- Extract customer code (typically at the start, after numbers)
    IF filename ~ '[0-9]+-([A-Z]{2,}[A-Z0-9]*)-' THEN
      parsed_customer := substring(filename from '[0-9]+-([A-Z]{2,}[A-Z0-9]*)-');
      result := jsonb_set(result, '{customer_code}', to_jsonb(parsed_customer));
      confidence_score := confidence_score + 0.3;
    END IF;
    
    -- Try to match with existing artwork item codes
    SELECT item_code INTO parsed_item 
    FROM public.master_data_artworks_se 
    WHERE filename ILIKE '%' || item_code || '%'
    LIMIT 1;
    
    IF parsed_item IS NOT NULL THEN
      result := jsonb_set(result, '{item_code}', to_jsonb(parsed_item));
      confidence_score := confidence_score + 0.4;
    END IF;
    
    -- Extract dimensions
    IF filename ~ dimension_pattern THEN
      result := jsonb_set(result, '{dimensions}', 
        to_jsonb(substring(filename from dimension_pattern)));
      confidence_score := confidence_score + 0.2;
    END IF;
    
    -- Set final confidence score
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

-- 4. Create an index on master_data_artworks_se.item_code for better performance
CREATE INDEX IF NOT EXISTS idx_master_data_artworks_se_item_code 
ON public.master_data_artworks_se(item_code);
