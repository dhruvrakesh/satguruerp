
-- Phase 1: Clear existing data from satguru_item_master table
DELETE FROM public.satguru_item_master;

-- Phase 2: Update the table structure to better support manual item codes
-- Remove any constraints that might interfere with manual item codes
ALTER TABLE public.satguru_item_master 
DROP CONSTRAINT IF EXISTS satguru_item_master_item_name_key;

-- Ensure item_code is the primary unique identifier
-- Add constraint to ensure item codes are not empty
ALTER TABLE public.satguru_item_master 
ADD CONSTRAINT satguru_item_master_item_code_not_empty 
CHECK (length(trim(item_code)) > 0);

-- Update the bulk upload validation function to support manual item codes
CREATE OR REPLACE FUNCTION public.satguru_validate_manual_item_code(p_item_code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if item code already exists
  RETURN NOT EXISTS (
    SELECT 1 FROM public.satguru_item_master 
    WHERE item_code = p_item_code
  );
END;
$$ LANGUAGE plpgsql;

-- Create a function to handle manual item code inserts
CREATE OR REPLACE FUNCTION public.satguru_insert_manual_item(
  p_item_code TEXT,
  p_item_name TEXT,
  p_category_name TEXT,
  p_qualifier TEXT DEFAULT '',
  p_gsm NUMERIC DEFAULT NULL,
  p_size_mm TEXT DEFAULT '',
  p_uom TEXT DEFAULT 'PCS',
  p_usage_type TEXT DEFAULT 'RAW_MATERIAL',
  p_specifications TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_category_id UUID;
  v_item_id UUID;
BEGIN
  -- Get or create category
  SELECT id INTO v_category_id 
  FROM public.satguru_categories 
  WHERE category_name = p_category_name;
  
  IF v_category_id IS NULL THEN
    INSERT INTO public.satguru_categories (category_name, description)
    VALUES (p_category_name, 'Auto-created from manual upload')
    RETURNING id INTO v_category_id;
  END IF;
  
  -- Insert item with manual item code
  INSERT INTO public.satguru_item_master (
    item_code,
    item_name,
    category_id,
    qualifier,
    gsm,
    size_mm,
    uom,
    usage_type,
    specifications,
    status
  ) VALUES (
    p_item_code,
    p_item_name,
    v_category_id,
    p_qualifier,
    p_gsm,
    p_size_mm,
    p_uom,
    p_usage_type,
    p_specifications,
    'active'
  ) RETURNING id INTO v_item_id;
  
  RETURN v_item_id;
END;
$$ LANGUAGE plpgsql;
