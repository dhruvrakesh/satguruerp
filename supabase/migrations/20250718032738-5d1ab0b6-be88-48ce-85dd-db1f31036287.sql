-- Add missing manufacturing process tables and enhance existing ones

-- Slitting Operations Table
CREATE TABLE public.slitting_operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uiorn TEXT NOT NULL,
  slitting_width NUMERIC,
  slitting_length NUMERIC,
  number_of_reels INTEGER,
  reel_specifications JSONB,
  slitting_speed NUMERIC,
  operator_id UUID,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status process_status DEFAULT 'PENDING',
  quality_checks JSONB,
  waste_percentage NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY (uiorn) REFERENCES order_punching(uiorn)
);

-- Packaging Operations Table
CREATE TABLE public.packaging_operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uiorn TEXT NOT NULL,
  packaging_type TEXT NOT NULL,
  packaging_specifications JSONB,
  quantity_packed INTEGER,
  packaging_materials JSONB,
  operator_id UUID,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status process_status DEFAULT 'PENDING',
  quality_checks JSONB,
  batch_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY (uiorn) REFERENCES order_punching(uiorn)
);

-- Quality Control Checkpoints Table
CREATE TABLE public.quality_checkpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uiorn TEXT NOT NULL,
  process_stage process_stage NOT NULL,
  checkpoint_type TEXT NOT NULL,
  quality_parameters JSONB NOT NULL,
  test_results JSONB,
  passed BOOLEAN,
  inspector_id UUID,
  inspected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  remarks TEXT,
  corrective_actions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY (uiorn) REFERENCES order_punching(uiorn)
);

-- Machine Assignments Table
CREATE TABLE public.machine_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uiorn TEXT NOT NULL,
  process_stage process_stage NOT NULL,
  machine_id TEXT NOT NULL,
  operator_id UUID,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'ASSIGNED',
  efficiency_metrics JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY (uiorn) REFERENCES order_punching(uiorn)
);

-- Raw Material Consumption Table
CREATE TABLE public.raw_material_consumption (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uiorn TEXT NOT NULL,
  process_stage process_stage NOT NULL,
  material_code TEXT NOT NULL,
  quantity_consumed NUMERIC NOT NULL,
  unit_of_measure TEXT NOT NULL,
  consumption_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  operator_id UUID,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY (uiorn) REFERENCES order_punching(uiorn)
);

-- Production Waste Tracking Table
CREATE TABLE public.production_waste (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uiorn TEXT NOT NULL,
  process_stage process_stage NOT NULL,
  waste_type TEXT NOT NULL,
  waste_quantity NUMERIC NOT NULL,
  waste_value NUMERIC,
  waste_reason TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  operator_id UUID,
  disposal_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY (uiorn) REFERENCES order_punching(uiorn)
);

-- Lamination Operations Table (enhance existing or create if missing)
CREATE TABLE IF NOT EXISTS public.lamination_operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uiorn TEXT NOT NULL,
  lamination_type TEXT NOT NULL,
  substrate_layers JSONB,
  adhesive_type TEXT,
  lamination_speed NUMERIC,
  lamination_temperature NUMERIC,
  pressure_settings NUMERIC,
  operator_id UUID,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status process_status DEFAULT 'PENDING',
  quality_checks JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY (uiorn) REFERENCES order_punching(uiorn)
);

-- Create comprehensive workflow view for dashboard
CREATE OR REPLACE VIEW public.manufacturing_workflow_view AS
SELECT 
  op.uiorn,
  op.customer_name,
  op.product_description,
  op.quantity,
  op.created_at as order_date,
  op.delivery_date,
  op.priority_level,
  op.status as order_status,
  
  -- Process stages status
  ss.stage,
  ss.status as stage_status,
  ss.started_at as stage_started,
  ss.finished_at as stage_finished,
  ss.remarks as stage_remarks,
  
  -- Machine assignments
  ma.machine_id,
  ma.operator_id,
  ma.efficiency_metrics,
  
  -- Quality status
  CASE 
    WHEN EXISTS (SELECT 1 FROM quality_checkpoints qc WHERE qc.uiorn = op.uiorn AND qc.process_stage = ss.stage AND qc.passed = false)
    THEN 'FAILED'
    WHEN EXISTS (SELECT 1 FROM quality_checkpoints qc WHERE qc.uiorn = op.uiorn AND qc.process_stage = ss.stage AND qc.passed = true)
    THEN 'PASSED'
    ELSE 'PENDING'
  END as quality_status,
  
  -- Progress calculation
  CASE 
    WHEN ss.finished_at IS NOT NULL THEN 100
    WHEN ss.started_at IS NOT NULL THEN 50
    ELSE 0
  END as stage_progress
  
FROM order_punching op
LEFT JOIN stage_status_dkpkl ss ON op.uiorn = ss.uiorn
LEFT JOIN machine_assignments ma ON op.uiorn = ma.uiorn AND ma.process_stage = ss.stage
ORDER BY op.created_at DESC, ss.stage;

-- Create indexes for performance
CREATE INDEX idx_slitting_operations_uiorn ON slitting_operations(uiorn);
CREATE INDEX idx_packaging_operations_uiorn ON packaging_operations(uiorn);
CREATE INDEX idx_quality_checkpoints_uiorn_stage ON quality_checkpoints(uiorn, process_stage);
CREATE INDEX idx_machine_assignments_uiorn_stage ON machine_assignments(uiorn, process_stage);
CREATE INDEX idx_raw_material_consumption_uiorn ON raw_material_consumption(uiorn);
CREATE INDEX idx_production_waste_uiorn ON production_waste(uiorn);

-- Enable RLS policies
ALTER TABLE slitting_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_material_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_waste ENABLE ROW LEVEL SECURITY;
ALTER TABLE lamination_operations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for Satguru users
CREATE POLICY "Satguru users can manage slitting operations" ON slitting_operations
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid() AND o.code = 'SATGURU'
  )
);

CREATE POLICY "Satguru users can manage packaging operations" ON packaging_operations
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid() AND o.code = 'SATGURU'
  )
);

CREATE POLICY "Satguru users can manage quality checkpoints" ON quality_checkpoints
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid() AND o.code = 'SATGURU'
  )
);

CREATE POLICY "Satguru users can manage machine assignments" ON machine_assignments
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid() AND o.code = 'SATGURU'
  )
);

CREATE POLICY "Satguru users can manage raw material consumption" ON raw_material_consumption
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid() AND o.code = 'SATGURU'
  )
);

CREATE POLICY "Satguru users can manage production waste" ON production_waste
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid() AND o.code = 'SATGURU'
  )
);

CREATE POLICY "Satguru users can manage lamination operations" ON lamination_operations
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid() AND o.code = 'SATGURU'
  )
);

-- Create function to update order progress
CREATE OR REPLACE FUNCTION public.calculate_order_progress(p_uiorn TEXT)
RETURNS NUMERIC AS $$
DECLARE
  total_stages INTEGER;
  completed_stages INTEGER;
  progress NUMERIC;
BEGIN
  -- Count total stages for this order
  SELECT COUNT(*) INTO total_stages
  FROM stage_status_dkpkl
  WHERE uiorn = p_uiorn;
  
  -- Count completed stages
  SELECT COUNT(*) INTO completed_stages
  FROM stage_status_dkpkl
  WHERE uiorn = p_uiorn AND status = 'done';
  
  -- Calculate progress percentage
  IF total_stages > 0 THEN
    progress := (completed_stages::NUMERIC / total_stages::NUMERIC) * 100;
  ELSE
    progress := 0;
  END IF;
  
  RETURN progress;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get workflow bottlenecks
CREATE OR REPLACE FUNCTION public.get_workflow_bottlenecks()
RETURNS TABLE(
  stage process_stage,
  pending_orders INTEGER,
  avg_processing_time NUMERIC,
  bottleneck_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.stage,
    COUNT(CASE WHEN ss.status = 'in-progress' THEN 1 END)::INTEGER as pending_orders,
    AVG(EXTRACT(EPOCH FROM (COALESCE(ss.finished_at, NOW()) - ss.started_at))/3600)::NUMERIC as avg_processing_time,
    (COUNT(CASE WHEN ss.status = 'in-progress' THEN 1 END) * 
     AVG(EXTRACT(EPOCH FROM (COALESCE(ss.finished_at, NOW()) - ss.started_at))/3600))::NUMERIC as bottleneck_score
  FROM stage_status_dkpkl ss
  WHERE ss.started_at IS NOT NULL
  GROUP BY ss.stage
  ORDER BY bottleneck_score DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;