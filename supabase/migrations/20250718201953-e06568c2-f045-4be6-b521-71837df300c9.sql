-- Create the cleanup function for duplicate item names
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_item_names()
RETURNS TABLE(
  duplicate_groups_found integer,
  records_preserved integer,
  records_deleted integer
) AS $$
DECLARE
  group_count integer := 0;
  preserved_count integer := 0;
  deleted_count integer := 0;
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
  RETURN QUERY SELECT group_count, preserved_count, deleted_count;
END;
$$ LANGUAGE plpgsql;