
-- Enhance bill_of_materials table with additional BOM management fields
ALTER TABLE public.bill_of_materials 
ADD COLUMN IF NOT EXISTS gsm_contribution NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS percentage_contribution NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_code TEXT,
ADD COLUMN IF NOT EXISTS bom_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS expiry_date DATE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bill_of_materials_fg_customer ON public.bill_of_materials(fg_item_code, customer_code);
CREATE INDEX IF NOT EXISTS idx_bill_of_materials_effective_date ON public.bill_of_materials(effective_date);
CREATE INDEX IF NOT EXISTS idx_bill_of_materials_version ON public.bill_of_materials(fg_item_code, bom_version);

-- Create BOM validation function
CREATE OR REPLACE FUNCTION validate_bom_percentages()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if percentage contributions for an FG item add up to reasonable range (95-105%)
  IF (SELECT SUM(percentage_contribution) 
      FROM public.bill_of_materials 
      WHERE fg_item_code = NEW.fg_item_code 
        AND customer_code = COALESCE(NEW.customer_code, customer_code)
        AND is_active = true) > 110 THEN
    RAISE WARNING 'Total percentage contribution exceeds 110% for FG item: %', NEW.fg_item_code;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for BOM validation
DROP TRIGGER IF EXISTS trigger_validate_bom_percentages ON public.bill_of_materials;
CREATE TRIGGER trigger_validate_bom_percentages
  AFTER INSERT OR UPDATE ON public.bill_of_materials
  FOR EACH ROW EXECUTE FUNCTION validate_bom_percentages();

-- Create BOM explosion calculation function
CREATE OR REPLACE FUNCTION calculate_bom_requirements(
  p_fg_item_code TEXT,
  p_fg_quantity NUMERIC,
  p_customer_code TEXT DEFAULT NULL,
  p_target_gsm NUMERIC DEFAULT NULL
) RETURNS TABLE (
  rm_item_code TEXT,
  required_quantity NUMERIC,
  unit_of_measure TEXT,
  gsm_contribution NUMERIC,
  percentage_contribution NUMERIC,
  total_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bom.rm_item_code,
    (bom.quantity_required * p_fg_quantity * bom.consumption_rate) as required_quantity,
    bom.unit_of_measure,
    bom.gsm_contribution,
    bom.percentage_contribution,
    (bom.quantity_required * p_fg_quantity * bom.consumption_rate * COALESCE(im.current_cost, 0)) as total_cost
  FROM public.bill_of_materials bom
  LEFT JOIN public.item_master im ON bom.rm_item_code = im.item_code
  WHERE bom.fg_item_code = p_fg_item_code
    AND bom.is_active = true
    AND (p_customer_code IS NULL OR bom.customer_code = p_customer_code OR bom.customer_code IS NULL)
    AND bom.effective_date <= CURRENT_DATE
    AND (bom.expiry_date IS NULL OR bom.expiry_date > CURRENT_DATE)
  ORDER BY bom.percentage_contribution DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create BOM templates table for reusable BOM structures
CREATE TABLE IF NOT EXISTS public.bom_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_code TEXT UNIQUE NOT NULL,
  description TEXT,
  target_gsm NUMERIC,
  customer_code TEXT,
  template_data JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS on new table
ALTER TABLE public.bom_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for BOM templates
CREATE POLICY "Approved users can manage BOM templates" ON public.bom_templates
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() AND p.is_approved = true 
    AND o.code IN ('DKEGL', 'SATGURU')
  )
);

-- Add indexes for BOM templates
CREATE INDEX IF NOT EXISTS idx_bom_templates_customer ON public.bom_templates(customer_code);
CREATE INDEX IF NOT EXISTS idx_bom_templates_active ON public.bom_templates(is_active);
