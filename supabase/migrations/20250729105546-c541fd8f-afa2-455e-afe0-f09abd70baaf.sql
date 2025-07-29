-- Setup approval matrix for General Manager role
INSERT INTO approval_matrix (
  entity_type,
  approval_level,
  approver_role,
  min_amount,
  max_amount,
  is_active,
  is_mandatory
) VALUES (
  'PURCHASE_ORDER',
  1,
  'general_manager',
  0,
  NULL, -- No upper limit
  true,
  true
) ON CONFLICT DO NOTHING;

-- Update admin user to have general_manager role
UPDATE profiles 
SET role = 'general_manager'
WHERE email = 'info@satguruengravures.com';

-- Create purchase_order_approvals table if it doesn't exist
CREATE TABLE IF NOT EXISTS purchase_order_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  approval_level INTEGER NOT NULL,
  required_role TEXT NOT NULL,
  approver_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  approved_at TIMESTAMP WITH TIME ZONE,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on purchase_order_approvals
ALTER TABLE purchase_order_approvals ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for purchase_order_approvals
CREATE POLICY "Users can view approvals for their organization" 
ON purchase_order_approvals 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN purchase_orders po ON po.id = purchase_order_approvals.purchase_order_id
    WHERE p.id = auth.uid() 
    AND p.organization_id = po.organization_id
  )
);

-- Create function to process PO approval if it doesn't exist
CREATE OR REPLACE FUNCTION process_po_approval(
  p_approval_id UUID,
  p_action TEXT, -- 'APPROVE' or 'REJECT'
  p_comments TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_approval RECORD;
  v_po RECORD;
  v_approver_role TEXT;
  v_result JSONB;
BEGIN
  -- Get approval record
  SELECT * INTO v_approval
  FROM purchase_order_approvals
  WHERE id = p_approval_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Approval record not found');
  END IF;
  
  -- Get approver role
  SELECT role INTO v_approver_role
  FROM profiles
  WHERE id = auth.uid();
  
  -- Check if user has required role
  IF v_approver_role != v_approval.required_role THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;
  
  -- Update approval record
  UPDATE purchase_order_approvals 
  SET 
    status = p_action,
    approver_id = auth.uid(),
    approved_at = NOW(),
    comments = p_comments,
    updated_at = NOW()
  WHERE id = p_approval_id;
  
  -- Get PO record
  SELECT * INTO v_po
  FROM purchase_orders
  WHERE id = v_approval.purchase_order_id;
  
  -- Update PO status based on approval action
  IF p_action = 'APPROVED' THEN
    UPDATE purchase_orders 
    SET 
      approval_status = 'APPROVED',
      status = 'APPROVED',
      updated_at = NOW()
    WHERE id = v_approval.purchase_order_id;
  ELSIF p_action = 'REJECTED' THEN
    UPDATE purchase_orders 
    SET 
      approval_status = 'REJECTED',
      status = 'REJECTED',
      updated_at = NOW()
    WHERE id = v_approval.purchase_order_id;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'Approval processed successfully');
END;
$$;