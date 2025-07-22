
-- Phase 1: Create Item Pricing Database Infrastructure
-- Enhanced item pricing master table with approval workflow and audit trail

CREATE TABLE IF NOT EXISTS public.item_pricing_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL,
  item_name TEXT,
  category TEXT,
  uom TEXT DEFAULT 'KG',
  current_price NUMERIC(15,4) NOT NULL DEFAULT 0,
  previous_price NUMERIC(15,4),
  cost_category TEXT DEFAULT 'Raw Materials',
  supplier TEXT,
  effective_date DATE DEFAULT CURRENT_DATE,
  approval_status TEXT DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  price_change_reason TEXT,
  price_source TEXT DEFAULT 'MANUAL' CHECK (price_source IN ('MANUAL', 'GRN', 'BULK_UPDATE')),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(item_code, effective_date)
);

-- Price change history table
CREATE TABLE IF NOT EXISTS public.item_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL,
  old_price NUMERIC(15,4),
  new_price NUMERIC(15,4) NOT NULL,
  price_change_percentage NUMERIC(8,2),
  change_reason TEXT,
  change_type TEXT DEFAULT 'UPDATE' CHECK (change_type IN ('UPDATE', 'BULK_UPDATE', 'AUTOMATIC')),
  effective_date DATE DEFAULT CURRENT_DATE,
  changed_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.item_pricing_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_price_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for item pricing master
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

-- RLS policies for price history
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

CREATE POLICY "Approved users can create price history" ON public.item_price_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid() 
      AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

-- Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_item_pricing_master_updated_at 
  BEFORE UPDATE ON public.item_pricing_master
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update item price with history tracking
CREATE OR REPLACE FUNCTION update_item_price(
  p_item_code TEXT,
  p_new_price NUMERIC,
  p_reason TEXT DEFAULT 'Manual price update'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_price NUMERIC;
  v_price_change_pct NUMERIC;
BEGIN
  -- Get current price
  SELECT current_price INTO v_old_price
  FROM public.item_pricing_master
  WHERE item_code = p_item_code AND is_active = true
  ORDER BY effective_date DESC
  LIMIT 1;

  -- Calculate percentage change
  IF v_old_price IS NOT NULL AND v_old_price > 0 THEN
    v_price_change_pct := ((p_new_price - v_old_price) / v_old_price) * 100;
  END IF;

  -- Insert or update pricing master
  INSERT INTO public.item_pricing_master (
    item_code, current_price, previous_price, price_change_reason, 
    created_by, updated_by, approval_status
  )
  VALUES (
    p_item_code, p_new_price, v_old_price, p_reason,
    auth.uid(), auth.uid(), 'APPROVED'
  )
  ON CONFLICT (item_code, effective_date) 
  DO UPDATE SET
    previous_price = v_old_price,
    current_price = p_new_price,
    price_change_reason = p_reason,
    updated_by = auth.uid(),
    updated_at = now();

  -- Insert price history
  INSERT INTO public.item_price_history (
    item_code, old_price, new_price, price_change_percentage,
    change_reason, changed_by
  )
  VALUES (
    p_item_code, v_old_price, p_new_price, v_price_change_pct,
    p_reason, auth.uid()
  );

  RETURN TRUE;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_pricing_master_item_code ON public.item_pricing_master(item_code);
CREATE INDEX IF NOT EXISTS idx_item_pricing_master_active ON public.item_pricing_master(is_active, approval_status);
CREATE INDEX IF NOT EXISTS idx_item_pricing_master_effective_date ON public.item_pricing_master(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_item_price_history_item_code ON public.item_price_history(item_code);
CREATE INDEX IF NOT EXISTS idx_item_price_history_date ON public.item_price_history(created_at DESC);
