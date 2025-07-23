-- Debug and fix the item code generation function by adding better error handling
CREATE OR REPLACE FUNCTION public.satguru_generate_enhanced_item_code(
  category_name TEXT,
  usage_type TEXT DEFAULT 'RAW_MATERIAL',
  qualifier TEXT DEFAULT '',
  size_mm TEXT DEFAULT '',
  gsm NUMERIC DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  category_prefix TEXT;
  usage_prefix TEXT;
  unique_counter INTEGER := 1;
  base_code TEXT;
  final_code TEXT;
  temp_code TEXT;
BEGIN
  -- Enhanced logging for debugging
  RAISE LOG 'Generating item code with params: category_name=%, usage_type=%, qualifier=%, size_mm=%, gsm=%', 
    category_name, usage_type, qualifier, size_mm, gsm;
  
  -- Generate category prefix (first 3-4 chars of category name)
  IF category_name IS NULL OR TRIM(category_name) = '' THEN
    category_prefix := 'GEN';
    RAISE LOG 'Warning: category_name is null/empty, using default prefix GEN';
  ELSE
    category_prefix := UPPER(LEFT(REPLACE(REPLACE(category_name, ' ', ''), '-', ''), 6));
    IF LENGTH(category_prefix) < 3 THEN
      category_prefix := RPAD(category_prefix, 3, 'X');
    END IF;
  END IF;
  
  -- Generate usage type prefix
  usage_prefix := CASE 
    WHEN usage_type = 'RAW_MATERIAL' THEN 'RM'
    WHEN usage_type = 'FINISHED_GOOD' THEN 'FG' 
    WHEN usage_type = 'PACKAGING' THEN 'PKG'
    WHEN usage_type = 'CONSUMABLE' THEN 'CONS'
    WHEN usage_type = 'WIP' THEN 'WIP'
    ELSE 'GEN'
  END;
  
  -- Build base code components
  base_code := category_prefix || '_' || usage_prefix;
  
  -- Add qualifier if provided
  IF qualifier IS NOT NULL AND TRIM(qualifier) != '' THEN
    base_code := base_code || '_' || UPPER(REPLACE(qualifier, ' ', ''));
  END IF;
  
  -- Add size if provided
  IF size_mm IS NOT NULL AND TRIM(size_mm) != '' THEN
    base_code := base_code || '_' || UPPER(REPLACE(size_mm, ' ', ''));
  END IF;
  
  -- Add GSM if provided
  IF gsm IS NOT NULL AND gsm > 0 THEN
    base_code := base_code || '_' || gsm::TEXT || 'GSM';
  END IF;
  
  -- Ensure uniqueness by checking existing codes
  temp_code := base_code;
  WHILE EXISTS (SELECT 1 FROM satguru_item_master WHERE item_code = temp_code) LOOP
    temp_code := base_code || '_' || LPAD(unique_counter::TEXT, 3, '0');
    unique_counter := unique_counter + 1;
    
    -- Prevent infinite loops
    IF unique_counter > 999 THEN
      temp_code := base_code || '_' || EXTRACT(EPOCH FROM now())::INTEGER::TEXT;
      EXIT;
    END IF;
  END LOOP;
  
  final_code := temp_code;
  RAISE LOG 'Generated final item code: %', final_code;
  
  RETURN final_code;
  
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error in satguru_generate_enhanced_item_code: % %', SQLERRM, SQLSTATE;
  -- Return a safe fallback code
  RETURN 'ERROR_' || EXTRACT(EPOCH FROM now())::INTEGER::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;