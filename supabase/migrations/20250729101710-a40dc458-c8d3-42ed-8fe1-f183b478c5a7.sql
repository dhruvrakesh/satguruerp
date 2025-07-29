-- Fix PO-2025-0001 by updating it with proper organization_id and created_by
-- First, let's get a valid user to assign this PO to
UPDATE public.purchase_orders 
SET 
    organization_id = 'eb3d46a8-a4f1-4f9a-9d92-385d2adeb9b4',
    created_by = '013013f4-fac2-4316-b883-4a5970ae85d6'
WHERE po_number = 'PO-2025-0001' AND (organization_id IS NULL OR created_by IS NULL);