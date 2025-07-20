
-- Phase 1: Create upload batch tracking table
CREATE TABLE IF NOT EXISTS public.upload_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  upload_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  successful_records INTEGER NOT NULL DEFAULT 0,
  failed_records INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED', 'ROLLED_BACK'))
);

-- Add RLS policy for upload batches
ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own upload batches" ON public.upload_batches
FOR ALL USING (auth.uid() = uploaded_by);

-- Add batch_id columns to existing tables
ALTER TABLE public.satguru_grn_log 
ADD COLUMN IF NOT EXISTS batch_id UUID,
ADD COLUMN IF NOT EXISTS upload_source TEXT DEFAULT 'MANUAL';

ALTER TABLE public.satguru_stock 
ADD COLUMN IF NOT EXISTS batch_id UUID,
ADD COLUMN IF NOT EXISTS upload_source TEXT DEFAULT 'MANUAL';

-- Create index for better performance on batch queries
CREATE INDEX IF NOT EXISTS idx_grn_log_batch_id ON public.satguru_grn_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_batch_id ON public.satguru_stock(batch_id);
CREATE INDEX IF NOT EXISTS idx_upload_batches_hash ON public.upload_batches(file_hash);

-- Add unique constraint to prevent duplicate opening stock GRN entries
-- First, let's create a partial unique index for opening stock entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_grn_opening_stock_unique 
ON public.satguru_grn_log(item_code, date) 
WHERE upload_source = 'OPENING_STOCK';

-- Function to check for duplicate uploads
CREATE OR REPLACE FUNCTION public.check_duplicate_upload(
  p_file_hash TEXT,
  p_upload_type TEXT,
  p_hours_threshold INTEGER DEFAULT 24
) RETURNS TABLE(
  is_duplicate BOOLEAN,
  original_batch_id UUID,
  original_upload_time TIMESTAMP WITH TIME ZONE,
  records_count INTEGER
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as is_duplicate,
    ub.batch_id,
    ub.created_at,
    ub.total_records
  FROM public.upload_batches ub
  WHERE ub.file_hash = p_file_hash 
    AND ub.upload_type = p_upload_type
    AND ub.status = 'COMPLETED'
    AND ub.created_at > (now() - INTERVAL '1 hour' * p_hours_threshold)
  ORDER BY ub.created_at DESC
  LIMIT 1;
  
  -- If no duplicates found, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, NULL::UUID, NULL::TIMESTAMP WITH TIME ZONE, 0::INTEGER;
  END IF;
END;
$$;

-- Function to clean up duplicate opening stock entries
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_opening_stock()
RETURNS TABLE(
  items_cleaned INTEGER,
  duplicates_removed INTEGER
) LANGUAGE plpgsql AS $$
DECLARE
  cleanup_count INTEGER := 0;
  items_count INTEGER := 0;
BEGIN
  -- Count items that have duplicates
  SELECT COUNT(DISTINCT item_code) INTO items_count
  FROM (
    SELECT item_code, COUNT(*) as cnt
    FROM public.satguru_grn_log 
    WHERE vendor = 'Opening Stock' OR remarks ILIKE '%opening stock%'
    GROUP BY item_code
    HAVING COUNT(*) > 1
  ) t;
  
  -- Delete duplicates, keeping only the earliest entry per item
  WITH duplicate_entries AS (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY item_code ORDER BY created_at ASC) as rn
    FROM public.satguru_grn_log 
    WHERE vendor = 'Opening Stock' OR remarks ILIKE '%opening stock%'
  )
  DELETE FROM public.satguru_grn_log 
  WHERE id IN (
    SELECT id FROM duplicate_entries WHERE rn > 1
  );
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  RETURN QUERY SELECT items_count, cleanup_count;
END;
$$;

-- Update existing opening stock entries to have proper source tracking
UPDATE public.satguru_grn_log 
SET upload_source = 'OPENING_STOCK'
WHERE vendor = 'Opening Stock' OR remarks ILIKE '%opening stock%';

-- Create trigger to update batch tracking
CREATE OR REPLACE FUNCTION public.update_upload_batch_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Update batch statistics when records are inserted
  IF TG_OP = 'INSERT' AND NEW.batch_id IS NOT NULL THEN
    UPDATE public.upload_batches 
    SET successful_records = successful_records + 1,
        updated_at = now()
    WHERE batch_id = NEW.batch_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply trigger to relevant tables
DROP TRIGGER IF EXISTS trg_update_batch_stats_grn ON public.satguru_grn_log;
CREATE TRIGGER trg_update_batch_stats_grn
    AFTER INSERT ON public.satguru_grn_log
    FOR EACH ROW EXECUTE FUNCTION public.update_upload_batch_stats();

DROP TRIGGER IF EXISTS trg_update_batch_stats_stock ON public.satguru_stock;
CREATE TRIGGER trg_update_batch_stats_stock
    AFTER INSERT OR UPDATE ON public.satguru_stock
    FOR EACH ROW EXECUTE FUNCTION public.update_upload_batch_stats();
