
-- Phase 1: Critical Data Cleanup
-- First, let's analyze the current duplicate situation
SELECT 
  'Analysis of Opening Stock Duplicates' as analysis_type,
  COUNT(*) as total_opening_stock_records,
  COUNT(DISTINCT item_code) as unique_item_codes,
  COUNT(*) - COUNT(DISTINCT item_code) as duplicate_count
FROM public.satguru_grn_log 
WHERE upload_source = 'OPENING_STOCK' OR vendor = 'Opening Stock' OR remarks ILIKE '%opening stock%';

-- Clean up duplicate opening stock entries, keeping only the earliest entry per item_code
WITH duplicate_opening_stock AS (
  SELECT 
    id,
    item_code,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY item_code 
      ORDER BY created_at ASC, id ASC
    ) as row_num
  FROM public.satguru_grn_log 
  WHERE upload_source = 'OPENING_STOCK' 
     OR vendor = 'Opening Stock' 
     OR remarks ILIKE '%opening stock%'
),
records_to_delete AS (
  SELECT id 
  FROM duplicate_opening_stock 
  WHERE row_num > 1
)
DELETE FROM public.satguru_grn_log 
WHERE id IN (SELECT id FROM records_to_delete);

-- Update all remaining opening stock entries to have consistent categorization
UPDATE public.satguru_grn_log 
SET 
  upload_source = 'OPENING_STOCK',
  vendor = 'Opening Stock',
  remarks = CASE 
    WHEN remarks IS NULL OR remarks = '' THEN 'Opening stock entry'
    WHEN remarks NOT ILIKE '%opening stock%' THEN 'Opening stock entry - ' || remarks
    ELSE remarks
  END
WHERE upload_source = 'OPENING_STOCK' 
   OR vendor = 'Opening Stock' 
   OR remarks ILIKE '%opening stock%';

-- Add a transaction_type column to better categorize entries
ALTER TABLE public.satguru_grn_log 
ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'REGULAR_GRN';

-- Update transaction types for better categorization
UPDATE public.satguru_grn_log 
SET transaction_type = CASE
  WHEN upload_source = 'OPENING_STOCK' OR vendor = 'Opening Stock' THEN 'OPENING_STOCK'
  WHEN vendor ILIKE '%return%' OR remarks ILIKE '%return%' THEN 'RETURN'
  WHEN vendor ILIKE '%adjustment%' OR remarks ILIKE '%adjustment%' THEN 'ADJUSTMENT'
  ELSE 'REGULAR_GRN'
END;

-- Create index for better performance on transaction type queries
CREATE INDEX IF NOT EXISTS idx_grn_log_transaction_type ON public.satguru_grn_log(transaction_type);

-- Add constraint to prevent future opening stock duplicates
-- Drop existing constraint if it exists
DROP INDEX IF EXISTS idx_grn_opening_stock_unique;

-- Create a more robust unique constraint for opening stock
CREATE UNIQUE INDEX idx_opening_stock_unique 
ON public.satguru_grn_log(item_code) 
WHERE transaction_type = 'OPENING_STOCK';

-- Verify the cleanup results
SELECT 
  'Post-Cleanup Analysis' as analysis_type,
  transaction_type,
  COUNT(*) as record_count,
  COUNT(DISTINCT item_code) as unique_items
FROM public.satguru_grn_log 
GROUP BY transaction_type
ORDER BY transaction_type;
