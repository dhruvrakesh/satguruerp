-- Drop the existing constraint that's blocking the role update
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_valid_role;

-- Add a more inclusive constraint that allows general_manager
ALTER TABLE profiles ADD CONSTRAINT check_valid_role 
CHECK (role IN ('admin', 'manager', 'user', 'production_manager', 'general_manager', 'hr', 'procurement', 'finance', 'quality_control'));

-- Now update admin user to have general_manager role
UPDATE profiles 
SET role = 'general_manager'
WHERE email = 'info@satguruengravures.com';

-- Create function to auto-generate approval records when PO is submitted
CREATE OR REPLACE FUNCTION auto_create_po_approvals(p_po_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  approval_req RECORD;
BEGIN
  -- Get approval requirements from matrix
  FOR approval_req IN 
    SELECT 
      approval_level,
      approver_role,
      min_amount,
      max_amount
    FROM approval_matrix 
    WHERE entity_type = 'PURCHASE_ORDER' 
    AND is_active = true 
    ORDER BY approval_level
  LOOP
    -- Create approval record
    INSERT INTO purchase_order_approvals (
      purchase_order_id,
      approval_level,
      required_role,
      status,
      created_at
    ) VALUES (
      p_po_id,
      approval_req.approval_level,
      approval_req.approver_role,
      'PENDING',
      NOW()
    );
  END LOOP;
END;
$$;