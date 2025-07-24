-- Fix the item code validation function to check the correct table
CREATE OR REPLACE FUNCTION public.satguru_validate_unique_item_code(p_item_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Check if item code exists in satguru_item_master table (not item_master)
  RETURN NOT EXISTS (
    SELECT 1 
    FROM public.satguru_item_master 
    WHERE item_code = p_item_code
  );
END;
$function$;