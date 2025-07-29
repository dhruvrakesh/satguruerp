-- Phase 1: Drop and recreate the function with correct signature
DROP FUNCTION IF EXISTS get_user_pending_approvals(uuid);

-- Phase 2: Create approval records for existing submitted POs
DO $$
DECLARE
    po_record RECORD;
BEGIN
    -- Find all submitted POs without approval records
    FOR po_record IN 
        SELECT po.id, po.total_amount, po.po_number
        FROM purchase_orders po
        WHERE po.status = 'SUBMITTED' 
        AND NOT EXISTS (
            SELECT 1 FROM purchase_order_approvals poa 
            WHERE poa.po_id = po.id
        )
    LOOP
        -- Create approval records for each submitted PO
        PERFORM auto_create_po_approvals(po_record.id, po_record.total_amount);
        RAISE NOTICE 'Created approval records for PO: %', po_record.po_number;
    END LOOP;
END $$;

-- Phase 3: Create trigger to automatically create approval records when PO is submitted
CREATE OR REPLACE FUNCTION trigger_create_po_approvals()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create approvals when status changes to SUBMITTED
    IF NEW.status = 'SUBMITTED' AND (OLD.status IS NULL OR OLD.status != 'SUBMITTED') THEN
        PERFORM auto_create_po_approvals(NEW.id, NEW.total_amount);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS auto_create_approvals_on_submit ON purchase_orders;
CREATE TRIGGER auto_create_approvals_on_submit
    AFTER INSERT OR UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION trigger_create_po_approvals();

-- Phase 4: Recreate the get_user_pending_approvals function with correct signature
CREATE OR REPLACE FUNCTION get_user_pending_approvals(p_user_id uuid)
RETURNS TABLE (
    id uuid,
    po_id uuid,
    approval_level integer,
    approval_status text,
    approver_id uuid,
    approved_at timestamp with time zone,
    comments text,
    created_at timestamp with time zone,
    po_number text,
    total_amount numeric,
    delivery_date timestamp with time zone,
    po_status text,
    po_approval_status text,
    po_created_at timestamp with time zone,
    supplier_name text,
    supplier_code text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role text;
BEGIN
    -- Get user role
    SELECT p.role INTO user_role
    FROM profiles p
    WHERE p.id = p_user_id;
    
    -- Only general_manager and admin can see approvals
    IF user_role NOT IN ('general_manager', 'admin') THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        poa.id,
        poa.po_id,
        poa.approval_level,
        poa.approval_status::text,
        poa.approver_id,
        poa.approved_at,
        poa.comments,
        poa.created_at,
        po.po_number,
        po.total_amount,
        po.delivery_date,
        po.status::text as po_status,
        po.approval_status::text as po_approval_status,
        po.created_at as po_created_at,
        s.supplier_name,
        s.supplier_code
    FROM purchase_order_approvals poa
    JOIN purchase_orders po ON poa.po_id = po.id
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    WHERE poa.approval_status = 'PENDING'
    AND (
        poa.approver_id = p_user_id 
        OR poa.approver_role = user_role
        OR user_role = 'admin'
    )
    ORDER BY poa.created_at DESC;
END;
$$;