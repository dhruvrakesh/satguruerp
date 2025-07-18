-- Successful Data Migration with all correct column names

-- Migrate orders (46 records)
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

-- Add basic substrates
INSERT INTO public.substrate_catalog (substrate_name, substrate_type, width_mm, supplier)
SELECT * FROM (VALUES 
  ('BOPP Film 20 Micron', 'FILM', 1000, 'Supplier A'),
  ('PET Film 12 Micron', 'FILM', 800, 'Supplier B'),
  ('PE Film 25 Micron', 'FILM', 1200, 'Supplier A'),
  ('CPP Film 15 Micron', 'FILM', 1100, 'Supplier C'),
  ('Paper 80 GSM', 'PAPER', 900, 'Paper Mills Ltd'),
  ('Aluminum Foil 9 Micron', 'FOIL', 600, 'Foil Corp')
) AS v(substrate_name, substrate_type, width_mm, supplier)
WHERE NOT EXISTS (
  SELECT 1 FROM public.substrate_catalog sc 
  WHERE sc.substrate_name = v.substrate_name
);

-- Add machines
INSERT INTO public.machines (machine_id, machine_name, machine_type, status, capacity_per_hour)
SELECT * FROM (VALUES 
  ('GP001', 'Gravure Press Line 1', 'PRINTING', 'AVAILABLE', 300),
  ('GP002', 'Gravure Press Line 2', 'PRINTING', 'AVAILABLE', 250),
  ('GP003', 'Gravure Press Line 3', 'PRINTING', 'MAINTENANCE', 350),
  ('LAM001', 'Lamination Unit 1', 'LAMINATION', 'AVAILABLE', 400),
  ('LAM002', 'Lamination Unit 2', 'LAMINATION', 'AVAILABLE', 350),
  ('SLT001', 'Slitting Machine 1', 'SLITTING', 'AVAILABLE', 200),
  ('SLT002', 'Slitting Machine 2', 'SLITTING', 'AVAILABLE', 180),
  ('PKG001', 'Packaging Line 1', 'PACKAGING', 'AVAILABLE', 150),
  ('PKG002', 'Packaging Line 2', 'PACKAGING', 'AVAILABLE', 120)
) AS v(machine_id, machine_name, machine_type, status, capacity_per_hour)
WHERE NOT EXISTS (
  SELECT 1 FROM public.machines m 
  WHERE m.machine_id = v.machine_id
);

-- Add operators with correct column names
INSERT INTO public.operators (operator_code, operator_name, skills, shift)
SELECT * FROM (VALUES 
  ('EMP001', 'Rajesh Kumar', '["printing", "quality_control", "color_matching"]', 'DAY'),
  ('EMP002', 'Suresh Patel', '["lamination", "coating", "adhesive_application"]', 'DAY'),
  ('EMP003', 'Mukesh Singh', '["slitting", "packaging", "rewinding"]', 'DAY'),
  ('EMP004', 'Ramesh Gupta', '["printing", "setup", "gravure_cylinder_mounting"]', 'NIGHT'),
  ('EMP005', 'Dinesh Shah', '["quality_control", "testing", "inspection"]', 'DAY'),
  ('EMP006', 'Mahesh Jain', '["packaging", "material_handling"]', 'NIGHT'),
  ('EMP007', 'Umesh Sharma', '["coating", "adhesive_application"]', 'DAY'),
  ('EMP008', 'Naresh Verma', '["printing", "color_preparation"]', 'DAY'),
  ('EMP009', 'Hitesh Modi', '["slitting", "core_mounting"]', 'NIGHT'),
  ('EMP010', 'Kiran Desai', '["lamination", "temperature_control"]', 'DAY')
) AS v(operator_code, operator_name, skills, shift)
WHERE NOT EXISTS (
  SELECT 1 FROM public.operators o 
  WHERE o.operator_code = v.operator_code
);