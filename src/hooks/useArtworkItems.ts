import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ArtworkItem {
  item_code: string;
  item_name: string;
  customer_name: string;
  no_of_colours: string;
  dimensions: string;
  file_hyperlink: string;
  file_id: string;
  usage_type: string;
  uom: string;
  status: string;
}

// Hook for artwork item selection (for FG items in manufacturing orders)
export const useArtworkItemsForSelection = () => {
  return useQuery({
    queryKey: ["artwork-items-for-selection"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_artwork_items_for_selection');
      if (error) throw error;
      return (data || []) as ArtworkItem[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for exporting artwork catalog
export const useArtworkCatalogExport = () => {
  return useQuery({
    queryKey: ["artwork-catalog-export"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('master_data_artworks_se')
        .select('*')
        .order('item_code');
      
      if (error) throw error;
      return data || [];
    },
    enabled: false, // Only run when manually triggered
  });
};