-- Fix the profiles table role constraint to include general_manager
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add the updated constraint with general_manager included
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role = ANY (ARRAY['admin'::text, 'user'::text, 'manager'::text, 'general_manager'::text, 'operator'::text, 'viewer'::text]));

-- Update the admin user role to general_manager
UPDATE public.profiles 
SET role = 'general_manager' 
WHERE email = 'info@satguruengravures.com' OR id IN (
  SELECT id FROM auth.users WHERE email = 'info@satguruengravures.com'
);