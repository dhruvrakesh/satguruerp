
-- Complete Fresh Start Plan for Issue Logs
-- Phase 1: Restore stock levels by adding back all issued quantities

-- First, let's restore stock levels by adding back all issued quantities
UPDATE satguru_stock 
SET 
  current_qty = current_qty + (
    SELECT COALESCE(SUM(qty_issued), 0) 
    FROM satguru_issue_log 
    WHERE satguru_issue_log.item_code = satguru_stock.item_code
  ),
  last_updated = now()
WHERE item_code IN (
  SELECT DISTINCT item_code 
  FROM satguru_issue_log
);

-- Log the restoration operation
INSERT INTO activity_logs (action, details) 
VALUES (
  'STOCK_RESTORATION', 
  jsonb_build_object(
    'operation', 'restore_stock_before_issue_log_cleanup',
    'timestamp', now(),
    'affected_items', (SELECT COUNT(DISTINCT item_code) FROM satguru_issue_log),
    'total_qty_restored', (SELECT SUM(qty_issued) FROM satguru_issue_log),
    'details', 'Stock levels restored before complete issue log cleanup'
  )
);

-- Phase 2: Complete cleanup of issue logs table
-- Create a backup first for audit purposes
CREATE TABLE IF NOT EXISTS satguru_issue_log_backup_cleanup AS 
SELECT *, now() AS backup_timestamp FROM satguru_issue_log;

-- Log the backup creation
INSERT INTO activity_logs (action, details) 
VALUES (
  'ISSUE_LOG_BACKUP', 
  jsonb_build_object(
    'operation', 'backup_before_cleanup',
    'backup_table', 'satguru_issue_log_backup_cleanup',
    'records_backed_up', (SELECT COUNT(*) FROM satguru_issue_log),
    'timestamp', now()
  )
);

-- Phase 3: Complete truncate of issue logs
TRUNCATE TABLE satguru_issue_log RESTART IDENTITY CASCADE;

-- Log the cleanup operation
INSERT INTO activity_logs (action, details) 
VALUES (
  'ISSUE_LOG_CLEANUP', 
  jsonb_build_object(
    'operation', 'complete_fresh_start_cleanup',
    'table', 'satguru_issue_log',
    'action', 'truncated_all_records',
    'timestamp', now(),
    'backup_table', 'satguru_issue_log_backup_cleanup',
    'reason', 'fresh_start_for_clean_upload'
  )
);

-- Phase 4: Verification queries
-- Verify issue log table is empty
SELECT 
  'Issue Log Cleanup Verification' as status,
  COUNT(*) as remaining_records,
  CASE 
    WHEN COUNT(*) = 0 THEN 'SUCCESS: Table is completely empty'
    ELSE 'ERROR: Table still contains records'
  END as cleanup_status
FROM satguru_issue_log;

-- Verify stock restoration
SELECT 
  'Stock Restoration Verification' as status,
  COUNT(*) as items_with_stock,
  SUM(current_qty) as total_stock_quantity,
  MAX(last_updated) as last_stock_update
FROM satguru_stock 
WHERE current_qty > 0;

-- Show backup table verification
SELECT 
  'Backup Verification' as status,
  COUNT(*) as backed_up_records,
  SUM(qty_issued) as total_qty_in_backup,
  MIN(backup_timestamp) as backup_created_at
FROM satguru_issue_log_backup_cleanup;
