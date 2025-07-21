-- Remove specific duplicates and add unique constraint
-- First, manually delete one of the duplicate records

-- Step 1: Delete the specific duplicate record (keeping the first one)
DELETE FROM satguru_issue_log 
WHERE id = '1002589f-72e7-4446-aece-ebdc92eae637';

-- Step 2: Check if there are any other duplicates and remove them
WITH duplicate_groups AS (
  SELECT 
    item_code, 
    date, 
    qty_issued, 
    purpose,
    ROW_NUMBER() OVER (
      PARTITION BY item_code, date, qty_issued, purpose 
      ORDER BY created_at ASC
    ) as row_num,
    id
  FROM satguru_issue_log
)
DELETE FROM satguru_issue_log 
WHERE id IN (
  SELECT id FROM duplicate_groups WHERE row_num > 1
);

-- Step 3: Add the unique constraint
ALTER TABLE satguru_issue_log 
ADD CONSTRAINT unique_issue_record 
UNIQUE (item_code, date, qty_issued, purpose);

-- Step 4: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_issue_log_duplicate_check 
ON satguru_issue_log (item_code, date, qty_issued, purpose);

CREATE INDEX IF NOT EXISTS idx_issue_log_date 
ON satguru_issue_log (date);

-- Step 5: Add a comment for documentation
COMMENT ON CONSTRAINT unique_issue_record ON satguru_issue_log IS 
'Prevents duplicate issue records with same item_code, date, qty_issued, and purpose';

-- Step 6: Log the cleanup operation
INSERT INTO activity_logs (action, details) 
VALUES (
  'DUPLICATE_CLEANUP', 
  jsonb_build_object(
    'table', 'satguru_issue_log',
    'operation', 'removed_duplicates_and_added_constraint',
    'timestamp', now(),
    'details', 'Cleaned up duplicate issue records using ROW_NUMBER approach'
  )
);