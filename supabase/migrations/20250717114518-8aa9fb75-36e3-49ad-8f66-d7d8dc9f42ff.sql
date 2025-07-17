-- First, let's check the current handle_new_user function
-- and update it to properly handle Satguru Engravures users

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  org_id UUID;
  user_role TEXT;
BEGIN
  -- Determine organization based on email domain
  IF NEW.email LIKE '%@satguruengravures.com' THEN
    SELECT id INTO org_id FROM public.organizations WHERE code = 'SATGURU';
  ELSE
    -- Default to DKEGL for any other domain
    SELECT id INTO org_id FROM public.organizations WHERE code = 'DKEGL';
  END IF;

  -- Assign 'admin' role to the specific admin email, otherwise 'user'
  IF NEW.email = 'info@satguruengravures.com' THEN
    user_role := 'admin';
  ELSE
    user_role := 'user';
  END IF;

  -- Insert a new profile for the new user
  INSERT INTO public.profiles (id, email, full_name, organization_id, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    org_id,
    user_role,
    -- auto-approve admin accounts and satguru users
    (user_role = 'admin' OR NEW.email LIKE '%@satguruengravures.com')
  );
  
  RETURN NEW;
END;
$function$;