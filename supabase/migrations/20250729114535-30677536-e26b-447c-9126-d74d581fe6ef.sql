-- Fix the get_user_pending_approvals function with correct return type
DROP FUNCTION IF EXISTS public.get_user_pending_approvals(uuid);

CREATE OR REPLACE FUNCTION public.get_user_pending_approvals(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  po_id uuid,
  approval_level integer,
  approval_status text,
  approver_id uuid,
  approver_role text,
  remarks text,
  created_at timestamp with time zone,
  submitted_at timestamp with time zone,
  po_number text,
  supplier_name text,
  total_amount numeric,
  delivery_date date,
  priority text,
  po_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    poa.id,
    poa.po_id,
    poa.approval_level,
    poa.approval_status,
    poa.approver_id,
    poa.approver_role,
    poa.remarks,
    poa.created_at,
    poa.submitted_at,
    po.po_number,
    s.supplier_name,
    po.total_amount,
    po.delivery_date,
    po.priority,
    po.status as po_status
  FROM purchase_order_approvals poa
  JOIN purchase_orders po ON poa.po_id = po.id
  LEFT JOIN suppliers s ON po.supplier_id = s.id
  WHERE poa.approval_status = 'PENDING'
    AND (
      poa.approver_id = p_user_id 
      OR poa.approver_role IN (
        SELECT role FROM profiles WHERE id = p_user_id AND role IN ('admin', 'general_manager')
      )
    );
END;
$$;