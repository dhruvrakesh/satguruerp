
-- Phase 1: Enterprise Purchase Order Management System
-- 1.1 Purchase Order Management System

-- Create purchase order statuses enum
CREATE TYPE purchase_order_status AS ENUM (
  'DRAFT',
  'SUBMITTED', 
  'APPROVED',
  'ISSUED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CLOSED',
  'CANCELLED'
);

-- Create purchase order priority enum
CREATE TYPE purchase_order_priority AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
  'EMERGENCY'
);

-- Create approval status enum
CREATE TYPE approval_status AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'ESCALATED'
);

-- Enhanced supplier master table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code TEXT UNIQUE NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_type TEXT DEFAULT 'VENDOR' CHECK (supplier_type IN ('VENDOR', 'MANUFACTURER', 'DISTRIBUTOR', 'AGENT')),
  category TEXT DEFAULT 'STANDARD' CHECK (category IN ('PREMIUM', 'STANDARD', 'BACKUP')),
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address JSONB DEFAULT '{}',
  payment_terms TEXT DEFAULT 'NET_30',
  credit_limit NUMERIC DEFAULT 0,
  tax_details JSONB DEFAULT '{}',
  bank_details JSONB DEFAULT '{}',
  certifications JSONB DEFAULT '{}',
  performance_rating NUMERIC DEFAULT 0 CHECK (performance_rating >= 0 AND performance_rating <= 100),
  is_active BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT false,
  material_categories TEXT[] DEFAULT '{}',
  lead_time_days INTEGER DEFAULT 7,
  minimum_order_value NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Purchase order sequence table
CREATE TABLE IF NOT EXISTS public.purchase_order_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year INTEGER NOT NULL,
  prefix TEXT NOT NULL DEFAULT 'PO',
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(fiscal_year, prefix)
);

-- Purchase orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) NOT NULL,
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  required_date DATE,
  delivery_date DATE,
  status purchase_order_status DEFAULT 'DRAFT',
  priority purchase_order_priority DEFAULT 'MEDIUM',
  currency TEXT DEFAULT 'INR',
  exchange_rate NUMERIC DEFAULT 1.0,
  subtotal NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  terms_conditions TEXT,
  shipping_address JSONB DEFAULT '{}',
  billing_address JSONB DEFAULT '{}',
  notes TEXT,
  reference_number TEXT,
  department TEXT,
  cost_center TEXT,
  project_code TEXT,
  approval_required BOOLEAN DEFAULT true,
  approval_status approval_status DEFAULT 'PENDING',
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  issued_at TIMESTAMP WITH TIME ZONE,
  issued_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID REFERENCES auth.users(id),
  revision_number INTEGER DEFAULT 1,
  parent_po_id UUID REFERENCES public.purchase_orders(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Purchase order items table
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  discount_percentage NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  tax_percentage NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  line_total NUMERIC NOT NULL,
  uom TEXT NOT NULL,
  required_date DATE,
  specifications JSONB DEFAULT '{}',
  received_quantity NUMERIC DEFAULT 0,
  pending_quantity NUMERIC GENERATED ALWAYS AS (quantity - received_quantity) STORED,
  is_closed BOOLEAN DEFAULT false,
  line_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(po_id, line_number)
);

-- Purchase order approvals table
CREATE TABLE IF NOT EXISTS public.purchase_order_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  approval_level INTEGER NOT NULL,
  approver_id UUID REFERENCES auth.users(id),
  approval_status approval_status DEFAULT 'PENDING',
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  comments TEXT,
  delegation_from UUID REFERENCES auth.users(id),
  notification_sent BOOLEAN DEFAULT false,
  escalation_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.2 Reorder Management System

-- Reorder rules table
CREATE TABLE IF NOT EXISTS public.reorder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id),
  reorder_level NUMERIC NOT NULL CHECK (reorder_level >= 0),
  reorder_quantity NUMERIC NOT NULL CHECK (reorder_quantity > 0),
  safety_stock NUMERIC DEFAULT 0,
  maximum_stock NUMERIC,
  lead_time_days INTEGER NOT NULL DEFAULT 7,
  minimum_order_quantity NUMERIC DEFAULT 1,
  economic_order_quantity NUMERIC,
  seasonal_factor NUMERIC DEFAULT 1.0,
  consumption_rate NUMERIC DEFAULT 0,
  last_consumption_date DATE,
  auto_reorder_enabled BOOLEAN DEFAULT false,
  priority_level INTEGER DEFAULT 1,
  category_specific_rules JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(item_code, supplier_id)
);

-- Reorder suggestions table
CREATE TABLE IF NOT EXISTS public.reorder_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL,
  current_stock NUMERIC NOT NULL,
  reorder_level NUMERIC NOT NULL,
  suggested_quantity NUMERIC NOT NULL,
  urgency_level TEXT DEFAULT 'MEDIUM' CHECK (urgency_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  estimated_stockout_date DATE,
  supplier_id UUID REFERENCES public.suppliers(id),
  estimated_cost NUMERIC,
  reason TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'ORDERED')),
  po_id UUID REFERENCES public.purchase_orders(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- 1.3 Approval Workflow System

-- Approval matrix table
CREATE TABLE IF NOT EXISTS public.approval_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('PURCHASE_ORDER', 'SUPPLIER', 'REORDER_RULE')),
  department TEXT,
  category TEXT,
  min_amount NUMERIC DEFAULT 0,
  max_amount NUMERIC,
  approval_level INTEGER NOT NULL,
  approver_role TEXT,
  approver_id UUID REFERENCES auth.users(id),
  is_mandatory BOOLEAN DEFAULT true,
  escalation_hours INTEGER DEFAULT 24,
  delegate_to UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON public.suppliers(supplier_code);
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON public.suppliers(category);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON public.suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_number ON public.purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON public.purchase_orders(po_date);
CREATE INDEX IF NOT EXISTS idx_po_items_code ON public.purchase_order_items(item_code);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON public.purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_reorder_rules_item ON public.reorder_rules(item_code);
CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_item ON public.reorder_suggestions(item_code);
CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_status ON public.reorder_suggestions(status);

-- Functions for PO number generation
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  fiscal_year INTEGER;
  next_sequence INTEGER;
  po_number TEXT;
BEGIN
  -- Get current fiscal year (April to March)
  fiscal_year := CASE 
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN EXTRACT(YEAR FROM CURRENT_DATE)
    ELSE EXTRACT(YEAR FROM CURRENT_DATE) - 1
  END;
  
  -- Get next sequence number
  INSERT INTO public.purchase_order_sequences (fiscal_year, prefix, last_sequence)
  VALUES (fiscal_year, 'PO', 1)
  ON CONFLICT (fiscal_year, prefix) 
  DO UPDATE SET last_sequence = purchase_order_sequences.last_sequence + 1
  RETURNING last_sequence INTO next_sequence;
  
  -- Generate PO number: PO-YYYY-XXXX
  po_number := 'PO-' || fiscal_year || '-' || LPAD(next_sequence::TEXT, 4, '0');
  
  RETURN po_number;
END;
$$;

-- Function for automatic reorder calculation
CREATE OR REPLACE FUNCTION calculate_reorder_suggestions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item_record RECORD;
  suggestion_count INTEGER := 0;
  critical_count INTEGER := 0;
  result JSONB;
BEGIN
  -- Clear previous suggestions
  DELETE FROM public.reorder_suggestions WHERE status = 'PENDING';
  
  -- Calculate reorder suggestions based on current stock vs reorder levels
  FOR item_record IN 
    SELECT 
      s.item_code,
      s.current_qty,
      r.reorder_level,
      r.reorder_quantity,
      r.safety_stock,
      r.supplier_id,
      r.lead_time_days,
      CASE 
        WHEN s.current_qty <= r.safety_stock THEN 'CRITICAL'
        WHEN s.current_qty <= r.reorder_level * 0.5 THEN 'HIGH'
        WHEN s.current_qty <= r.reorder_level THEN 'MEDIUM'
        ELSE 'LOW'
      END as urgency_level
    FROM public.satguru_stock s
    JOIN public.reorder_rules r ON s.item_code = r.item_code
    WHERE r.is_active = true
      AND s.current_qty <= r.reorder_level
  LOOP
    INSERT INTO public.reorder_suggestions (
      item_code,
      current_stock,
      reorder_level,
      suggested_quantity,
      urgency_level,
      supplier_id,
      estimated_stockout_date,
      reason
    ) VALUES (
      item_record.item_code,
      item_record.current_qty,
      item_record.reorder_level,
      item_record.reorder_quantity,
      item_record.urgency_level,
      item_record.supplier_id,
      CURRENT_DATE + INTERVAL '1 day' * item_record.lead_time_days,
      'Stock level below reorder point'
    );
    
    suggestion_count := suggestion_count + 1;
    
    IF item_record.urgency_level = 'CRITICAL' THEN
      critical_count := critical_count + 1;
    END IF;
  END LOOP;
  
  result := jsonb_build_object(
    'total_suggestions', suggestion_count,
    'critical_items', critical_count,
    'generated_at', NOW()
  );
  
  RETURN result;
END;
$$;

-- Function for PO approval workflow
CREATE OR REPLACE FUNCTION process_po_approval(
  p_po_id UUID,
  p_approver_id UUID,
  p_action TEXT,
  p_comments TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  po_record RECORD;
  approval_record RECORD;
  next_level INTEGER;
  result JSONB;
BEGIN
  -- Get PO details
  SELECT * INTO po_record FROM public.purchase_orders WHERE id = p_po_id;
  
  IF po_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Purchase order not found');
  END IF;
  
  -- Get current approval level
  SELECT * INTO approval_record 
  FROM public.purchase_order_approvals 
  WHERE po_id = p_po_id AND approver_id = p_approver_id AND approval_status = 'PENDING';
  
  IF approval_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending approval found for this user');
  END IF;
  
  -- Process approval/rejection
  IF p_action = 'APPROVE' THEN
    UPDATE public.purchase_order_approvals
    SET 
      approval_status = 'APPROVED',
      approved_at = NOW(),
      comments = p_comments
    WHERE id = approval_record.id;
    
    -- Check if this was the final approval level
    SELECT MAX(approval_level) INTO next_level
    FROM public.purchase_order_approvals
    WHERE po_id = p_po_id;
    
    IF approval_record.approval_level = next_level THEN
      -- Final approval - mark PO as approved
      UPDATE public.purchase_orders
      SET 
        status = 'APPROVED',
        approval_status = 'APPROVED',
        approved_at = NOW(),
        approved_by = p_approver_id
      WHERE id = p_po_id;
      
      result := jsonb_build_object('success', true, 'message', 'Purchase order fully approved');
    ELSE
      result := jsonb_build_object('success', true, 'message', 'Approval recorded, waiting for next level');
    END IF;
    
  ELSIF p_action = 'REJECT' THEN
    UPDATE public.purchase_order_approvals
    SET 
      approval_status = 'REJECTED',
      rejected_at = NOW(),
      comments = p_comments
    WHERE id = approval_record.id;
    
    -- Mark PO as rejected
    UPDATE public.purchase_orders
    SET 
      status = 'DRAFT',
      approval_status = 'REJECTED'
    WHERE id = p_po_id;
    
    result := jsonb_build_object('success', true, 'message', 'Purchase order rejected');
  ELSE
    result := jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;
  
  RETURN result;
END;
$$;

-- Enable RLS on all tables
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reorder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reorder_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_matrix ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Approved users can manage suppliers" ON public.suppliers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid() 
      AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

CREATE POLICY "Approved users can manage purchase orders" ON public.purchase_orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid() 
      AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

CREATE POLICY "Approved users can manage PO items" ON public.purchase_order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid() 
      AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

CREATE POLICY "Approved users can manage approvals" ON public.purchase_order_approvals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid() 
      AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

CREATE POLICY "Approved users can manage reorder rules" ON public.reorder_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid() 
      AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

CREATE POLICY "Approved users can manage reorder suggestions" ON public.reorder_suggestions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid() 
      AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

CREATE POLICY "Approved users can manage approval matrix" ON public.approval_matrix
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid() 
      AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

-- Insert sample data for testing
INSERT INTO public.suppliers (supplier_code, supplier_name, supplier_type, category, contact_person, email, phone, material_categories, lead_time_days, created_by)
VALUES 
  ('SUP001', 'Premium Films Industries', 'MANUFACTURER', 'PREMIUM', 'Rajesh Kumar', 'rajesh@premiumfilms.com', '+91-9876543210', ARRAY['BOPP', 'PET'], 7, auth.uid()),
  ('SUP002', 'Ink Solutions Ltd', 'DISTRIBUTOR', 'STANDARD', 'Priya Sharma', 'priya@inksolutions.com', '+91-9876543211', ARRAY['INKS', 'SOLVENTS'], 5, auth.uid()),
  ('SUP003', 'Lamination Materials Co', 'VENDOR', 'STANDARD', 'Amit Patel', 'amit@lamination.com', '+91-9876543212', ARRAY['LDPELAM', 'ADHESIVES'], 10, auth.uid()),
  ('SUP004', 'Granule Suppliers', 'MANUFACTURER', 'PREMIUM', 'Sunita Gupta', 'sunita@granules.com', '+91-9876543213', ARRAY['GRAN', 'POLYMERS'], 14, auth.uid());

-- Insert sample approval matrix
INSERT INTO public.approval_matrix (entity_type, department, min_amount, max_amount, approval_level, approver_role, is_mandatory, escalation_hours)
VALUES 
  ('PURCHASE_ORDER', 'PRODUCTION', 0, 50000, 1, 'PRODUCTION_MANAGER', true, 8),
  ('PURCHASE_ORDER', 'PRODUCTION', 50001, 200000, 2, 'PROCUREMENT_MANAGER', true, 12),
  ('PURCHASE_ORDER', 'PRODUCTION', 200001, 500000, 3, 'FINANCE_MANAGER', true, 24),
  ('PURCHASE_ORDER', 'PRODUCTION', 500001, NULL, 4, 'GENERAL_MANAGER', true, 48);

-- Insert sample reorder rules for key materials
INSERT INTO public.reorder_rules (item_code, reorder_level, reorder_quantity, safety_stock, lead_time_days, auto_reorder_enabled, created_by)
SELECT 
  item_code,
  CASE 
    WHEN category_name LIKE '%BOPP%' THEN 500
    WHEN category_name LIKE '%PET%' THEN 300
    WHEN category_name LIKE '%INK%' THEN 100
    WHEN category_name LIKE '%GRAN%' THEN 1000
    ELSE 200
  END as reorder_level,
  CASE 
    WHEN category_name LIKE '%BOPP%' THEN 2000
    WHEN category_name LIKE '%PET%' THEN 1500
    WHEN category_name LIKE '%INK%' THEN 500
    WHEN category_name LIKE '%GRAN%' THEN 5000
    ELSE 1000
  END as reorder_quantity,
  CASE 
    WHEN category_name LIKE '%BOPP%' THEN 100
    WHEN category_name LIKE '%PET%' THEN 50
    WHEN category_name LIKE '%INK%' THEN 20
    WHEN category_name LIKE '%GRAN%' THEN 200
    ELSE 50
  END as safety_stock,
  CASE 
    WHEN category_name LIKE '%BOPP%' THEN 7
    WHEN category_name LIKE '%PET%' THEN 10
    WHEN category_name LIKE '%INK%' THEN 5
    WHEN category_name LIKE '%GRAN%' THEN 14
    ELSE 7
  END as lead_time_days,
  true,
  auth.uid()
FROM public.satguru_item_master sim
JOIN public.categories c ON sim.category_id = c.id
WHERE c.category_name IN ('BOPP', 'PET', 'LDPELAM', 'GRAN', 'INKS')
AND sim.usage_type = 'RAW_MATERIAL'
LIMIT 50;

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_po_number() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_reorder_suggestions() TO authenticated;
GRANT EXECUTE ON FUNCTION process_po_approval(UUID, UUID, TEXT, TEXT) TO authenticated;
