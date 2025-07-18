
-- Add missing columns to bill_of_materials table
ALTER TABLE public.bill_of_materials 
ADD COLUMN IF NOT EXISTS gsm_contribution NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS percentage_contribution NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_code TEXT,
ADD COLUMN IF NOT EXISTS bom_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing records to have default values
UPDATE public.bill_of_materials 
SET 
  gsm_contribution = COALESCE(gsm_contribution, 0),
  percentage_contribution = COALESCE(percentage_contribution, 0),
  bom_version = COALESCE(bom_version, 1),
  is_active = COALESCE(is_active, true)
WHERE gsm_contribution IS NULL 
   OR percentage_contribution IS NULL 
   OR bom_version IS NULL 
   OR is_active IS NULL;
