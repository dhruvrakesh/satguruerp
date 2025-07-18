-- Create sample substrate catalog for enhanced order creation
-- Insert sample substrate data (clear any existing data first)
DELETE FROM substrate_catalog WHERE substrate_name IN (
  'BOPP Clear 20mic', 'BOPP White 25mic', 'PET Clear 12mic', 'PET Metallized 12mic',
  'PE Clear 50mic', 'CPP Clear 20mic', 'Aluminum Foil 9mic', 'Paper Base 80gsm'
);

INSERT INTO substrate_catalog (substrate_name, substrate_type, thickness_micron, width_mm, supplier, cost_per_unit, is_active) VALUES
('BOPP Clear 20mic', 'BOPP', 20, 1000, 'Jindal Films', 95.50, true),
('BOPP White 25mic', 'BOPP', 25, 1200, 'Jindal Films', 105.75, true),
('PET Clear 12mic', 'PET', 12, 1000, 'Polyplex Corp', 125.00, true),
('PET Metallized 12mic', 'PET', 12, 800, 'Uflex Ltd', 145.25, true),
('PE Clear 50mic', 'PE', 50, 1500, 'Supreme Industries', 85.00, true),
('CPP Clear 20mic', 'CPP', 20, 1000, 'Cosmo Films', 110.50, true),
('Aluminum Foil 9mic', 'FOIL', 9, 600, 'Hindalco', 180.75, true),
('Paper Base 80gsm', 'PAPER', 80, 1200, 'ITC Paperboards', 65.00, true);