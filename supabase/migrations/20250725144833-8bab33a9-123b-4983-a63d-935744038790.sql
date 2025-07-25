-- Fix profile creation function to prevent duplicates
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Check if profile already exists to prevent duplicates
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    INSERT INTO public.profiles (id, email, full_name, organization_id, role, is_approved)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
      CASE 
        WHEN NEW.email LIKE '%@satguruengravures.com' THEN 
          (SELECT id FROM public.organizations WHERE code = 'SATGURU')
        ELSE 
          (SELECT id FROM public.organizations WHERE code = 'DKEGL')
      END,
      CASE 
        WHEN NEW.email = 'info@satguruengravures.com' THEN 'admin'
        ELSE 'user'
      END,
      CASE 
        WHEN NEW.email = 'info@satguruengravures.com' OR NEW.email LIKE '%@satguruengravures.com' THEN true
        ELSE false
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Update artwork master data with realistic color standards for testing
UPDATE public.master_data_artworks_se 
SET 
  target_l = CASE item_code
    WHEN 'ITM-IKRISH-001' THEN 72.5  -- Cool Mint - Light green
    WHEN 'ITM-SRS-002' THEN 85.2    -- Lime & Aloe - Bright
    WHEN 'ITM-GLOB-002' THEN 65.8   -- Rose - Medium pink
    WHEN 'ITM-SRS-004' THEN 88.1    -- Milk & Almond - Very light
    WHEN 'ITM-DAB-002' THEN 70.3    -- White Rose Glow - Light
    ELSE 75.0
  END,
  target_a = CASE item_code
    WHEN 'ITM-IKRISH-001' THEN -15.2 -- Cool Mint - Green
    WHEN 'ITM-SRS-002' THEN -18.7   -- Lime & Aloe - Green
    WHEN 'ITM-GLOB-002' THEN 25.4   -- Rose - Red
    WHEN 'ITM-SRS-004' THEN 3.2     -- Milk & Almond - Neutral
    WHEN 'ITM-DAB-002' THEN 8.6     -- White Rose Glow - Slight red
    ELSE 0.0
  END,
  target_b = CASE item_code
    WHEN 'ITM-IKRISH-001' THEN 8.9   -- Cool Mint - Slight yellow
    WHEN 'ITM-SRS-002' THEN 22.1    -- Lime & Aloe - Yellow-green
    WHEN 'ITM-GLOB-002' THEN 15.7   -- Rose - Pink
    WHEN 'ITM-SRS-004' THEN 12.4    -- Milk & Almond - Cream
    WHEN 'ITM-DAB-002' THEN 6.8     -- White Rose Glow - Slight yellow
    ELSE 0.0
  END,
  delta_e_tolerance = 2.0
WHERE item_code IN ('ITM-IKRISH-001', 'ITM-SRS-002', 'ITM-GLOB-002', 'ITM-SRS-004', 'ITM-DAB-002');

-- Create test orders with valid substrate values
INSERT INTO public.orders_dashboard_se (
  uiorn, item_code, item_name, substrate, date, created_at, last_activity
) VALUES
('260125_0001', 'ITM-IKRISH-001', 'WRAPPER COOL MINT 100G', 'BOPP_15', CURRENT_DATE, now(), 'Order created for testing'),
('260125_0002', 'ITM-SRS-002', 'Jimny-Lime&Aloevera', 'BOPP_18', CURRENT_DATE, now(), 'Order created for testing'),
('260125_0003', 'ITM-GLOB-002', 'Soap-Rose', 'PET_12', CURRENT_DATE, now(), 'Order created for testing')
ON CONFLICT (uiorn) DO NOTHING;

-- Create mock QC sessions for testing
INSERT INTO public.qc_sessions (
  id, uiorn, item_code, operator_id, target_l, target_a, target_b, 
  delta_e_tolerance, status, start_time
) VALUES
(
  gen_random_uuid(), '260125_0001', 'ITM-IKRISH-001',
  'b1749bda-09e9-443a-9eb1-f4004b9f6b77', 
  72.5, -15.2, 8.9, 2.0, 'active', 
  now() - interval '2 hours'
),
(
  gen_random_uuid(), '260125_0002', 'ITM-SRS-002',
  '9f3ab56b-4b34-48b9-8d2b-ad94366a4b11',
  85.2, -18.7, 22.1, 2.0, 'active',
  now() - interval '1 hour'
),
(
  gen_random_uuid(), '260125_0003', 'ITM-GLOB-002',
  'fe88b4f0-6c35-4985-ab42-b04cc2342c91',
  65.8, 25.4, 15.7, 2.0, 'completed',
  now() - interval '3 hours'
);

-- Generate realistic color measurements for testing (48 total measurements)
WITH session_data AS (
  SELECT id as session_id, target_l, target_a, target_b, delta_e_tolerance, uiorn
  FROM qc_sessions 
  WHERE uiorn IN ('260125_0001', '260125_0002', '260125_0003')
),
measurement_series AS (
  SELECT 
    s.session_id,
    s.target_l + (random() * 4 - 2) as measured_l,
    s.target_a + (random() * 3 - 1.5) as measured_a,
    s.target_b + (random() * 3 - 1.5) as measured_b,
    s.uiorn,
    generate_series(1, 
      CASE 
        WHEN s.uiorn = '260125_0001' THEN 15
        WHEN s.uiorn = '260125_0002' THEN 8
        WHEN s.uiorn = '260125_0003' THEN 25
      END
    ) as measurement_num
  FROM session_data s
)
INSERT INTO public.color_measurements_log (
  session_id, measured_l, measured_a, measured_b, delta_e, is_pass, 
  measurement_notes, captured_at
)
SELECT 
  m.session_id,
  ROUND(m.measured_l::numeric, 2),
  ROUND(m.measured_a::numeric, 2), 
  ROUND(m.measured_b::numeric, 2),
  ROUND((sqrt(
    power(m.measured_l - s.target_l, 2) +
    power(m.measured_a - s.target_a, 2) +
    power(m.measured_b - s.target_b, 2)
  ))::numeric, 2) as delta_e,
  (sqrt(
    power(m.measured_l - s.target_l, 2) +
    power(m.measured_a - s.target_a, 2) +
    power(m.measured_b - s.target_b, 2)
  ) <= s.delta_e_tolerance) as is_pass,
  CASE 
    WHEN m.measurement_num % 5 = 0 THEN 'Periodic calibration check'
    WHEN m.measurement_num = 1 THEN 'Initial measurement'
    ELSE 'Standard measurement'
  END as measurement_notes,
  now() - interval '3 hours' + (interval '5 minutes' * m.measurement_num)
FROM measurement_series m
JOIN session_data s ON m.session_id = s.session_id;