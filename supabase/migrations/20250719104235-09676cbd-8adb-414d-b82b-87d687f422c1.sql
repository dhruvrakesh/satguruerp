
-- Fix the satguru_item_master table schema
-- 1. Change specifications column from TEXT to JSONB to store JSON objects
ALTER TABLE public.satguru_item_master 
ALTER COLUMN specifications TYPE JSONB USING specifications::JSONB;

-- 2. Add customer_name column that's being referenced in the code
ALTER TABLE public.satguru_item_master 
ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- 3. Add comment to document the changes
COMMENT ON COLUMN public.satguru_item_master.specifications IS 'JSON object containing customer specifications, dimensions, colors, etc.';
COMMENT ON COLUMN public.satguru_item_master.customer_name IS 'Customer name for the item, used for filtering and display';

-- 4. Update existing records to populate customer_name from specifications if available
UPDATE public.satguru_item_master 
SET customer_name = (specifications->>'customer_name')
WHERE specifications IS NOT NULL 
  AND specifications::TEXT != 'null' 
  AND specifications->>'customer_name' IS NOT NULL
  AND customer_name IS NULL;
