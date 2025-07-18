
-- Create the missing get_active_items_for_selection function
CREATE OR REPLACE FUNCTION public.get_active_items_for_selection()
RETURNS TABLE (
  item_code text,
  item_name text,
  uom text,
  status text,
  usage_type text
) 
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT 
    sim.item_code,
    sim.item_name,
    sim.uom,
    sim.status,
    sim.usage_type
  FROM public.satguru_item_master sim
  WHERE sim.status = 'active'
  ORDER BY sim.item_name;
$$;
