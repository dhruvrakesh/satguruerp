
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RawMaterial {
  item_code: string;
  item_name: string;
  uom: string;
  category_name?: string;
  size?: string;
  gsm?: string;
  display_name: string;
}

export const useRawMaterials = () => {
  return useQuery({
    queryKey: ["raw-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('satguru_item_master')
        .select(`
          item_code,
          item_name,
          uom,
          category_name,
          size,
          gsm
        `)
        .eq('usage_type', 'RAW_MATERIAL')
        .eq('status', 'ACTIVE')
        .order('item_name');

      if (error) throw error;

      // Format the data for dropdown display
      const formattedData: RawMaterial[] = (data || []).map(item => ({
        item_code: item.item_code,
        item_name: item.item_name,
        uom: item.uom,
        category_name: item.category_name,
        size: item.size,
        gsm: item.gsm,
        display_name: `${item.item_code} - ${item.item_name}${item.size ? ` (${item.size})` : ''}${item.gsm ? ` ${item.gsm}GSM` : ''}`
      }));

      return formattedData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
