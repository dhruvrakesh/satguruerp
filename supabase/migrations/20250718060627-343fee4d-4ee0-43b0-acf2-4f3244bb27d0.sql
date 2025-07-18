-- Create sample substrate catalog for enhanced order creation
-- Insert sample substrate data
INSERT INTO substrate_catalog (substrate_name, substrate_type, width_mm, supplier, cost_per_sqm, is_active) VALUES
('BOPP Clear 20mic', 'BOPP', 1000, 'Jindal Films', 95.50, true),
('BOPP White 25mic', 'BOPP', 1200, 'Jindal Films', 105.75, true),
('PET Clear 12mic', 'PET', 1000, 'Polyplex Corp', 125.00, true),
('PET Metallized 12mic', 'PET', 800, 'Uflex Ltd', 145.25, true),
('PE Clear 50mic', 'PE', 1500, 'Supreme Industries', 85.00, true),
('CPP Clear 20mic', 'CPP', 1000, 'Cosmo Films', 110.50, true),
('Aluminum Foil 9mic', 'FOIL', 600, 'Hindalco', 180.75, true),
('Paper Base 80gsm', 'PAPER', 1200, 'ITC Paperboards', 65.00, true)
ON CONFLICT (substrate_name) DO UPDATE SET
  substrate_type = EXCLUDED.substrate_type,
  width_mm = EXCLUDED.width_mm,
  supplier = EXCLUDED.supplier,
  cost_per_sqm = EXCLUDED.cost_per_sqm,
  is_active = EXCLUDED.is_active;