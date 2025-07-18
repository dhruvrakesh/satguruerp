
-- Phase 1: Database Cleanup & Constraints

-- Step 1: Add unique constraint on item_name to prevent future duplicates
ALTER TABLE public.item_master 
ADD CONSTRAINT unique_item_name UNIQUE (item_name);

-- Step 2: Create function to cleanup duplicate item_names
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_item_names()
RETURNS TABLE(
  cleaned_count integer,
  duplicate_groups_found integer,
  records_preserved integer,
  records_deleted integer
) AS $$
DECLARE
  duplicate_count integer := 0;
  preserved_count integer := 0;
  deleted_count integer := 0;
  group_count integer := 0;
  rec RECORD;
BEGIN
  -- First, identify all duplicate item_names
  FOR rec IN 
    SELECT item_name, COUNT(*) as cnt
    FROM public.item_master 
    GROUP BY item_name 
    HAVING COUNT(*) > 1
  LOOP
    group_count := group_count + 1;
    
    -- For each duplicate group, keep the most recent record
    WITH ranked_items AS (
      SELECT id, item_name, 
             ROW_NUMBER() OVER (ORDER BY updated_at DESC NULLS LAST, created_at DESC) as rn
      FROM public.item_master 
      WHERE item_name = rec.item_name
    ),
    items_to_delete AS (
      SELECT id FROM ranked_items WHERE rn > 1
    )
    DELETE FROM public.item_master 
    WHERE id IN (SELECT id FROM items_to_delete);
    
    -- Count what we preserved and deleted
    preserved_count := preserved_count + 1;
    deleted_count := deleted_count + (rec.cnt - 1);
  END LOOP;
  
  -- Return summary
  SELECT group_count, preserved_count, deleted_count, (preserved_count + deleted_count) 
  INTO duplicate_groups_found, records_preserved, records_deleted, cleaned_count;
  
  RETURN QUERY SELECT cleaned_count, duplicate_groups_found, records_preserved, records_deleted;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create function to ensure item_name to item_code mapping
CREATE OR REPLACE FUNCTION public.get_item_code_for_name(p_item_name text)
RETURNS text AS $$
DECLARE
  existing_code text;
BEGIN
  -- Look up existing item_code for this item_name
  SELECT item_code INTO existing_code
  FROM public.item_master
  WHERE item_name = p_item_name
  LIMIT 1;
  
  RETURN existing_code;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create enhanced item code generation function
CREATE OR REPLACE FUNCTION public.satguru_generate_enhanced_item_code(
  category_name text, 
  usage_type text DEFAULT 'RAW_MATERIAL',
  qualifier text DEFAULT '',
  size_mm text DEFAULT '',
  gsm numeric DEFAULT NULL
) RETURNS text AS $$
DECLARE
  category_code text;
  timestamp_part text;
  final_code text;
  counter integer := 1;
BEGIN
  -- Get category code (first 3 letters)
  category_code := UPPER(LEFT(REGEXP_REPLACE(category_name, '[^A-Za-z]', '', 'g'), 3));
  
  -- Generate timestamp-based suffix for uniqueness
  timestamp_part := EXTRACT(EPOCH FROM now())::bigint::text;
  timestamp_part := RIGHT(timestamp_part, 6);
  
  -- Build structured code based on usage type
  CASE usage_type
    WHEN 'FINISHED_GOOD' THEN
      final_code := category_code || '-FG-' || timestamp_part;
    WHEN 'RAW_MATERIAL' THEN
      final_code := category_code || '-RM';
      IF qualifier IS NOT NULL AND qualifier != '' THEN
        final_code := final_code || '-' || UPPER(qualifier);
      END IF;
      IF size_mm IS NOT NULL AND size_mm != '' THEN
        final_code := final_code || '-' || size_mm;
      END IF;
      IF gsm IS NOT NULL THEN
        final_code := final_code || '-' || gsm::text || 'GSM';
      END IF;
      final_code := final_code || '-' || timestamp_part;
    ELSE
      final_code := category_code || '-' || UPPER(usage_type) || '-' || timestamp_part;
  END CASE;
  
  -- Ensure uniqueness by adding counter if needed
  WHILE EXISTS (SELECT 1 FROM public.item_master WHERE item_code = final_code) LOOP
    counter := counter + 1;
    final_code := final_code || '-' || counter::text;
  END LOOP;
  
  RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create function to validate unique item code
CREATE OR REPLACE FUNCTION public.satguru_validate_unique_item_code(
  p_item_code text,
  p_exclude_id uuid DEFAULT NULL
) RETURNS boolean AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.item_master 
    WHERE item_code = p_item_code 
    AND (p_exclude_id IS NULL OR id != p_exclude_id)
  );
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_master_item_name ON public.item_master(item_name);
CREATE INDEX IF NOT EXISTS idx_item_master_item_code ON public.item_master(item_code);
CREATE INDEX IF NOT EXISTS idx_item_master_created_at ON public.item_master(created_at);
CREATE INDEX IF NOT EXISTS idx_item_master_updated_at ON public.item_master(updated_at);
