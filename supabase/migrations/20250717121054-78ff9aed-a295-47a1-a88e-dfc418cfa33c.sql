-- Manufacturing Workflow Tables for Satguru Engravures
-- Phase 1: Enhanced Workflow Tables

-- Create process status enum
CREATE TYPE public.process_status AS ENUM ('PENDING', 'STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- Create material type enum
CREATE TYPE public.material_type AS ENUM ('PAPER', 'PLASTIC', 'FOIL', 'LAMINATE', 'COMPOSITE');

-- Create packaging type enum
CREATE TYPE public.packaging_type AS ENUM ('POUCH', 'BAG', 'ROLL', 'SHEET', 'CUSTOM');

-- 1. ORDER PUNCHING - Initial customer order intake and job setup
CREATE TABLE public.order_punching (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uiorn TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_code TEXT,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  order_quantity NUMERIC NOT NULL,
  unit_of_measure TEXT DEFAULT 'PCS',
  product_description TEXT NOT NULL,
  special_instructions TEXT,
  priority_level TEXT DEFAULT 'NORMAL' CHECK (priority_level IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  status process_status DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id)
);

-- 2. GRAVURE PRINTING - Printing process status
CREATE TABLE public.gravure_printing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uiorn TEXT NOT NULL REFERENCES order_punching(uiorn),
  cylinder_number TEXT,
  printing_speed NUMERIC,
  ink_consumption NUMERIC,
  substrate_width NUMERIC,
  print_length NUMERIC,
  color_count INTEGER,
  ink_colors JSONB, -- Array of color specifications
  printing_parameters JSONB, -- Temperature, pressure, etc.
  quality_checks JSONB, -- Quality control data
  waste_percentage NUMERIC DEFAULT 0,
  actual_quantity NUMERIC,
  status process_status DEFAULT 'PENDING',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  operator_id UUID REFERENCES auth.users(id),
  supervisor_id UUID REFERENCES auth.users(id)
);

-- 3. LAMINATION - Lamination process tracking
CREATE TABLE public.lamination (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uiorn TEXT NOT NULL REFERENCES order_punching(uiorn),
  lamination_type TEXT NOT NULL, -- Wet, Dry, Extrusion
  adhesive_type TEXT,
  substrate_1 TEXT NOT NULL, -- Primary substrate
  substrate_2 TEXT, -- Secondary substrate for lamination
  gsm_substrate_1 NUMERIC,
  gsm_substrate_2 NUMERIC,
  lamination_speed NUMERIC,
  temperature NUMERIC,
  pressure NUMERIC,
  adhesive_coating_weight NUMERIC,
  bond_strength NUMERIC, -- Test results
  peel_strength NUMERIC, -- Test results
  status process_status DEFAULT 'PENDING',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  operator_id UUID REFERENCES auth.users(id),
  quality_approved_by UUID REFERENCES auth.users(id)
);

-- 4. ADHESIVE COATING - Coating process management
CREATE TABLE public.adhesive_coating (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uiorn TEXT NOT NULL REFERENCES order_punching(uiorn),
  coating_type TEXT NOT NULL,
  adhesive_specification TEXT,
  coating_weight NUMERIC, -- grams per square meter
  coating_width NUMERIC,
  coating_speed NUMERIC,
  drying_temperature NUMERIC,
  curing_parameters JSONB,
  viscosity_readings JSONB, -- Array of viscosity measurements
  coat_weight_variance NUMERIC,
  adhesion_strength NUMERIC,
  status process_status DEFAULT 'PENDING',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  operator_id UUID REFERENCES auth.users(id),
  qc_approved_by UUID REFERENCES auth.users(id)
);

-- 5. SLITTING - Slitting/cutting operations
CREATE TABLE public.slitting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uiorn TEXT NOT NULL REFERENCES order_punching(uiorn),
  parent_roll_width NUMERIC NOT NULL,
  slit_widths JSONB NOT NULL, -- Array of slit widths
  number_of_slits INTEGER NOT NULL,
  slitting_speed NUMERIC,
  blade_type TEXT,
  core_diameter NUMERIC,
  rewind_tension NUMERIC,
  edge_trim_waste NUMERIC,
  total_waste_percentage NUMERIC,
  finished_roll_count INTEGER,
  status process_status DEFAULT 'PENDING',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  operator_id UUID REFERENCES auth.users(id),
  quality_checked_by UUID REFERENCES auth.users(id)
);

-- 6. PACKAGING PROJECTS - Packaging design projects
CREATE TABLE public.packaging_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uiorn TEXT NOT NULL REFERENCES order_punching(uiorn),
  project_name TEXT NOT NULL,
  packaging_type packaging_type NOT NULL,
  design_requirements TEXT,
  structural_specifications JSONB,
  barrier_properties JSONB, -- Oxygen, moisture, etc.
  shelf_life_requirements INTEGER, -- in days
  regulatory_compliance JSONB, -- FDA, EU, etc.
  sustainability_requirements TEXT,
  prototype_status TEXT DEFAULT 'NOT_STARTED',
  design_approval_status TEXT DEFAULT 'PENDING',
  customer_feedback TEXT,
  revision_count INTEGER DEFAULT 0,
  status process_status DEFAULT 'PENDING',
  design_started_at TIMESTAMP WITH TIME ZONE,
  design_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  designer_id UUID REFERENCES auth.users(id),
  project_manager_id UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id)
);

-- 7. MATERIAL SELECTION - Material specifications
CREATE TABLE public.material_selection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uiorn TEXT NOT NULL REFERENCES order_punching(uiorn),
  material_type material_type NOT NULL,
  material_grade TEXT NOT NULL,
  supplier_name TEXT,
  material_code TEXT,
  gsm NUMERIC,
  thickness_microns NUMERIC,
  width_mm NUMERIC,
  length_meters NUMERIC,
  tensile_strength NUMERIC,
  elongation_percentage NUMERIC,
  barrier_properties JSONB,
  food_grade_certified BOOLEAN DEFAULT false,
  sustainability_rating TEXT,
  cost_per_kg NUMERIC,
  minimum_order_quantity NUMERIC,
  lead_time_days INTEGER,
  selection_criteria TEXT,
  alternative_materials JSONB,
  status process_status DEFAULT 'PENDING',
  selected_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  selected_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id)
);

-- 8. PACKAGING SELECTION - Packaging type selection
CREATE TABLE public.packaging_selection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uiorn TEXT NOT NULL REFERENCES order_punching(uiorn),
  packaging_category TEXT NOT NULL,
  packaging_style TEXT NOT NULL,
  closure_type TEXT,
  handle_type TEXT,
  gusset_specifications JSONB,
  seal_type TEXT,
  perforation_requirements TEXT,
  window_specifications JSONB,
  printing_areas JSONB,
  die_cutting_requirements TEXT,
  finishing_options JSONB, -- Matt, gloss, UV coating, etc.
  regulatory_markings JSONB,
  child_resistant_features BOOLEAN DEFAULT false,
  tamper_evident_features BOOLEAN DEFAULT false,
  resealable_features BOOLEAN DEFAULT false,
  cost_impact_analysis TEXT,
  tooling_requirements TEXT,
  status process_status DEFAULT 'PENDING',
  selected_at TIMESTAMP WITH TIME ZONE,
  finalized_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  selected_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id)
);

-- 9. ARTWORK UPLOAD - Artwork and design files
CREATE TABLE public.artwork_upload (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uiorn TEXT NOT NULL REFERENCES order_punching(uiorn),
  artwork_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_mb NUMERIC,
  version_number INTEGER DEFAULT 1,
  artwork_specifications JSONB,
  color_specifications JSONB,
  print_ready BOOLEAN DEFAULT false,
  color_separation_done BOOLEAN DEFAULT false,
  proofing_status TEXT DEFAULT 'PENDING',
  customer_approval_status TEXT DEFAULT 'PENDING',
  revision_notes TEXT,
  print_dimensions JSONB,
  bleed_specifications JSONB,
  registration_marks BOOLEAN DEFAULT false,
  barcode_specifications JSONB,
  status process_status DEFAULT 'PENDING',
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id)
);

-- 10. COST MOCKUP ESTIMATE - Cost estimation and mockups
CREATE TABLE public.cost_mockup_estimate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uiorn TEXT NOT NULL REFERENCES order_punching(uiorn),
  estimate_type TEXT NOT NULL DEFAULT 'PRELIMINARY' CHECK (estimate_type IN ('PRELIMINARY', 'DETAILED', 'FINAL')),
  material_cost NUMERIC DEFAULT 0,
  printing_cost NUMERIC DEFAULT 0,
  lamination_cost NUMERIC DEFAULT 0,
  coating_cost NUMERIC DEFAULT 0,
  slitting_cost NUMERIC DEFAULT 0,
  packaging_cost NUMERIC DEFAULT 0,
  tooling_cost NUMERIC DEFAULT 0,
  setup_cost NUMERIC DEFAULT 0,
  labor_cost NUMERIC DEFAULT 0,
  overhead_cost NUMERIC DEFAULT 0,
  profit_margin_percentage NUMERIC DEFAULT 15,
  total_cost NUMERIC GENERATED ALWAYS AS (
    material_cost + printing_cost + lamination_cost + coating_cost + 
    slitting_cost + packaging_cost + tooling_cost + setup_cost + 
    labor_cost + overhead_cost
  ) STORED,
  selling_price NUMERIC,
  currency TEXT DEFAULT 'INR',
  validity_days INTEGER DEFAULT 30,
  mockup_required BOOLEAN DEFAULT false,
  mockup_cost NUMERIC DEFAULT 0,
  mockup_delivery_days INTEGER,
  mockup_status TEXT DEFAULT 'NOT_REQUIRED',
  cost_breakdown JSONB,
  competitive_analysis JSONB,
  customer_budget NUMERIC,
  negotiation_notes TEXT,
  status process_status DEFAULT 'PENDING',
  estimated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  estimated_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id)
);

-- Create indexes for performance
CREATE INDEX idx_order_punching_uiorn ON order_punching(uiorn);
CREATE INDEX idx_order_punching_status ON order_punching(status);
CREATE INDEX idx_order_punching_customer ON order_punching(customer_name);
CREATE INDEX idx_order_punching_delivery_date ON order_punching(delivery_date);

CREATE INDEX idx_gravure_printing_uiorn ON gravure_printing(uiorn);
CREATE INDEX idx_gravure_printing_status ON gravure_printing(status);
CREATE INDEX idx_lamination_uiorn ON lamination(uiorn);
CREATE INDEX idx_lamination_status ON lamination(status);
CREATE INDEX idx_adhesive_coating_uiorn ON adhesive_coating(uiorn);
CREATE INDEX idx_slitting_uiorn ON slitting(uiorn);
CREATE INDEX idx_packaging_projects_uiorn ON packaging_projects(uiorn);
CREATE INDEX idx_material_selection_uiorn ON material_selection(uiorn);
CREATE INDEX idx_packaging_selection_uiorn ON packaging_selection(uiorn);
CREATE INDEX idx_artwork_upload_uiorn ON artwork_upload(uiorn);
CREATE INDEX idx_cost_mockup_estimate_uiorn ON cost_mockup_estimate(uiorn);

-- Create updated_at triggers for all tables
CREATE OR REPLACE FUNCTION public.update_updated_at_workflow()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_punching_updated_at BEFORE UPDATE ON order_punching FOR EACH ROW EXECUTE FUNCTION update_updated_at_workflow();
CREATE TRIGGER update_gravure_printing_updated_at BEFORE UPDATE ON gravure_printing FOR EACH ROW EXECUTE FUNCTION update_updated_at_workflow();
CREATE TRIGGER update_lamination_updated_at BEFORE UPDATE ON lamination FOR EACH ROW EXECUTE FUNCTION update_updated_at_workflow();
CREATE TRIGGER update_adhesive_coating_updated_at BEFORE UPDATE ON adhesive_coating FOR EACH ROW EXECUTE FUNCTION update_updated_at_workflow();
CREATE TRIGGER update_slitting_updated_at BEFORE UPDATE ON slitting FOR EACH ROW EXECUTE FUNCTION update_updated_at_workflow();
CREATE TRIGGER update_packaging_projects_updated_at BEFORE UPDATE ON packaging_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_workflow();
CREATE TRIGGER update_material_selection_updated_at BEFORE UPDATE ON material_selection FOR EACH ROW EXECUTE FUNCTION update_updated_at_workflow();
CREATE TRIGGER update_packaging_selection_updated_at BEFORE UPDATE ON packaging_selection FOR EACH ROW EXECUTE FUNCTION update_updated_at_workflow();
CREATE TRIGGER update_artwork_upload_updated_at BEFORE UPDATE ON artwork_upload FOR EACH ROW EXECUTE FUNCTION update_updated_at_workflow();
CREATE TRIGGER update_cost_mockup_estimate_updated_at BEFORE UPDATE ON cost_mockup_estimate FOR EACH ROW EXECUTE FUNCTION update_updated_at_workflow();

-- Function to count workflow statuses across all processes
CREATE OR REPLACE FUNCTION public.satguru_get_workflow_status_counts(p_uiorn TEXT DEFAULT NULL)
RETURNS TABLE(
  process_name TEXT,
  pending_count BIGINT,
  started_count BIGINT,
  in_progress_count BIGINT,
  completed_count BIGINT,
  on_hold_count BIGINT,
  cancelled_count BIGINT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH process_counts AS (
    SELECT 'Order Punching' as process_name, status, COUNT(*) as count_val
    FROM order_punching 
    WHERE (p_uiorn IS NULL OR uiorn = p_uiorn)
    GROUP BY status
    
    UNION ALL
    
    SELECT 'Gravure Printing' as process_name, status, COUNT(*) as count_val
    FROM gravure_printing 
    WHERE (p_uiorn IS NULL OR uiorn = p_uiorn)
    GROUP BY status
    
    UNION ALL
    
    SELECT 'Lamination' as process_name, status, COUNT(*) as count_val
    FROM lamination 
    WHERE (p_uiorn IS NULL OR uiorn = p_uiorn)
    GROUP BY status
    
    UNION ALL
    
    SELECT 'Adhesive Coating' as process_name, status, COUNT(*) as count_val
    FROM adhesive_coating 
    WHERE (p_uiorn IS NULL OR uiorn = p_uiorn)
    GROUP BY status
    
    UNION ALL
    
    SELECT 'Slitting' as process_name, status, COUNT(*) as count_val
    FROM slitting 
    WHERE (p_uiorn IS NULL OR uiorn = p_uiorn)
    GROUP BY status
    
    UNION ALL
    
    SELECT 'Packaging Projects' as process_name, status, COUNT(*) as count_val
    FROM packaging_projects 
    WHERE (p_uiorn IS NULL OR uiorn = p_uiorn)
    GROUP BY status
    
    UNION ALL
    
    SELECT 'Material Selection' as process_name, status, COUNT(*) as count_val
    FROM material_selection 
    WHERE (p_uiorn IS NULL OR uiorn = p_uiorn)
    GROUP BY status
    
    UNION ALL
    
    SELECT 'Packaging Selection' as process_name, status, COUNT(*) as count_val
    FROM packaging_selection 
    WHERE (p_uiorn IS NULL OR uiorn = p_uiorn)
    GROUP BY status
    
    UNION ALL
    
    SELECT 'Artwork Upload' as process_name, status, COUNT(*) as count_val
    FROM artwork_upload 
    WHERE (p_uiorn IS NULL OR uiorn = p_uiorn)
    GROUP BY status
    
    UNION ALL
    
    SELECT 'Cost Mockup Estimate' as process_name, status, COUNT(*) as count_val
    FROM cost_mockup_estimate 
    WHERE (p_uiorn IS NULL OR uiorn = p_uiorn)
    GROUP BY status
  )
  SELECT 
    pc.process_name,
    COALESCE(SUM(CASE WHEN pc.status = 'PENDING' THEN pc.count_val END), 0) as pending_count,
    COALESCE(SUM(CASE WHEN pc.status = 'STARTED' THEN pc.count_val END), 0) as started_count,
    COALESCE(SUM(CASE WHEN pc.status = 'IN_PROGRESS' THEN pc.count_val END), 0) as in_progress_count,
    COALESCE(SUM(CASE WHEN pc.status = 'COMPLETED' THEN pc.count_val END), 0) as completed_count,
    COALESCE(SUM(CASE WHEN pc.status = 'ON_HOLD' THEN pc.count_val END), 0) as on_hold_count,
    COALESCE(SUM(CASE WHEN pc.status = 'CANCELLED' THEN pc.count_val END), 0) as cancelled_count,
    COALESCE(SUM(pc.count_val), 0) as total_count
  FROM process_counts pc
  GROUP BY pc.process_name
  ORDER BY pc.process_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comprehensive workflow summary for a specific order
CREATE OR REPLACE FUNCTION public.satguru_get_workflow_summary(p_uiorn TEXT)
RETURNS TABLE(
  uiorn TEXT,
  customer_name TEXT,
  order_date DATE,
  delivery_date DATE,
  order_status process_status,
  order_punching_status process_status,
  gravure_printing_status process_status,
  lamination_status process_status,
  adhesive_coating_status process_status,
  slitting_status process_status,
  packaging_projects_status process_status,
  material_selection_status process_status,
  packaging_selection_status process_status,
  artwork_upload_status process_status,
  cost_estimate_status process_status,
  overall_completion_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    op.uiorn,
    op.customer_name,
    op.order_date,
    op.delivery_date,
    op.status as order_status,
    op.status as order_punching_status,
    COALESCE(gp.status, 'PENDING'::process_status) as gravure_printing_status,
    COALESCE(lam.status, 'PENDING'::process_status) as lamination_status,
    COALESCE(ac.status, 'PENDING'::process_status) as adhesive_coating_status,
    COALESCE(sl.status, 'PENDING'::process_status) as slitting_status,
    COALESCE(pp.status, 'PENDING'::process_status) as packaging_projects_status,
    COALESCE(ms.status, 'PENDING'::process_status) as material_selection_status,
    COALESCE(ps.status, 'PENDING'::process_status) as packaging_selection_status,
    COALESCE(au.status, 'PENDING'::process_status) as artwork_upload_status,
    COALESCE(cme.status, 'PENDING'::process_status) as cost_estimate_status,
    -- Calculate completion percentage
    ROUND(
      (
        (CASE WHEN op.status = 'COMPLETED' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(gp.status, 'PENDING') = 'COMPLETED' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(lam.status, 'PENDING') = 'COMPLETED' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(ac.status, 'PENDING') = 'COMPLETED' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(sl.status, 'PENDING') = 'COMPLETED' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(pp.status, 'PENDING') = 'COMPLETED' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(ms.status, 'PENDING') = 'COMPLETED' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(ps.status, 'PENDING') = 'COMPLETED' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(au.status, 'PENDING') = 'COMPLETED' THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(cme.status, 'PENDING') = 'COMPLETED' THEN 1 ELSE 0 END)
      ) * 100.0 / 10, 1
    ) as overall_completion_percentage
  FROM order_punching op
  LEFT JOIN gravure_printing gp ON op.uiorn = gp.uiorn
  LEFT JOIN lamination lam ON op.uiorn = lam.uiorn
  LEFT JOIN adhesive_coating ac ON op.uiorn = ac.uiorn
  LEFT JOIN slitting sl ON op.uiorn = sl.uiorn
  LEFT JOIN packaging_projects pp ON op.uiorn = pp.uiorn
  LEFT JOIN material_selection ms ON op.uiorn = ms.uiorn
  LEFT JOIN packaging_selection ps ON op.uiorn = ps.uiorn
  LEFT JOIN artwork_upload au ON op.uiorn = au.uiorn
  LEFT JOIN cost_mockup_estimate cme ON op.uiorn = cme.uiorn
  WHERE op.uiorn = p_uiorn;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for all tables
ALTER TABLE public.order_punching ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gravure_printing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lamination ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adhesive_coating ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slitting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_selection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_selection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artwork_upload ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_mockup_estimate ENABLE ROW LEVEL SECURITY;

-- Satguru users can manage all workflow data
CREATE POLICY "Satguru users can manage order punching" ON public.order_punching
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      JOIN organizations o ON p.organization_id = o.id 
      WHERE p.id = auth.uid() AND o.code = 'SATGURU'
    )
  );

CREATE POLICY "Satguru users can manage gravure printing" ON public.gravure_printing
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      JOIN organizations o ON p.organization_id = o.id 
      WHERE p.id = auth.uid() AND o.code = 'SATGURU'
    )
  );

CREATE POLICY "Satguru users can manage lamination" ON public.lamination
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      JOIN organizations o ON p.organization_id = o.id 
      WHERE p.id = auth.uid() AND o.code = 'SATGURU'
    )
  );

CREATE POLICY "Satguru users can manage adhesive coating" ON public.adhesive_coating
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      JOIN organizations o ON p.organization_id = o.id 
      WHERE p.id = auth.uid() AND o.code = 'SATGURU'
    )
  );

CREATE POLICY "Satguru users can manage slitting" ON public.slitting
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      JOIN organizations o ON p.organization_id = o.id 
      WHERE p.id = auth.uid() AND o.code = 'SATGURU'
    )
  );

CREATE POLICY "Satguru users can manage packaging projects" ON public.packaging_projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      JOIN organizations o ON p.organization_id = o.id 
      WHERE p.id = auth.uid() AND o.code = 'SATGURU'
    )
  );

CREATE POLICY "Satguru users can manage material selection" ON public.material_selection
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      JOIN organizations o ON p.organization_id = o.id 
      WHERE p.id = auth.uid() AND o.code = 'SATGURU'
    )
  );

CREATE POLICY "Satguru users can manage packaging selection" ON public.packaging_selection
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      JOIN organizations o ON p.organization_id = o.id 
      WHERE p.id = auth.uid() AND o.code = 'SATGURU'
    )
  );

CREATE POLICY "Satguru users can manage artwork upload" ON public.artwork_upload
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      JOIN organizations o ON p.organization_id = o.id 
      WHERE p.id = auth.uid() AND o.code = 'SATGURU'
    )
  );

CREATE POLICY "Satguru users can manage cost mockup estimate" ON public.cost_mockup_estimate
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      JOIN organizations o ON p.organization_id = o.id 
      WHERE p.id = auth.uid() AND o.code = 'SATGURU'
    )
  );