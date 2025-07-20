
-- Phase 1: Emergency Database Fix
-- Check if transaction_type column exists and add it if missing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'satguru_grn_log' 
                   AND column_name = 'transaction_type') THEN
        ALTER TABLE public.satguru_grn_log 
        ADD COLUMN transaction_type TEXT DEFAULT 'REGULAR_GRN';
    END IF;
END $$;

-- Clean up duplicate opening stock entries (412 → 206 records)
-- Step 1: Identify and mark opening stock records consistently
UPDATE public.satguru_grn_log 
SET 
  upload_source = 'OPENING_STOCK',
  vendor = 'Opening Stock',
  transaction_type = 'OPENING_STOCK'
WHERE upload_source = 'OPENING_STOCK' 
   OR vendor = 'Opening Stock' 
   OR remarks ILIKE '%opening stock%'
   OR remarks ILIKE '%opening balance%';

-- Step 2: Delete duplicates, keeping only the earliest record per item_code
WITH duplicate_analysis AS (
  SELECT 
    id,
    item_code,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY item_code 
      ORDER BY created_at ASC, id ASC
    ) as row_num
  FROM public.satguru_grn_log 
  WHERE transaction_type = 'OPENING_STOCK'
),
duplicates_to_remove AS (
  SELECT id, item_code
  FROM duplicate_analysis 
  WHERE row_num > 1
)
DELETE FROM public.satguru_grn_log 
WHERE id IN (SELECT id FROM duplicates_to_remove);

-- Step 3: Set transaction types for all other records
UPDATE public.satguru_grn_log 
SET transaction_type = CASE
  WHEN transaction_type = 'OPENING_STOCK' THEN 'OPENING_STOCK'
  WHEN vendor ILIKE '%return%' OR remarks ILIKE '%return%' THEN 'RETURN'
  WHEN vendor ILIKE '%adjustment%' OR remarks ILIKE '%adjustment%' THEN 'ADJUSTMENT'
  ELSE 'REGULAR_GRN'
END
WHERE transaction_type IS NULL OR transaction_type = 'REGULAR_GRN';

-- Step 4: Create performance indexes
CREATE INDEX IF NOT EXISTS idx_grn_log_transaction_type ON public.satguru_grn_log(transaction_type);
CREATE INDEX IF NOT EXISTS idx_grn_log_item_code_type ON public.satguru_grn_log(item_code, transaction_type);

-- Step 5: Prevent future opening stock duplicates
DROP INDEX IF EXISTS idx_opening_stock_unique;
CREATE UNIQUE INDEX idx_opening_stock_unique 
ON public.satguru_grn_log(item_code) 
WHERE transaction_type = 'OPENING_STOCK';

-- Step 6: Update stock table to sync with cleaned GRN data
INSERT INTO public.satguru_stock (item_code, current_qty, last_updated)
SELECT 
  item_code,
  SUM(qty_received) as total_qty,
  MAX(created_at) as last_updated
FROM public.satguru_grn_log 
WHERE transaction_type = 'OPENING_STOCK'
GROUP BY item_code
ON CONFLICT (item_code) 
DO UPDATE SET 
  current_qty = EXCLUDED.current_qty,
  last_updated = EXCLUDED.last_updated;

-- Verification queries
SELECT 
  'Database Cleanup Results' as status,
  transaction_type,
  COUNT(*) as record_count,
  COUNT(DISTINCT item_code) as unique_items
FROM public.satguru_grn_log 
GROUP BY transaction_type
ORDER BY transaction_type;

SELECT 
  'Opening Stock Verification' as status,
  COUNT(*) as total_opening_stock_records,
  COUNT(DISTINCT item_code) as unique_item_codes
FROM public.satguru_grn_log 
WHERE transaction_type = 'OPENING_STOCK';
