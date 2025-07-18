-- Simple Data Migration without conflicts

-- First, let's just migrate orders
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
  'NORMAL' as priority_level,
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
  AND NOT EXISTS (
    SELECT 1 FROM public.order_punching op 
    WHERE op.uiorn = orders_dashboard_se.uiorn
  );

-- Add some basic substrates
INSERT INTO public.substrate_catalog (substrate_name, substrate_type, width_mm, supplier)
SELECT DISTINCT 
  'BOPP Film', 'FILM', 1000, 'Standard Supplier'
WHERE NOT EXISTS (SELECT 1 FROM public.substrate_catalog WHERE substrate_name = 'BOPP Film');

INSERT INTO public.substrate_catalog (substrate_name, substrate_type, width_mm, supplier)
SELECT DISTINCT 
  'PET Film', 'FILM', 800, 'Standard Supplier'
WHERE NOT EXISTS (SELECT 1 FROM public.substrate_catalog WHERE substrate_name = 'PET Film');

-- Add some machines
INSERT INTO public.machines (machine_id, name, type, status)
SELECT 'GP001', 'Gravure Press Line 1', 'PRINTING', 'AVAILABLE'
WHERE NOT EXISTS (SELECT 1 FROM public.machines WHERE machine_id = 'GP001');

INSERT INTO public.machines (machine_id, name, type, status)
SELECT 'LAM001', 'Lamination Unit 1', 'LAMINATION', 'AVAILABLE'
WHERE NOT EXISTS (SELECT 1 FROM public.machines WHERE machine_id = 'LAM001');

-- Add some operators
INSERT INTO public.operators (name, employee_code, skills)
SELECT 'Rajesh Kumar', 'EMP001', '["printing", "quality_control"]'
WHERE NOT EXISTS (SELECT 1 FROM public.operators WHERE employee_code = 'EMP001');

INSERT INTO public.operators (name, employee_code, skills)
SELECT 'Suresh Patel', 'EMP002', '["lamination", "coating"]'
WHERE NOT EXISTS (SELECT 1 FROM public.operators WHERE employee_code = 'EMP002');