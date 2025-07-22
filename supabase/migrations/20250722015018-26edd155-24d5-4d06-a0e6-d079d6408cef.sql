
-- Phase 1: Database Foundation for Stock Valuation System

-- Create cost categories table
CREATE TABLE IF NOT EXISTS public.cost_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code TEXT UNIQUE NOT NULL,
  category_name TEXT NOT NULL,
  description TEXT,
  allocation_method TEXT DEFAULT 'DIRECT', -- DIRECT, ALLOCATED, OVERHEAD
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create item pricing master table
CREATE TABLE IF NOT EXISTS public.item_pricing_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL,
  cost_category_id UUID REFERENCES public.cost_categories(id),
  current_price NUMERIC(15,4) NOT NULL DEFAULT 0,
  previous_price NUMERIC(15,4),
  standard_cost NUMERIC(15,4),
  last_cost NUMERIC(15,4),
  average_cost NUMERIC(15,4),
  supplier_code TEXT,
  currency TEXT DEFAULT 'INR',
  unit_of_measure TEXT DEFAULT 'KG',
  effective_date DATE DEFAULT CURRENT_DATE,
  price_source TEXT DEFAULT 'MANUAL', -- MANUAL, GRN, PURCHASE_ORDER, MARKET
  approval_status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  approval_level INTEGER DEFAULT 1,
  price_change_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(item_code, effective_date)
);

-- Create item price history table
CREATE TABLE IF NOT EXISTS public.item_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL,
  old_price NUMERIC(15,4),
  new_price NUMERIC(15,4) NOT NULL,
  price_change_percentage NUMERIC(8,2),
  change_reason TEXT,
  change_type TEXT DEFAULT 'UPDATE', -- UPDATE, BULK_UPDATE, AUTOMATIC
  effective_date DATE DEFAULT CURRENT_DATE,
  changed_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create valuation method configurations
CREATE TABLE IF NOT EXISTS public.valuation_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method_code TEXT UNIQUE NOT NULL, -- FIFO, LIFO, WEIGHTED_AVG, STANDARD
  method_name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  configuration JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default cost categories
INSERT INTO public.cost_categories (category_code, category_name, description, allocation_method) VALUES
  ('RAW_MAT', 'Raw Materials', 'Direct raw materials used in production', 'DIRECT'),
  ('SUBSTRATES', 'Substrates', 'Base materials and substrates', 'DIRECT'),
  ('CHEMICALS', 'Chemicals', 'Inks, adhesives, and chemical compounds', 'DIRECT'),
  ('PACKAGING', 'Packaging Materials', 'Packaging and finishing materials', 'DIRECT'),
  ('CONSUMABLES', 'Consumables', 'General consumable items', 'ALLOCATED'),
  ('UTILITIES', 'Utilities', 'Power, water, and utility costs', 'OVERHEAD'),
  ('MAINTENANCE', 'Maintenance', 'Maintenance and repair materials', 'ALLOCATED')
ON CONFLICT (category_code) DO NOTHING;

-- Insert default valuation methods
INSERT INTO public.valuation_methods (method_code, method_name, description, is_default) VALUES
  ('WEIGHTED_AVG', 'Weighted Average', 'Weighted average cost method', true),
  ('FIFO', 'First In First Out', 'First in, first out costing method', false),
  ('LIFO', 'Last In First Out', 'Last in, first out costing method', false),
  ('STANDARD', 'Standard Cost', 'Standard costing method', false)
ON CONFLICT (method_code) DO NOTHING;

-- Create enhanced stock valuation view
CREATE OR REPLACE VIEW public.stock_valuation_enhanced AS
WITH latest_pricing AS (
  SELECT DISTINCT ON (item_code) 
    item_code,
    current_price,
    cost_category_id,
    supplier_code,
    effective_date,
    approval_status,
    price_source
  FROM public.item_pricing_master 
  WHERE is_active = true 
    AND approval_status = 'APPROVED'
  ORDER BY item_code, effective_date DESC, created_at DESC
),
grn_pricing AS (
  SELECT 
    item_code,
    AVG(amount_inr / NULLIF(qty_received, 0)) as avg_grn_price,
    MAX(date) as last_grn_date,
    COUNT(*) as grn_count
  FROM public.satguru_grn_log 
  WHERE qty_received > 0 AND amount_inr > 0
  GROUP BY item_code
),
stock_age AS (
  SELECT 
    item_code,
    CASE 
      WHEN MAX(grn.date) IS NOT NULL THEN 
        EXTRACT(DAYS FROM (CURRENT_DATE - MAX(grn.date)))
      ELSE 365
    END as stock_age_days
  FROM public.satguru_stock_summary_view s
  LEFT JOIN public.satguru_grn_log grn ON s.item_code = grn.item_code
  GROUP BY s.item_code
)
SELECT 
  s.item_code,
  s.item_name,
  s.category_name,
  s.current_qty,
  s.reorder_level,
  s.stock_status,
  
  -- Pricing information
  COALESCE(lp.current_price, gp.avg_grn_price, 0) as unit_price,
  lp.current_price as master_price,
  gp.avg_grn_price as grn_average_price,
  lp.price_source,
  lp.approval_status as price_approval_status,
  
  -- Valuation calculations
  ROUND((s.current_qty * COALESCE(lp.current_price, gp.avg_grn_price, 0))::numeric, 2) as total_value,
  
  -- Cost category
  cc.category_name as cost_category_name,
  cc.category_code as cost_category_code,
  cc.allocation_method,
  
  -- Additional metadata
  lp.supplier_code,
  lp.effective_date as price_effective_date,
  gp.last_grn_date,
  gp.grn_count,
  sa.stock_age_days,
  
  -- Calculated fields for analysis
  CASE 
    WHEN s.current_qty * COALESCE(lp.current_price, gp.avg_grn_price, 0) > 100000 THEN 'HIGH'
    WHEN s.current_qty * COALESCE(lp.current_price, gp.avg_grn_price, 0) > 10000 THEN 'MEDIUM'
    ELSE 'LOW'
  END as value_classification,
  
  CASE 
    WHEN sa.stock_age_days > 180 THEN 'SLOW_MOVING'
    WHEN sa.stock_age_days > 90 THEN 'MEDIUM_MOVING'
    ELSE 'FAST_MOVING'
  END as movement_classification

FROM public.satguru_stock_summary_view s
LEFT JOIN latest_pricing lp ON s.item_code = lp.item_code
LEFT JOIN grn_pricing gp ON s.item_code = gp.item_code
LEFT JOIN public.cost_categories cc ON lp.cost_category_id = cc.id
LEFT JOIN stock_age sa ON s.item_code = sa.item_code
WHERE s.current_qty > 0 OR COALESCE(lp.current_price, gp.avg_grn_price, 0) > 0;

-- Enable RLS on new tables
ALTER TABLE public.cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_pricing_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_methods ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for cost categories
CREATE POLICY "Approved users can manage cost categories" ON public.cost_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid() 
      AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

-- Create RLS policies for item pricing master
CREATE POLICY "Approved users can manage item pricing" ON public.item_pricing_master
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid() 
      AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

-- Create RLS policies for price history
CREATE POLICY "Approved users can view price history" ON public.item_price_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid() 
      AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

-- Create RLS policies for valuation methods
CREATE POLICY "Approved users can manage valuation methods" ON public.valuation_methods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid() 
      AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cost_categories_updated_at BEFORE UPDATE ON public.cost_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_item_pricing_master_updated_at BEFORE UPDATE ON public.item_pricing_master
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_pricing_master_item_code ON public.item_pricing_master(item_code);
CREATE INDEX IF NOT EXISTS idx_item_pricing_master_active ON public.item_pricing_master(is_active, approval_status);
CREATE INDEX IF NOT EXISTS idx_item_pricing_master_effective_date ON public.item_pricing_master(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_item_price_history_item_code ON public.item_price_history(item_code);
CREATE INDEX IF NOT EXISTS idx_item_price_history_date ON public.item_price_history(created_at DESC);
