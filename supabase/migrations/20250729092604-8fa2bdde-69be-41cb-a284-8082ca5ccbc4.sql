-- Fix purchase orders visibility issue by updating RLS policy and adding organization context

-- First, add organization_id to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

-- Set organization_id for existing records based on created_by user's organization
UPDATE public.purchase_orders 
SET organization_id = (
    SELECT p.organization_id 
    FROM public.profiles p 
    WHERE p.id = purchase_orders.created_by
)
WHERE organization_id IS NULL;

-- Drop the existing restrictive RLS policy
DROP POLICY IF EXISTS "Approved users can manage purchase orders" ON public.purchase_orders;

-- Create a new, more permissive RLS policy
CREATE POLICY "Users can manage purchase orders in their organization" 
ON public.purchase_orders 
FOR ALL 
TO authenticated 
USING (
    organization_id = (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid()
    )
) 
WITH CHECK (
    organization_id = (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Also create a policy for system operations (like creating POs)
CREATE POLICY "System can insert purchase orders" 
ON public.purchase_orders 
FOR INSERT 
TO authenticated 
WITH CHECK (true);