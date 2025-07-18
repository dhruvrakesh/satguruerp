
-- Create material flow tracking table
CREATE TABLE IF NOT EXISTS public.material_flow_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uiorn TEXT NOT NULL,
  process_stage process_stage NOT NULL,
  input_material_type TEXT NOT NULL,
  input_quantity NUMERIC NOT NULL DEFAULT 0,
  input_unit TEXT NOT NULL DEFAULT 'KG',
  input_source_process TEXT,
  output_good_quantity NUMERIC NOT NULL DEFAULT 0,
  output_rework_quantity NUMERIC NOT NULL DEFAULT 0,
  output_waste_quantity NUMERIC NOT NULL DEFAULT 0,
  waste_classification TEXT NOT NULL DEFAULT 'OTHER',
  rework_reason TEXT,
  yield_percentage NUMERIC NOT NULL DEFAULT 0,
  material_cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  total_input_cost NUMERIC NOT NULL DEFAULT 0,
  waste_cost_impact NUMERIC NOT NULL DEFAULT 0,
  quality_grade TEXT NOT NULL DEFAULT 'GRADE_A',
  operator_id UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create process transfers table
CREATE TABLE IF NOT EXISTS public.process_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uiorn TEXT NOT NULL,
  from_process TEXT NOT NULL,
  to_process TEXT NOT NULL,
  material_type TEXT NOT NULL,
  quantity_sent NUMERIC NOT NULL,
  quantity_received NUMERIC,
  unit_of_measure TEXT NOT NULL DEFAULT 'KG',
  transfer_status TEXT NOT NULL DEFAULT 'INITIATED',
  sent_by UUID REFERENCES auth.users(id),
  received_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  received_at TIMESTAMP WITH TIME ZONE,
  discrepancy_notes TEXT,
  quality_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.material_flow_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_transfers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for material_flow_tracking
CREATE POLICY "Satguru users can manage material flow tracking" ON public.material_flow_tracking
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() AND o.code = 'SATGURU'
  )
);

-- Create RLS policies for process_transfers
CREATE POLICY "Satguru users can manage process transfers" ON public.process_transfers
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() AND o.code = 'SATGURU'
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_material_flow_tracking_uiorn ON public.material_flow_tracking(uiorn);
CREATE INDEX IF NOT EXISTS idx_material_flow_tracking_stage ON public.material_flow_tracking(process_stage);
CREATE INDEX IF NOT EXISTS idx_process_transfers_uiorn ON public.process_transfers(uiorn);
CREATE INDEX IF NOT EXISTS idx_process_transfers_status ON public.process_transfers(transfer_status);
