-- Phase 1: Add Admin Role to Approval Matrix
INSERT INTO public.approval_matrix (
  entity_type,
  approver_role,
  approval_level,
  min_amount,
  max_amount,
  is_active,
  is_mandatory,
  escalation_hours
) VALUES (
  'PURCHASE_ORDER',
  'admin',
  0, -- Highest priority level
  0,
  NULL, -- No maximum amount limit
  true,
  true,
  24
) ON CONFLICT DO NOTHING;

-- Phase 2: Update the auto_create_po_approvals function to include admin role
CREATE OR REPLACE FUNCTION public.auto_create_po_approvals()
RETURNS TRIGGER AS $$
DECLARE
  approval_rules CURSOR FOR
    SELECT 
      am.approver_role,
      am.approval_level,
      am.escalation_hours,
      am.approver_id
    FROM approval_matrix am
    WHERE am.entity_type = 'PURCHASE_ORDER'
      AND am.is_active = true
      AND (am.min_amount IS NULL OR NEW.total_amount >= am.min_amount)
      AND (am.max_amount IS NULL OR NEW.total_amount <= am.max_amount)
    ORDER BY am.approval_level ASC; -- Admin (level 0) will be first
  
  rule_record RECORD;
  approval_id UUID;
BEGIN
  -- Only create approval records for submitted POs
  IF NEW.status = 'SUBMITTED' AND (OLD.status IS NULL OR OLD.status != 'SUBMITTED') THEN
    FOR rule_record IN approval_rules LOOP
      -- Create approval record
      INSERT INTO purchase_order_approvals (
        po_id,
        approval_level,
        approval_status,
        approver_role,
        approver_id,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        rule_record.approval_level,
        'PENDING',
        rule_record.approver_role,
        rule_record.approver_id,
        NOW(),
        NOW()
      ) RETURNING id INTO approval_id;
      
      RAISE LOG 'Created approval record % for PO % with role % at level %', 
        approval_id, NEW.id, rule_record.approver_role, rule_record.approval_level;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Phase 3: Update the usePOApprovals hook to handle admin role properly
-- Add admin role check to the fetchPendingApprovals logic
CREATE OR REPLACE FUNCTION public.get_user_pending_approvals(user_id UUID)
RETURNS TABLE (
  id TEXT,
  po_id TEXT,
  approval_level INTEGER,
  approval_status TEXT,
  approver_id TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  po_number TEXT,
  total_amount NUMERIC,
  delivery_date DATE,
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
  user_role TEXT;
BEGIN
  -- Get user's role
  SELECT p.role INTO user_role
  FROM profiles p
  WHERE p.id = user_id;
  
  -- Return approvals based on user role
  RETURN QUERY
  SELECT 
    poa.id::TEXT,
    poa.po_id::TEXT,
    poa.approval_level,
    poa.approval_status::TEXT,
    poa.approver_id::TEXT,
    poa.approved_at,
    poa.comments,
    poa.created_at,
    po.po_number,
    po.total_amount,
    po.delivery_date,
    po.status::TEXT,
    po.approval_status::TEXT,
    po.created_at,
    s.supplier_name,
    s.supplier_code
  FROM purchase_order_approvals poa
  JOIN purchase_orders po ON poa.po_id = po.id
  LEFT JOIN suppliers s ON po.supplier_id = s.id
  WHERE poa.approval_status = 'PENDING'
    AND (
      -- Admin can approve anything
      (user_role = 'admin') OR
      -- General manager can approve based on approval matrix
      (user_role = 'general_manager' AND poa.approver_role = 'general_manager') OR
      -- Other roles match exactly
      (poa.approver_role = user_role)
    )
  ORDER BY poa.created_at DESC;
END;
$$;