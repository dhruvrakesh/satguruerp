
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
          category_id,
          size_mm,
          gsm,
          qualifier
        `)
        .eq('usage_type', 'RAW_MATERIAL')
        .eq('status', 'active')
        .order('item_name');

      if (error) throw error;

      // Format the data for dropdown display without relying on category names
      const formattedData: RawMaterial[] = (data || []).map(item => {
        // Extract material type from item_code prefix
        const materialType = item.item_code.split('_')[0] || 'Unknown';
        const typeMap: { [key: string]: string } = {
          'ADH': 'Adhesive',
          'BOPP': 'BOPP Film',
          'PET': 'PET Film',
          'SOL': 'Solvent',
          'INK': 'Ink',
          'LAC': 'Lacquer',
          'REL': 'Release',
          'WAX': 'Wax'
        };
        
        const displayType = typeMap[materialType] || materialType;
        
        return {
          item_code: item.item_code,
          item_name: item.item_name,
          uom: item.uom,
          category_name: displayType, // Use extracted type instead of actual category
          size: item.size_mm,
          gsm: item.gsm ? item.gsm.toString() : undefined,
          display_name: `${item.item_code} - ${item.item_name}${item.size_mm ? ` (${item.size_mm})` : ''}${item.gsm ? ` ${item.gsm}GSM` : ''}${item.qualifier ? ` - ${item.qualifier}` : ''}`
        };
      });

      return formattedData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
