-- Add unique constraint to prevent duplicate issue records
-- This will prevent the same item_code, date, qty_issued, and purpose from being inserted multiple times

ALTER TABLE satguru_issue_log 
ADD CONSTRAINT unique_issue_record 
UNIQUE (item_code, date, qty_issued, purpose);

-- Add index for better performance on duplicate checking
CREATE INDEX IF NOT EXISTS idx_issue_log_duplicate_check 
ON satguru_issue_log (item_code, date, qty_issued, purpose);

-- Add index for better performance on date-based queries
CREATE INDEX IF NOT EXISTS idx_issue_log_date 
ON satguru_issue_log (date);