-- Phase 1: Database Architecture Fix
-- Add usage_type column to item_master table
ALTER TABLE public.item_master 
ADD COLUMN IF NOT EXISTS usage_type TEXT DEFAULT 'RAW_MATERIAL' 
CHECK (usage_type IN ('FINISHED_GOOD', 'RAW_MATERIAL', 'WIP', 'PACKAGING', 'CONSUMABLE'));

-- Create item_code_history table for audit trail
CREATE TABLE IF NOT EXISTS public.item_code_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_master_id UUID NOT NULL,
  old_item_code TEXT NOT NULL,
  new_item_code TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reason TEXT
);

-- Enable RLS on item_code_history
ALTER TABLE public.item_code_history ENABLE ROW LEVEL SECURITY;

-- Create policy for item_code_history
CREATE POLICY "Users can view item code history" ON public.item_code_history
FOR SELECT USING (true);

CREATE POLICY "Users can insert item code history" ON public.item_code_history
FOR INSERT WITH CHECK (changed_by = auth.uid());

-- Create Bill of Materials (BOM) table
CREATE TABLE IF NOT EXISTS public.bill_of_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fg_item_code TEXT NOT NULL,
  rm_item_code TEXT NOT NULL,
  quantity_required NUMERIC NOT NULL DEFAULT 1,
  unit_of_measure TEXT NOT NULL DEFAULT 'KG',
  specifications JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(fg_item_code, rm_item_code)
);

-- Enable RLS on BOM table
ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;

-- Create policies for BOM table
CREATE POLICY "DKEGL users can manage BOM" ON public.bill_of_materials
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() AND o.code = 'DKEGL'
  )
);

-- Create function to validate item code formats
CREATE OR REPLACE FUNCTION public.satguru_validate_item_code_format(p_item_code TEXT, p_usage_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Finished Goods: 8-digit numeric, ITM-prefix, or complex alphanumeric
  IF p_usage_type = 'FINISHED_GOOD' THEN
    RETURN (
      p_item_code ~ '^\d{8}$' OR                           -- 8-digit numeric
      p_item_code ~ '^ITM[A-Z0-9]+$' OR                   -- ITM prefix
      p_item_code ~ '^[A-Z0-9]{8,20}$'                    -- Complex alphanumeric
    );
  END IF;
  
  -- Raw Materials: structured underscore or hierarchical
  IF p_usage_type = 'RAW_MATERIAL' THEN
    RETURN (
      p_item_code ~ '^[A-Z]{2,4}_[A-Z0-9_]+$' OR         -- Structured underscore
      p_item_code ~ '^[A-Z0-9]{8,15}$'                    -- Legacy format
    );
  END IF;
  
  -- WIP and others: flexible format
  RETURN p_item_code ~ '^[A-Z0-9_-]{4,20}$';
END;
$$ LANGUAGE plpgsql;