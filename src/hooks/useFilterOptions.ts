import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFilterOptions() {
  // Get actual usage types from the database
  const { data: usageTypes } = useQuery({
    queryKey: ['filter-usage-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('satguru_item_master')
        .select('usage_type')
        .not('usage_type', 'is', null);
      
      if (error) throw error;
      
      // Get unique usage types
      const uniqueTypes = [...new Set(data.map(item => item.usage_type))];
      return uniqueTypes.map(type => ({
        value: type,
        label: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      }));
    },
  });

  // Get actual UOMs from the database
  const { data: uomOptions } = useQuery({
    queryKey: ['filter-uom-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('satguru_item_master')
        .select('uom')
        .not('uom', 'is', null);
      
      if (error) throw error;
      
      // Get unique UOMs
      const uniqueUoms = [...new Set(data.map(item => item.uom))];
      return uniqueUoms.map(uom => ({
        value: uom,
        label: uom
      }));
    },
  });

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  return {
    usageTypes: usageTypes || [],
    uomOptions: uomOptions || [],
    statusOptions
  };
}