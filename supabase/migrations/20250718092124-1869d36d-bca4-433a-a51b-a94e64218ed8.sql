-- Add missing columns to item_master table for artwork import functionality
ALTER TABLE public.item_master 
ADD COLUMN IF NOT EXISTS qualifier text,
ADD COLUMN IF NOT EXISTS gsm numeric,
ADD COLUMN IF NOT EXISTS size_mm text,
ADD COLUMN IF NOT EXISTS specifications jsonb;

-- Update the existing trigger to handle the new updated_at column properly
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists for item_master table
DROP TRIGGER IF EXISTS update_item_master_updated_at ON public.item_master;
CREATE TRIGGER update_item_master_updated_at
  BEFORE UPDATE ON public.item_master
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();