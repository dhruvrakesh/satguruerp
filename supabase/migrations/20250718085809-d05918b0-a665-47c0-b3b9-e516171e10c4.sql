-- Phase 3: Cascading Update System
-- Create function to modify item codes with cascade updates
CREATE OR REPLACE FUNCTION public.satguru_update_item_code(
  p_old_item_code TEXT,
  p_new_item_code TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  item_record RECORD;
  update_count INTEGER := 0;
BEGIN
  -- Validate new item code doesn't exist
  IF EXISTS (SELECT 1 FROM item_master WHERE item_code = p_new_item_code) THEN
    RAISE EXCEPTION 'Item code % already exists', p_new_item_code;
  END IF;
  
  -- Get the item to update
  SELECT * INTO item_record FROM item_master WHERE item_code = p_old_item_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item code % not found', p_old_item_code;
  END IF;
  
  -- Log the change in history
  INSERT INTO item_code_history (
    item_master_id, 
    old_item_code, 
    new_item_code, 
    changed_by, 
    reason
  ) VALUES (
    item_record.id,
    p_old_item_code,
    p_new_item_code,
    auth.uid(),
    p_reason
  );
  
  -- Update item_master
  UPDATE item_master SET item_code = p_new_item_code WHERE item_code = p_old_item_code;
  GET DIAGNOSTICS update_count = ROW_COUNT;
  
  -- Update BOM references (both FG and RM references)
  UPDATE bill_of_materials SET fg_item_code = p_new_item_code WHERE fg_item_code = p_old_item_code;
  UPDATE bill_of_materials SET rm_item_code = p_new_item_code WHERE rm_item_code = p_old_item_code;
  
  -- Update GRN references
  UPDATE satguru_grn SET item_code = p_new_item_code WHERE item_code = p_old_item_code;
  
  -- Update stock issues references  
  UPDATE satguru_stock_issues SET item_code = p_new_item_code WHERE item_code = p_old_item_code;
  
  -- Update current stock references
  UPDATE satguru_stock SET item_code = p_new_item_code WHERE item_code = p_old_item_code;
  
  -- Update daily stock summary references
  UPDATE daily_stock_summary SET item_code = p_new_item_code WHERE item_code = p_old_item_code;
  
  RETURN update_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create enhanced item code generation function
CREATE OR REPLACE FUNCTION public.satguru_generate_enhanced_item_code(
  category_name TEXT,
  usage_type TEXT DEFAULT 'RAW_MATERIAL',
  qualifier TEXT DEFAULT '',
  size_mm TEXT DEFAULT '',
  gsm NUMERIC DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  category_code TEXT;
  usage_prefix TEXT;
  final_code TEXT;
  sequence_num INTEGER;
  formatted_sequence TEXT;
BEGIN
  -- Get usage type prefix
  CASE usage_type
    WHEN 'FINISHED_GOOD' THEN usage_prefix := 'FG';
    WHEN 'RAW_MATERIAL' THEN usage_prefix := 'RM';
    WHEN 'WIP' THEN usage_prefix := 'WIP';
    WHEN 'PACKAGING' THEN usage_prefix := 'PKG';
    WHEN 'CONSUMABLE' THEN usage_prefix := 'CON';
    ELSE usage_prefix := 'ITM';
  END CASE;
  
  -- Get first 3 letters of category name
  category_code := UPPER(LEFT(REGEXP_REPLACE(category_name, '[^A-Za-z]', '', 'g'), 3));
  
  -- Build base code: [USAGE]_[CATEGORY]
  final_code := usage_prefix || '_' || category_code;
  
  -- Add qualifier if provided
  IF qualifier IS NOT NULL AND qualifier != '' THEN
    final_code := final_code || '_' || UPPER(LEFT(qualifier, 3));
  END IF;
  
  -- Add size if provided
  IF size_mm IS NOT NULL AND size_mm != '' THEN
    final_code := final_code || '_' || REGEXP_REPLACE(size_mm, '[^A-Z0-9]', '', 'g');
  END IF;
  
  -- Add GSM if provided
  IF gsm IS NOT NULL THEN
    final_code := final_code || '_' || gsm::TEXT;
  END IF;
  
  -- Get next sequence number for this pattern
  SELECT COALESCE(MAX(CAST(SUBSTRING(item_code FROM LENGTH(final_code || '_') + 1 FOR 4) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM item_master 
  WHERE item_code LIKE final_code || '_%'
    AND item_code ~ (final_code || '_[0-9]{4}$');
  
  -- Format sequence as 4-digit number
  formatted_sequence := LPAD(sequence_num::TEXT, 4, '0');
  
  -- Final code with sequence
  final_code := final_code || '_' || formatted_sequence;
  
  RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate unique item codes
CREATE OR REPLACE FUNCTION public.satguru_validate_unique_item_code(
  p_item_code TEXT,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM item_master 
    WHERE item_code = p_item_code 
    AND (p_exclude_id IS NULL OR id != p_exclude_id)
  );
END;
$$ LANGUAGE plpgsql;