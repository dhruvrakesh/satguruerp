
-- Phase 1: Fix RLS Policies for SATGURU Organization Access

-- Update item_master RLS policy to allow both DKEGL and SATGURU organizations
DROP POLICY IF EXISTS "DKEGL users can manage item master" ON public.item_master;

CREATE POLICY "Approved users can manage item master" ON public.item_master
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() 
    AND p.is_approved = true
    AND o.code IN ('DKEGL', 'SATGURU')
  )
);

-- Update categories RLS policy to allow both organizations
DROP POLICY IF EXISTS "DKEGL users can manage categories" ON public.categories;

CREATE POLICY "Approved users can manage categories" ON public.categories
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() 
    AND p.is_approved = true
    AND o.code IN ('DKEGL', 'SATGURU')
  )
);

-- Ensure bill_of_materials supports both organizations
DROP POLICY IF EXISTS "DKEGL users can manage BOM" ON public.bill_of_materials;

CREATE POLICY "Approved users can manage BOM" ON public.bill_of_materials
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() 
    AND p.is_approved = true
    AND o.code IN ('DKEGL', 'SATGURU')
  )
);
