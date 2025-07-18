
-- Phase 1: Database Architecture Fix
-- Add item_code column to order_punching table with foreign key to item_master
ALTER TABLE public.order_punching 
ADD COLUMN IF NOT EXISTS item_code TEXT;

-- Add foreign key constraint to link orders to item_master
ALTER TABLE public.order_punching 
ADD CONSTRAINT fk_order_punching_item_code 
FOREIGN KEY (item_code) REFERENCES public.item_master(item_code);

-- Update item_master to include customer_name for direct lookup
ALTER TABLE public.item_master 
ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Populate customer_name in item_master from master_data_artworks_se
UPDATE public.item_master 
SET customer_name = mda.customer_name
FROM public.master_data_artworks_se mda
WHERE public.item_master.item_code = mda.item_code
AND public.item_master.customer_name IS NULL;

-- Create index for better performance on item_code lookups
CREATE INDEX IF NOT EXISTS idx_order_punching_item_code ON public.order_punching(item_code);
CREATE INDEX IF NOT EXISTS idx_item_master_customer_name ON public.item_master(customer_name);

-- Create order_wastage table for tracking wastage per UIORN
CREATE TABLE IF NOT EXISTS public.order_wastage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uiorn TEXT NOT NULL,
  stage TEXT NOT NULL,
  material_wasted NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  cost_impact NUMERIC DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  recorded_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on order_wastage
ALTER TABLE public.order_wastage ENABLE ROW LEVEL SECURITY;

-- Create policy for order_wastage
CREATE POLICY "Satguru users can manage order wastage" ON public.order_wastage
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() AND o.code = 'SATGURU'
  )
);

-- Update existing orders with item_codes where possible (best effort)
UPDATE public.order_punching 
SET item_code = mda.item_code
FROM public.master_data_artworks_se mda
WHERE public.order_punching.product_description = mda.item_name
AND public.order_punching.item_code IS NULL;

-- Alternative matching for partial descriptions
UPDATE public.order_punching 
SET item_code = mda.item_code
FROM public.master_data_artworks_se mda
WHERE mda.item_name ILIKE '%' || public.order_punching.product_description || '%'
AND public.order_punching.item_code IS NULL
AND LENGTH(public.order_punching.product_description) > 5;
