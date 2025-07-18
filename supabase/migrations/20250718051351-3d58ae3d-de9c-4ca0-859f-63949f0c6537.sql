-- Final Data Migration with all correct column names

-- Migrate orders from orders_dashboard_se to order_punching
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
  ('CPP Film 15 Micron', 'FILM', 1100, 'Supplier C')
) AS v(substrate_name, substrate_type, width_mm, supplier)
WHERE NOT EXISTS (
  SELECT 1 FROM public.substrate_catalog sc 
  WHERE sc.substrate_name = v.substrate_name
);

-- Add machines with correct column names
INSERT INTO public.machines (machine_id, machine_name, machine_type, status, capacity_per_hour)
SELECT * FROM (VALUES 
  ('GP001', 'Gravure Press Line 1', 'PRINTING', 'AVAILABLE', 300),
  ('GP002', 'Gravure Press Line 2', 'PRINTING', 'AVAILABLE', 250),
  ('LAM001', 'Lamination Unit 1', 'LAMINATION', 'AVAILABLE', 400),
  ('SLT001', 'Slitting Machine 1', 'SLITTING', 'AVAILABLE', 200),
  ('PKG001', 'Packaging Line 1', 'PACKAGING', 'AVAILABLE', 150)
) AS v(machine_id, machine_name, machine_type, status, capacity_per_hour)
WHERE NOT EXISTS (
  SELECT 1 FROM public.machines m 
  WHERE m.machine_id = v.machine_id
);

-- Add operators
INSERT INTO public.operators (name, employee_code, skills)
SELECT * FROM (VALUES 
  ('Rajesh Kumar', 'EMP001', '["printing", "quality_control"]'),
  ('Suresh Patel', 'EMP002', '["lamination", "coating"]'),
  ('Mukesh Singh', 'EMP003', '["slitting", "packaging"]'),
  ('Ramesh Gupta', 'EMP004', '["printing", "setup"]'),
  ('Dinesh Shah', 'EMP005', '["quality_control", "testing"]')
) AS v(name, employee_code, skills)
WHERE NOT EXISTS (
  SELECT 1 FROM public.operators o 
  WHERE o.employee_code = v.employee_code
);