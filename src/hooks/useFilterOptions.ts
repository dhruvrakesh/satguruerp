
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFilterOptions() {
  // Fetch unique usage types from database
  const { data: usageTypesData } = useQuery({
    queryKey: ['usage-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('satguru_item_master')
        .select('usage_type')
        .not('usage_type', 'is', null);
      
      if (error) throw error;
      
      const uniqueTypes = [...new Set(data.map(item => item.usage_type))];
      return uniqueTypes.map(type => ({
        value: type,
        label: type.replace('_', ' ')
      }));
    }
  });

  // Fetch unique UOM values from database
  const { data: uomData } = useQuery({
    queryKey: ['uom-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('satguru_item_master')
        .select('uom')
        .not('uom', 'is', null);
      
      if (error) throw error;
      
      const uniqueUoms = [...new Set(data.map(item => item.uom))];
      return uniqueUoms.map(uom => ({
        value: uom,
        label: uom
      }));
    }
  });

  const statusOptions = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' }
  ];

  return {
    usageTypes: usageTypesData || [],
    uomOptions: uomData || [],
    statusOptions
  };
}
