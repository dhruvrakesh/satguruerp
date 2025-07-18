-- Fixed Data Migration with correct enum types

-- First check what status values are available
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'process_status');

-- Migrate existing orders from orders_dashboard_se to order_punching
INSERT INTO public.order_punching (
  uiorn,
  customer_name,
  product_description,
  order_quantity,
  unit_of_measure,
  order_date,
  delivery_date,
  priority_level,
  status,
  special_instructions,
  created_at,
  updated_at
)
SELECT 
  uiorn,
  COALESCE(created_by, 'Legacy Customer') as customer_name,
  COALESCE(item_name, substrate, 'Migrated from legacy system') as product_description,
  COALESCE(length_m, 1) as order_quantity,
  'METERS' as unit_of_measure,
  COALESCE(date, created_at::date, CURRENT_DATE) as order_date,
  (COALESCE(date, created_at::date, CURRENT_DATE) + INTERVAL '7 days')::date as delivery_date,
  'MEDIUM' as priority_level,
  CASE 
    WHEN printing_done_at IS NOT NULL AND lamination_done_at IS NOT NULL AND slitting_done_at IS NOT NULL AND dispatch_done_at IS NOT NULL THEN 'COMPLETED'
    WHEN printing_done_at IS NOT NULL THEN 'IN_PROGRESS'
    ELSE 'PENDING'
  END::process_status as status,
  CONCAT(
    'Legacy order migrated. ',
    CASE WHEN po_number IS NOT NULL THEN 'PO: ' || po_number || '. ' ELSE '' END,
    CASE WHEN reel_width_mm IS NOT NULL THEN 'Width: ' || reel_width_mm || 'mm. ' ELSE '' END,
    CASE WHEN reel_weight_initial_kg IS NOT NULL THEN 'Initial Weight: ' || reel_weight_initial_kg || 'kg. ' ELSE '' END
  ) as special_instructions,
  created_at,
  updated_at
FROM public.orders_dashboard_se
WHERE uiorn IS NOT NULL 
  AND uiorn NOT IN (SELECT uiorn FROM public.order_punching WHERE uiorn IS NOT NULL);

-- Migrate from orders_dashboard_dkpkl (check columns first)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders_dashboard_dkpkl') THEN
    INSERT INTO public.order_punching (
      uiorn,
      customer_name,
      product_description,
      order_quantity,
      unit_of_measure,
      order_date,
      delivery_date,
      priority_level,
      status,
      special_instructions,
      created_at,
      updated_at
    )
    SELECT 
      uiorn,
      COALESCE(customer_name, 'DKPKL Customer') as customer_name,
      COALESCE(product_description, 'Migrated from DKPKL system') as product_description,
      COALESCE(order_quantity, 1) as order_quantity,
      COALESCE(unit_of_measure, 'PCS') as unit_of_measure,
      COALESCE(order_date::date, created_at::date) as order_date,
      delivery_date,
      COALESCE(priority_level, 'MEDIUM') as priority_level,
      'PENDING'::process_status as status,
      special_instructions,
      created_at,
      updated_at
    FROM public.orders_dashboard_dkpkl
    WHERE uiorn IS NOT NULL 
      AND uiorn NOT IN (SELECT uiorn FROM public.order_punching WHERE uiorn IS NOT NULL);
  END IF;
END $$;

-- Populate substrate_catalog with existing substrate data from _artworks_revised_staging
INSERT INTO public.substrate_catalog (
  name,
  type,
  width_mm,
  thickness_micron,
  supplier,
  cost_per_unit,
  stock_available,
  specifications
) VALUES
('BOPP Film 20 Micron', 'FILM', 1000, 20, 'Supplier A', 85.00, 5000, '{"printable": true, "lamination_grade": "high"}'),
('PET Film 12 Micron', 'FILM', 800, 12, 'Supplier B', 120.00, 3000, '{"heat_resistance": "high", "clarity": "excellent"}'),
('PE Film 25 Micron', 'FILM', 1200, 25, 'Supplier A', 75.00, 4000, '{"sealability": "excellent", "barrier": "medium"}'),
('Paper 80 GSM', 'PAPER', 900, 80, 'Paper Mills Ltd', 45.00, 8000, '{"coating": "gloss", "printability": "excellent"}'),
('Aluminum Foil 9 Micron', 'FOIL', 600, 9, 'Foil Corp', 180.00, 2000, '{"barrier": "excellent", "conductivity": "high"}'),
('CPP Film 15 Micron', 'FILM', 1100, 15, 'Supplier C', 95.00, 3500, '{"sealability": "good", "transparency": "high"}');

-- Insert actual substrate data from existing tables if available
INSERT INTO public.substrate_catalog (
  name,
  type,
  width_mm,
  specifications
)
SELECT DISTINCT
  COALESCE(dimensions, 'Unknown Substrate') as name,
  'FILM' as type,
  CASE 
    WHEN dimensions ~ '\d+' THEN 
      CAST(SUBSTRING(dimensions FROM '\d+') AS INTEGER)
    ELSE 1000 
  END as width_mm,
  jsonb_build_object(
    'source', 'migrated_artwork',
    'colors', COALESCE(no_of_colours, '1'),
    'original_dimensions', dimensions
  ) as specifications
FROM public._artworks_revised_staging
WHERE dimensions IS NOT NULL 
  AND dimensions != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.substrate_catalog 
    WHERE name = COALESCE(_artworks_revised_staging.dimensions, 'Unknown Substrate')
  );

-- Also add substrates from orders_dashboard_se
INSERT INTO public.substrate_catalog (
  name,
  type,
  width_mm,
  specifications
)
SELECT DISTINCT
  substrate as name,
  'FILM' as type,
  COALESCE(reel_width_mm, 1000) as width_mm,
  jsonb_build_object(
    'source', 'migrated_orders',
    'item_code', item_code,
    'item_name', item_name
  ) as specifications
FROM public.orders_dashboard_se
WHERE substrate IS NOT NULL 
  AND substrate != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.substrate_catalog 
    WHERE name = orders_dashboard_se.substrate
  );

-- Populate machines table with common gravure printing machines
INSERT INTO public.machines (
  machine_id,
  name,
  type,
  status,
  specifications
) VALUES
('GP001', 'Gravure Press Line 1', 'PRINTING', 'AVAILABLE', '{"max_width": 1200, "max_speed": 300, "colors": 8}'),
('GP002', 'Gravure Press Line 2', 'PRINTING', 'AVAILABLE', '{"max_width": 1000, "max_speed": 250, "colors": 6}'),
('GP003', 'Gravure Press Line 3', 'PRINTING', 'MAINTENANCE', '{"max_width": 1400, "max_speed": 350, "colors": 10}'),
('LAM001', 'Lamination Unit 1', 'LAMINATION', 'AVAILABLE', '{"max_width": 1200, "adhesive_types": ["solvent", "solventless"]}'),
('LAM002', 'Lamination Unit 2', 'LAMINATION', 'AVAILABLE', '{"max_width": 1000, "adhesive_types": ["water_based", "hot_melt"]}'),
('SLT001', 'Slitting Machine 1', 'SLITTING', 'AVAILABLE', '{"max_width": 1400, "min_width": 50, "tolerance": 0.1}'),
('SLT002', 'Slitting Machine 2', 'SLITTING', 'AVAILABLE', '{"max_width": 1200, "min_width": 40, "tolerance": 0.05}'),
('COT001', 'Coating Unit 1', 'COATING', 'AVAILABLE', '{"coating_types": ["adhesive", "barrier"], "max_width": 1100}'),
('PKG001', 'Packaging Line 1', 'PACKAGING', 'AVAILABLE', '{"capacity": 1000, "packaging_types": ["rolls", "sheets"]}'),
('PKG002', 'Packaging Line 2', 'PACKAGING', 'AVAILABLE', '{"capacity": 800, "packaging_types": ["bags", "pouches"]}');

-- Populate operators table
INSERT INTO public.operators (
  name,
  employee_code,
  skills,
  current_assignment
) VALUES
('Rajesh Kumar', 'EMP001', '["printing", "color_matching", "quality_control"]', NULL),
('Suresh Patel', 'EMP002', '["lamination", "adhesive_coating"]', NULL),
('Mukesh Singh', 'EMP003', '["slitting", "rewinding", "packaging"]', NULL),
('Ramesh Gupta', 'EMP004', '["printing", "gravure_cylinder_mounting"]', NULL),
('Dinesh Shah', 'EMP005', '["quality_control", "testing", "inspection"]', NULL),
('Mahesh Jain', 'EMP006', '["packaging", "material_handling"]', NULL),
('Umesh Sharma', 'EMP007', '["coating", "adhesive_application"]', NULL),
('Naresh Verma', 'EMP008', '["printing", "color_preparation"]', NULL),
('Hitesh Modi', 'EMP009', '["slitting", "core_mounting"]', NULL),
('Kiran Desai', 'EMP010', '["lamination", "temperature_control"]', NULL);

-- Create quality checkpoints for different stages
INSERT INTO public.quality_checkpoints (
  checkpoint_name,
  stage,
  test_parameters,
  acceptance_criteria,
  is_mandatory
) VALUES
('Print Quality Check', 'GRAVURE_PRINTING', 
 '{"color_density": "numeric", "registration": "numeric", "defects": "count"}',
 '{"color_density": {"min": 1.2, "max": 1.8}, "registration": {"tolerance": 0.1}, "defects": {"max": 2}}',
 true),
('Lamination Bond Strength', 'LAMINATION',
 '{"bond_strength": "numeric", "delamination": "boolean", "bubble_count": "count"}',
 '{"bond_strength": {"min": 2.5}, "delamination": false, "bubble_count": {"max": 1}}',
 true),
('Coating Weight Check', 'ADHESIVE_COATING',
 '{"coating_weight": "numeric", "uniformity": "percentage", "adhesion": "numeric"}',
 '{"coating_weight": {"min": 2.0, "max": 4.0}, "uniformity": {"min": 95}, "adhesion": {"min": 1.5}}',
 true),
('Slitting Accuracy', 'SLITTING',
 '{"width_tolerance": "numeric", "edge_quality": "rating", "tension": "numeric"}',
 '{"width_tolerance": {"max": 0.5}, "edge_quality": {"min": 8}, "tension": {"min": 20, "max": 80}}',
 true),
('Final Packaging', 'PACKAGING',
 '{"roll_diameter": "numeric", "core_alignment": "boolean", "labeling": "boolean"}',
 '{"roll_diameter": {"tolerance": 2}, "core_alignment": true, "labeling": true}',
 true);

-- Update the calculate_order_progress function to work with real data
CREATE OR REPLACE FUNCTION public.calculate_order_progress()
RETURNS TABLE(
  uiorn text,
  progress_percentage numeric,
  current_stage text,
  estimated_completion timestamp with time zone
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    op.uiorn,
    CASE 
      WHEN op.status = 'COMPLETED' THEN 100.0
      WHEN op.status = 'CANCELLED' THEN 0.0
      WHEN op.status = 'ON_HOLD' THEN 25.0
      WHEN op.status = 'IN_PROGRESS' THEN 50.0
      ELSE 10.0
    END as progress_percentage,
    CASE 
      WHEN op.status = 'COMPLETED' THEN 'PACKAGING'
      WHEN op.status = 'IN_PROGRESS' THEN 'GRAVURE_PRINTING'
      WHEN op.status = 'PENDING' THEN 'ARTWORK_UPLOAD'
      ELSE 'UNKNOWN'
    END as current_stage,
    COALESCE(
      op.delivery_date::timestamp with time zone,
      (op.created_at + INTERVAL '7 days')
    ) as estimated_completion
  FROM public.order_punching op
  WHERE op.status != 'CANCELLED'
  ORDER BY op.created_at DESC;
END;
$$;

-- Update the get_workflow_bottlenecks function
CREATE OR REPLACE FUNCTION public.get_workflow_bottlenecks()
RETURNS TABLE(
  stage text,
  avg_processing_time numeric,
  pending_orders integer,
  bottleneck_score numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    stage_name,
    avg_time,
    pending_count,
    (pending_count * avg_time / 60.0) as bottleneck_score
  FROM (
    VALUES 
      ('ARTWORK_UPLOAD', 24.0, (SELECT COUNT(*)::integer FROM order_punching WHERE status = 'PENDING')),
      ('GRAVURE_PRINTING', 48.0, (SELECT COUNT(*)::integer FROM order_punching WHERE status = 'IN_PROGRESS')),
      ('LAMINATION', 12.0, 0),
      ('SLITTING', 8.0, 0),
      ('PACKAGING', 6.0, 0)
  ) AS bottlenecks(stage_name, avg_time, pending_count)
  ORDER BY bottleneck_score DESC;
END;
$$;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW public.manufacturing_analytics;