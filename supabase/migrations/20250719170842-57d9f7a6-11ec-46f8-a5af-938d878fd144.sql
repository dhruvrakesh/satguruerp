
-- Add status column to satguru_cylinders table
ALTER TABLE public.satguru_cylinders 
ADD COLUMN status TEXT DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'IN_USE', 'MAINTENANCE'));

-- Update any existing records to have default status
UPDATE public.satguru_cylinders 
SET status = 'AVAILABLE' 
WHERE status IS NULL;

-- Make status column NOT NULL after setting defaults
ALTER TABLE public.satguru_cylinders 
ALTER COLUMN status SET NOT NULL;
