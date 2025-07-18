
-- Add GRAVURE_PRINTING to the process_stage enum
ALTER TYPE process_stage ADD VALUE 'GRAVURE_PRINTING';

-- Create Satguru cylinder management table
CREATE TABLE IF NOT EXISTS public.satguru_cylinders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cylinder_code TEXT UNIQUE NOT NULL,
  item_code TEXT NOT NULL,
  cylinder_name TEXT NOT NULL,
  colour TEXT NOT NULL,
  cylinder_size NUMERIC,
  type TEXT DEFAULT 'GRAVURE',
  manufacturer TEXT,
  location TEXT,
  mileage_m NUMERIC DEFAULT 0,
  last_run TEXT,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Add foreign key to link with artwork table
ALTER TABLE public.satguru_cylinders 
ADD CONSTRAINT fk_satguru_cylinders_item_code 
FOREIGN KEY (item_code) REFERENCES public._artworks_revised_staging(item_code);

-- Create BOM groups table for organized material grouping
CREATE TABLE IF NOT EXISTS public.bom_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name TEXT NOT NULL,
  group_code TEXT UNIQUE NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enhance BOM table with group reference
ALTER TABLE public.bill_of_materials 
ADD COLUMN IF NOT EXISTS bom_group_id UUID REFERENCES public.bom_groups(id),
ADD COLUMN IF NOT EXISTS consumption_rate NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS wastage_percentage NUMERIC DEFAULT 0;

-- Create UIORN material consumption tracking table
CREATE TABLE IF NOT EXISTS public.uiorn_material_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uiorn TEXT NOT NULL,
  rm_item_code TEXT NOT NULL,
  process_stage process_stage NOT NULL,
  planned_quantity NUMERIC NOT NULL,
  actual_quantity NUMERIC DEFAULT 0,
  wastage_quantity NUMERIC DEFAULT 0,
  unit_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  consumed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  recorded_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Enable RLS on new tables
ALTER TABLE public.satguru_cylinders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uiorn_material_consumption ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for Satguru users
CREATE POLICY "Satguru users can manage cylinders" ON public.satguru_cylinders
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() AND o.code = 'SATGURU'
  )
);

CREATE POLICY "Approved users can manage BOM groups" ON public.bom_groups
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() AND p.is_approved = true 
    AND o.code IN ('DKEGL', 'SATGURU')
  )
);

CREATE POLICY "Approved users can manage material consumption" ON public.uiorn_material_consumption
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() AND p.is_approved = true 
    AND o.code IN ('DKEGL', 'SATGURU')
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_satguru_cylinders_item_code ON public.satguru_cylinders(item_code);
CREATE INDEX IF NOT EXISTS idx_uiorn_material_consumption_uiorn ON public.uiorn_material_consumption(uiorn);
CREATE INDEX IF NOT EXISTS idx_uiorn_material_consumption_stage ON public.uiorn_material_consumption(process_stage);
