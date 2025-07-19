
-- Add specifications column to satguru_item_master table
ALTER TABLE public.satguru_item_master 
ADD COLUMN specifications TEXT;

-- Add comment to document the column purpose
COMMENT ON COLUMN public.satguru_item_master.specifications IS 'Product specifications and technical details';
