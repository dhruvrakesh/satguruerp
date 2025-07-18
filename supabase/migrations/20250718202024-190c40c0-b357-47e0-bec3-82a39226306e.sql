-- Check current duplicate count first
SELECT 
  item_name,
  COUNT(*) as duplicate_count,
  MIN(created_at) as first_created,
  MAX(updated_at) as last_updated
FROM public.item_master 
GROUP BY item_name 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 10;