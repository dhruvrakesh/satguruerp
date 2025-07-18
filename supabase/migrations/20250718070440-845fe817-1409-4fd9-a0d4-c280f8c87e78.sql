-- First, add usage_type column to item_master table
ALTER TABLE public.satguru_item_master 
ADD COLUMN IF NOT EXISTS usage_type TEXT 
CHECK (usage_type IN ('RAW_MATERIAL', 'FINISHED_GOOD', 'PACKAGING', 'CONSUMABLE'))
DEFAULT 'FINISHED_GOOD';

-- Update existing items based on category patterns
UPDATE public.satguru_item_master 
SET usage_type = CASE 
  WHEN category_id IN (
    SELECT id FROM public.satguru_categories 
    WHERE category_name ILIKE '%raw%' OR category_name ILIKE '%material%'
  ) THEN 'RAW_MATERIAL'
  WHEN category_id IN (
    SELECT id FROM public.satguru_categories 
    WHERE category_name ILIKE '%packaging%'
  ) THEN 'PACKAGING'
  WHEN category_id IN (
    SELECT id FROM public.satguru_categories 
    WHERE category_name ILIKE '%consumable%'
  ) THEN 'CONSUMABLE'
  ELSE 'FINISHED_GOOD'
END
WHERE usage_type = 'FINISHED_GOOD';

-- Create function to generate enhanced item codes with FG/RM prefixes
CREATE OR REPLACE FUNCTION public.satguru_generate_enhanced_item_code(
  category_name text, 
  usage_type text DEFAULT 'FINISHED_GOOD',
  qualifier text DEFAULT '',
  size_mm text DEFAULT '',
  gsm numeric DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  category_code TEXT;
  usage_prefix TEXT;
  final_code TEXT;
BEGIN
  -- Get first 3 letters of category name
  category_code := UPPER(LEFT(REGEXP_REPLACE(category_name, '[^A-Za-z]', '', 'g'), 3));
  
  -- Set usage prefix
  usage_prefix := CASE usage_type
    WHEN 'RAW_MATERIAL' THEN 'RM'
    WHEN 'FINISHED_GOOD' THEN 'FG'
    WHEN 'PACKAGING' THEN 'PK'
    WHEN 'CONSUMABLE' THEN 'CN'
    ELSE 'FG'
  END;
  
  -- Build enhanced item code: PREFIX_CATEGORY_QUALIFIER_SIZE_GSM
  final_code := usage_prefix || '_' || category_code;
  
  IF qualifier IS NOT NULL AND qualifier != '' THEN
    final_code := final_code || '_' || UPPER(qualifier);
  END IF;
  
  IF size_mm IS NOT NULL AND size_mm != '' THEN
    final_code := final_code || '_' || size_mm;
  END IF;
  
  IF gsm IS NOT NULL THEN
    final_code := final_code || '_' || gsm::TEXT;
  END IF;
  
  RETURN final_code;
END;
$$;

-- Create view for category statistics
CREATE OR REPLACE VIEW public.satguru_category_stats AS
SELECT 
  c.id,
  c.category_name,
  c.description,
  c.created_at,
  c.updated_at,
  COUNT(im.id) as total_items,
  COUNT(CASE WHEN im.usage_type = 'FINISHED_GOOD' THEN 1 END) as fg_items,
  COUNT(CASE WHEN im.usage_type = 'RAW_MATERIAL' THEN 1 END) as rm_items,
  COUNT(CASE WHEN im.usage_type = 'PACKAGING' THEN 1 END) as packaging_items,
  COUNT(CASE WHEN im.usage_type = 'CONSUMABLE' THEN 1 END) as consumable_items,
  COUNT(CASE WHEN im.status = 'active' THEN 1 END) as active_items
FROM public.satguru_categories c
LEFT JOIN public.satguru_item_master im ON c.id = im.category_id
WHERE c.is_active IS NOT FALSE
GROUP BY c.id, c.category_name, c.description, c.created_at, c.updated_at
ORDER BY c.category_name;