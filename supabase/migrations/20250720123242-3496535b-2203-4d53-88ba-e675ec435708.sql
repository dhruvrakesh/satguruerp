
-- Add composite unique index for grn_number + item_code safety net
CREATE UNIQUE INDEX IF NOT EXISTS idx_satguru_grn_log_unique_grn_item 
ON satguru_grn_log (grn_number, item_code) 
WHERE grn_number IS NOT NULL AND item_code IS NOT NULL;

-- Add batch_id column for rollback capability
ALTER TABLE satguru_grn_log 
ADD COLUMN IF NOT EXISTS batch_id UUID;

-- Create bulk upload tracking table
CREATE TABLE IF NOT EXISTS satguru_grn_bulk_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  upload_status TEXT NOT NULL DEFAULT 'processing',
  upload_summary JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on the tracking table
ALTER TABLE satguru_grn_bulk_uploads ENABLE ROW LEVEL SECURITY;

-- Create policy for bulk upload tracking
CREATE POLICY "Satguru users can manage bulk upload tracking" ON satguru_grn_bulk_uploads
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() AND o.code = 'SATGURU'
  )
);
