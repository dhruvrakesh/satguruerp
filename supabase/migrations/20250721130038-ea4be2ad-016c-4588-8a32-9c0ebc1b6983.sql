-- Clean up existing duplicates and add unique constraint
-- First, identify and remove duplicates, keeping only the earliest record

-- Step 1: Clean up duplicates, keeping the earliest record for each combination
WITH duplicate_groups AS (
  SELECT 
    item_code, 
    date, 
    qty_issued, 
    purpose,
    MIN(id) as keep_id,
    COUNT(*) as duplicate_count
  FROM satguru_issue_log 
  GROUP BY item_code, date, qty_issued, purpose
  HAVING COUNT(*) > 1
),
duplicates_to_delete AS (
  SELECT sil.id
  FROM satguru_issue_log sil
  INNER JOIN duplicate_groups dg ON 
    sil.item_code = dg.item_code AND 
    sil.date = dg.date AND 
    sil.qty_issued = dg.qty_issued AND 
    sil.purpose = dg.purpose
  WHERE sil.id != dg.keep_id
)
DELETE FROM satguru_issue_log 
WHERE id IN (SELECT id FROM duplicates_to_delete);

-- Step 2: Add the unique constraint
ALTER TABLE satguru_issue_log 
ADD CONSTRAINT unique_issue_record 
UNIQUE (item_code, date, qty_issued, purpose);

-- Step 3: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_issue_log_duplicate_check 
ON satguru_issue_log (item_code, date, qty_issued, purpose);

CREATE INDEX IF NOT EXISTS idx_issue_log_date 
ON satguru_issue_log (date);

-- Step 4: Add a comment for documentation
COMMENT ON CONSTRAINT unique_issue_record ON satguru_issue_log IS 
'Prevents duplicate issue records with same item_code, date, qty_issued, and purpose';

-- Step 5: Log the cleanup operation
INSERT INTO activity_logs (action, details) 
VALUES (
  'DUPLICATE_CLEANUP', 
  jsonb_build_object(
    'table', 'satguru_issue_log',
    'operation', 'removed_duplicates_and_added_constraint',
    'timestamp', now()
  )
);