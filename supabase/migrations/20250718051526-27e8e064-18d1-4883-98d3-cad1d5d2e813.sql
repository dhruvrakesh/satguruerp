-- Final working migration with correct types

-- Migrate orders from legacy system
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

-- Add substrates one by one
INSERT INTO public.substrate_catalog (substrate_name, substrate_type, width_mm, supplier)
SELECT 'BOPP Film 20 Micron', 'FILM', 1000, 'Supplier A'
WHERE NOT EXISTS (SELECT 1 FROM public.substrate_catalog WHERE substrate_name = 'BOPP Film 20 Micron');

INSERT INTO public.substrate_catalog (substrate_name, substrate_type, width_mm, supplier)
SELECT 'PET Film 12 Micron', 'FILM', 800, 'Supplier B'
WHERE NOT EXISTS (SELECT 1 FROM public.substrate_catalog WHERE substrate_name = 'PET Film 12 Micron');

INSERT INTO public.substrate_catalog (substrate_name, substrate_type, width_mm, supplier)
SELECT 'PE Film 25 Micron', 'FILM', 1200, 'Supplier A'
WHERE NOT EXISTS (SELECT 1 FROM public.substrate_catalog WHERE substrate_name = 'PE Film 25 Micron');

-- Add machines one by one
INSERT INTO public.machines (machine_id, machine_name, machine_type, status, capacity_per_hour)
SELECT 'GP001', 'Gravure Press Line 1', 'PRINTING', 'AVAILABLE', 300
WHERE NOT EXISTS (SELECT 1 FROM public.machines WHERE machine_id = 'GP001');

INSERT INTO public.machines (machine_id, machine_name, machine_type, status, capacity_per_hour)
SELECT 'LAM001', 'Lamination Unit 1', 'LAMINATION', 'AVAILABLE', 400
WHERE NOT EXISTS (SELECT 1 FROM public.machines WHERE machine_id = 'LAM001');

-- Add operators one by one with proper array syntax
INSERT INTO public.operators (operator_code, operator_name, skills, shift)
SELECT 'EMP001', 'Rajesh Kumar', ARRAY['printing', 'quality_control'], 'DAY'
WHERE NOT EXISTS (SELECT 1 FROM public.operators WHERE operator_code = 'EMP001');

INSERT INTO public.operators (operator_code, operator_name, skills, shift)
SELECT 'EMP002', 'Suresh Patel', ARRAY['lamination', 'coating'], 'DAY'
WHERE NOT EXISTS (SELECT 1 FROM public.operators WHERE operator_code = 'EMP002');

-- Data migration completed successfully!