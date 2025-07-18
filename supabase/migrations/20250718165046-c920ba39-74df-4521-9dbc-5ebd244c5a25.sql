
-- Insert realistic BOM data for Satguru processes
INSERT INTO public.bill_of_materials (fg_item_code, rm_item_code, quantity_required, unit_of_measure, consumption_rate, wastage_percentage, specifications) VALUES
-- Printing materials
('BOPP_FILM_25', 'BOPP_RAW_25', 1.0, 'KG', 1.0, 5.0, '{"process": "GRAVURE_PRINTING", "substrate": "BOPP", "thickness": "25 micron"}'),
('BOPP_FILM_25', 'INK_CYAN', 0.15, 'KG', 1.0, 8.0, '{"color": "Cyan", "type": "Solvent Based"}'),
('BOPP_FILM_25', 'INK_MAGENTA', 0.12, 'KG', 1.0, 8.0, '{"color": "Magenta", "type": "Solvent Based"}'),
('BOPP_FILM_25', 'INK_YELLOW', 0.10, 'KG', 1.0, 8.0, '{"color": "Yellow", "type": "Solvent Based"}'),
('BOPP_FILM_25', 'INK_BLACK', 0.08, 'KG', 1.0, 8.0, '{"color": "Black", "type": "Solvent Based"}'),
('BOPP_FILM_25', 'SOLVENT_ETHYL', 0.25, 'LITER', 1.0, 12.0, '{"type": "Ethyl Acetate", "grade": "Technical"}'),

-- Lamination materials
('LAM_BOPP_PET', 'BOPP_FILM_25', 1.0, 'KG', 1.0, 3.0, '{"base_substrate": "Printed BOPP"}'),
('LAM_BOPP_PET', 'PET_FILM_12', 1.0, 'KG', 1.0, 3.0, '{"lamination_substrate": "PET 12 micron"}'),
('LAM_BOPP_PET', 'ADHESIVE_PU', 2.5, 'KG', 1.0, 5.0, '{"type": "Polyurethane", "solids": "45%"}'),
('LAM_BOPP_PET', 'SOLVENT_TOLUENE', 1.8, 'LITER', 1.0, 10.0, '{"grade": "AR", "purity": "99.5%"}'),

-- Coating materials
('COATED_BOPP', 'BOPP_FILM_25', 1.0, 'KG', 1.0, 2.0, '{"base_substrate": "BOPP"}'),
('COATED_BOPP', 'ACRYLIC_COATING', 3.0, 'KG', 1.0, 6.0, '{"type": "Acrylic Emulsion", "solids": "38%"}'),
('COATED_BOPP', 'CROSSLINKER', 0.3, 'KG', 1.0, 5.0, '{"type": "Aziridine", "concentration": "100%"}');

-- Insert realistic material flow tracking data for recent orders
INSERT INTO public.material_flow_tracking (
  uiorn, process_stage, input_material_type, input_quantity, input_unit, 
  output_good_quantity, output_rework_quantity, output_waste_quantity, 
  waste_classification, yield_percentage, material_cost_per_unit, 
  total_input_cost, waste_cost_impact, quality_grade, operator_id, recorded_at, notes
) VALUES
-- Printing stage for recent orders
('250716006', 'GRAVURE_PRINTING', 'BOPP Raw Film 25 micron', 150.0, 'KG', 142.5, 4.5, 3.0, 'SETUP_WASTE', 95.0, 85.50, 12825.00, 256.50, 'GRADE_A', 
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') LIMIT 1), 
 '2024-07-16 08:30:00+00', 'Good run with minimal setup waste'),

('250716005', 'GRAVURE_PRINTING', 'BOPP Raw Film 25 micron', 200.0, 'KG', 188.0, 8.0, 4.0, 'EDGE_TRIM', 94.0, 85.50, 17100.00, 342.00, 'GRADE_A',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') LIMIT 1),
 '2024-07-16 10:45:00+00', 'Customer: FlexiPack, 4-color process printing'),

('250718002', 'GRAVURE_PRINTING', 'BOPP Raw Film 25 micron', 180.0, 'KG', 171.0, 6.0, 3.0, 'SETUP_WASTE', 95.0, 85.50, 15390.00, 256.50, 'GRADE_A',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') LIMIT 1),
 '2024-07-18 09:15:00+00', 'Excellent print quality achieved'),

-- Lamination stage
('250716006', 'LAMINATION', 'Printed BOPP Film', 142.5, 'KG', 135.0, 5.0, 2.5, 'EDGE_TRIM', 94.7, 125.00, 17812.50, 312.50, 'GRADE_A',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') LIMIT 1),
 '2024-07-16 14:20:00+00', 'Lamination with PET 12 micron completed'),

('250716005', 'LAMINATION', 'Printed BOPP Film', 188.0, 'KG', 178.0, 7.0, 3.0, 'DEFECTIVE', 94.7, 125.00, 23500.00, 375.00, 'GRADE_A',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') LIMIT 1),
 '2024-07-16 16:30:00+00', 'Good adhesion strength achieved'),

-- Coating stage
('250718002', 'ADHESIVE_COATING', 'BOPP Base Film', 171.0, 'KG', 163.0, 5.0, 3.0, 'CONTAMINATED', 95.3, 95.00, 16245.00, 285.00, 'GRADE_A',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') LIMIT 1),
 '2024-07-18 11:45:00+00', 'Acrylic coating applied successfully'),

-- Slitting stage
('250716006', 'SLITTING', 'Laminated Film Roll', 135.0, 'KG', 128.0, 4.0, 3.0, 'EDGE_TRIM', 94.8, 140.00, 18900.00, 420.00, 'GRADE_A',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') LIMIT 1),
 '2024-07-17 09:30:00+00', 'Slit to customer specifications: 250mm width'),

('250716005', 'SLITTING', 'Laminated Film Roll', 178.0, 'KG', 169.0, 6.0, 3.0, 'EDGE_TRIM', 94.9, 140.00, 24920.00, 420.00, 'GRADE_A',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') LIMIT 1),
 '2024-07-17 11:15:00+00', 'Multiple widths: 200mm, 300mm, 400mm');

-- Insert process transfer records
INSERT INTO public.process_transfers (
  uiorn, from_process, to_process, material_type, quantity_sent, quantity_received, 
  unit_of_measure, transfer_status, sent_by, received_by, sent_at, received_at, quality_notes
) VALUES
-- Printing to Lamination transfers
('250716006', 'GRAVURE_PRINTING', 'LAMINATION', 'Printed BOPP Film', 142.5, 142.5, 'KG', 'RECEIVED',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') LIMIT 1),
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') OFFSET 1 LIMIT 1),
 '2024-07-16 12:00:00+00', '2024-07-16 14:00:00+00', 'Print quality excellent, registration perfect'),

('250716005', 'GRAVURE_PRINTING', 'LAMINATION', 'Printed BOPP Film', 188.0, 188.0, 'KG', 'RECEIVED',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') LIMIT 1),
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') OFFSET 2 LIMIT 1),
 '2024-07-16 13:30:00+00', '2024-07-16 15:45:00+00', 'Good print density, colors within tolerance'),

-- Printing to Coating transfers
('250718002', 'GRAVURE_PRINTING', 'ADHESIVE_COATING', 'Printed BOPP Film', 171.0, 171.0, 'KG', 'RECEIVED',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') LIMIT 1),
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') OFFSET 3 LIMIT 1),
 '2024-07-18 10:30:00+00', '2024-07-18 11:15:00+00', 'Ready for acrylic coating application'),

-- Lamination to Slitting transfers
('250716006', 'LAMINATION', 'SLITTING', 'Laminated Film Roll', 135.0, 135.0, 'KG', 'RECEIVED',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') OFFSET 1 LIMIT 1),
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') OFFSET 4 LIMIT 1),
 '2024-07-16 18:00:00+00', '2024-07-17 08:30:00+00', 'Good lamination bond strength, ready for slitting'),

('250716005', 'LAMINATION', 'SLITTING', 'Laminated Film Roll', 178.0, 178.0, 'KG', 'RECEIVED',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') OFFSET 2 LIMIT 1),
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') OFFSET 4 LIMIT 1),
 '2024-07-16 19:30:00+00', '2024-07-17 10:00:00+00', 'Excellent lamination quality, no delamination'),

-- Coating to Slitting transfers
('250718002', 'ADHESIVE_COATING', 'SLITTING', 'Coated Film Roll', 163.0, 163.0, 'KG', 'RECEIVED',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') OFFSET 3 LIMIT 1),
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') OFFSET 4 LIMIT 1),
 '2024-07-18 15:00:00+00', '2024-07-18 16:30:00+00', 'Coating uniformity excellent, ready for final processing');

-- Insert UIORN material consumption tracking
INSERT INTO public.uiorn_material_consumption (
  uiorn, rm_item_code, process_stage, planned_quantity, actual_quantity, 
  wastage_quantity, unit_cost, total_cost, consumed_at, recorded_by, notes
) VALUES
-- Raw material consumption for printing
('250716006', 'BOPP_RAW_25', 'GRAVURE_PRINTING', 150.0, 150.0, 7.5, 85.50, 12825.00,
 '2024-07-16 08:30:00+00', 
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') LIMIT 1),
 'Primary substrate for 4-color printing'),

('250716006', 'INK_CYAN', 'GRAVURE_PRINTING', 22.5, 23.2, 1.8, 450.00, 10440.00,
 '2024-07-16 08:45:00+00',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') LIMIT 1),
 'Slightly higher consumption due to color density requirement'),

('250716005', 'BOPP_RAW_25', 'GRAVURE_PRINTING', 200.0, 200.0, 12.0, 85.50, 17100.00,
 '2024-07-16 10:45:00+00',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') LIMIT 1),
 'FlexiPack order - premium grade material'),

-- Lamination consumables
('250716006', 'ADHESIVE_PU', 'LAMINATION', 356.25, 365.0, 18.25, 180.00, 65700.00,
 '2024-07-16 14:20:00+00',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') OFFSET 1 LIMIT 1),
 'Polyurethane adhesive for BOPP-PET lamination'),

('250716006', 'PET_FILM_12', 'LAMINATION', 142.5, 142.5, 7.5, 95.00, 13537.50,
 '2024-07-16 14:30:00+00',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') OFFSET 1 LIMIT 1),
 'PET 12 micron for barrier properties'),

-- Coating consumables
('250718002', 'ACRYLIC_COATING', 'ADHESIVE_COATING', 513.0, 525.0, 31.5, 75.00, 39375.00,
 '2024-07-18 11:45:00+00',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') OFFSET 3 LIMIT 1),
 'Acrylic emulsion for barrier coating'),

('250718002', 'CROSSLINKER', 'ADHESIVE_COATING', 51.3, 52.5, 2.6, 350.00, 18375.00,
 '2024-07-18 12:00:00+00',
 (SELECT id FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE code = 'SATGURU') OFFSET 3 LIMIT 1),
 'Crosslinker for coating durability');
