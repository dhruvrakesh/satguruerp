-- Add missing columns to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS remarks TEXT,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;

-- Add missing approver_role column to purchase_order_approvals table
ALTER TABLE public.purchase_order_approvals 
ADD COLUMN IF NOT EXISTS approver_role TEXT;

-- Update the auto_create_po_approvals function to include approver_role
CREATE OR REPLACE FUNCTION public.auto_create_po_approvals(po_id UUID, po_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  approval_rule RECORD;
  approval_order INTEGER := 1;
BEGIN
  -- Get all applicable approval rules for this amount and sort by approval_level
  FOR approval_rule IN 
    SELECT 
      id,
      approval_level,
      approver_id,
      approver_role,
      min_amount,
      max_amount,
      is_mandatory
    FROM approval_matrix 
    WHERE is_active = true 
    AND entity_type = 'PURCHASE_ORDER'
    AND (min_amount IS NULL OR po_amount >= min_amount)
    AND (max_amount IS NULL OR po_amount <= max_amount)
    ORDER BY approval_level ASC
  LOOP
    -- Create approval record for each applicable rule
    INSERT INTO purchase_order_approvals (
      po_id,
      approval_level,
      approval_status,
      approver_id,
      approver_role,
      created_at
    ) VALUES (
      po_id,
      approval_rule.approval_level,
      'PENDING',
      approval_rule.approver_id,
      approval_rule.approver_role,
      NOW()
    );
  END LOOP;
END;
$$;

-- Update the get_user_pending_approvals function to work properly with admin role
CREATE OR REPLACE FUNCTION public.get_user_pending_approvals(user_id UUID)
RETURNS TABLE (
  id UUID,
  po_id UUID,
  approval_level INTEGER,
  approval_status TEXT,
  approver_id UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  po_number TEXT,
  total_amount NUMERIC,
  delivery_date TIMESTAMP WITH TIME ZONE,
  po_status TEXT,
  po_approval_status TEXT,
  po_created_at TIMESTAMP WITH TIME ZONE,
  supplier_name TEXT,
  supplier_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role_val TEXT;
BEGIN
  -- Get user's role
  SELECT role INTO user_role_val
  FROM profiles
  WHERE profiles.id = user_id;
  
  -- If user is admin, return all pending approvals
  IF user_role_val = 'admin' THEN
    RETURN QUERY
    SELECT 
      poa.id,
      poa.po_id,
      poa.approval_level,
      poa.approval_status::TEXT,
      poa.approver_id,
      poa.approved_at,
      poa.comments,
      poa.created_at,
      po.po_number,
      po.total_amount,
      po.delivery_date,
      po.status::TEXT as po_status,
      po.approval_status::TEXT as po_approval_status,
      po.created_at as po_created_at,
      s.supplier_name,
      s.supplier_code
    FROM purchase_order_approvals poa
    JOIN purchase_orders po ON poa.po_id = po.id
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    WHERE poa.approval_status = 'PENDING'
    ORDER BY po.created_at DESC;
  ELSE
    -- For non-admin users, return approvals assigned to them or their role
    RETURN QUERY
    SELECT 
      poa.id,
      poa.po_id,
      poa.approval_level,
      poa.approval_status::TEXT,
      poa.approver_id,
      poa.approved_at,
      poa.comments,
      poa.created_at,
      po.po_number,
      po.total_amount,
      po.delivery_date,
      po.status::TEXT as po_status,
      po.approval_status::TEXT as po_approval_status,
      po.created_at as po_created_at,
      s.supplier_name,
      s.supplier_code
    FROM purchase_order_approvals poa
    JOIN purchase_orders po ON poa.po_id = po.id
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    WHERE poa.approval_status = 'PENDING'
    AND (poa.approver_id = user_id OR poa.approver_role = user_role_val)
    ORDER BY po.created_at DESC;
  END IF;
END;
$$;