-- Fix purchase orders RLS policy for better authentication handling
-- First, update any existing POs that still have null organization_id

UPDATE public.purchase_orders 
SET organization_id = (
    SELECT p.organization_id 
    FROM public.profiles p 
    WHERE p.id = purchase_orders.created_by
)
WHERE organization_id IS NULL;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can manage purchase orders in their organization" ON public.purchase_orders;
DROP POLICY IF EXISTS "System can insert purchase orders" ON public.purchase_orders;

-- Create a more robust RLS policy that handles authentication better
CREATE POLICY "authenticated_users_can_manage_purchase_orders" 
ON public.purchase_orders 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 
        FROM public.profiles p 
        WHERE p.id = auth.uid() 
        AND p.organization_id = purchase_orders.organization_id
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM public.profiles p 
        WHERE p.id = auth.uid() 
        AND p.organization_id = purchase_orders.organization_id
    )
);

-- Enable RLS on the table if not already enabled
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;