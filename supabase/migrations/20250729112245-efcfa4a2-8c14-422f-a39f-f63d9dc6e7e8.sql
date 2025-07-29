-- First, update any employees to users temporarily, then fix constraint
UPDATE public.profiles SET role = 'user' WHERE role = 'employee';

-- Drop existing constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add updated constraint with all valid roles including general_manager
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role = ANY (ARRAY['admin'::text, 'user'::text, 'manager'::text, 'general_manager'::text, 'operator'::text, 'viewer'::text, 'employee'::text]));

-- Update the admin user role to general_manager
UPDATE public.profiles 
SET role = 'general_manager' 
WHERE email = 'info@satguruengravures.com';