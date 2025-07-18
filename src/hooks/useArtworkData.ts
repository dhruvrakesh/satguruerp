
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useArtworkByUiorn(uiorn: string) {
  return useQuery({
    queryKey: ["artwork-by-uiorn", uiorn],
    queryFn: async () => {
      // First, try to get from order_punching to find the item_code
      const { data: orderData, error: orderError } = await supabase
        .from("order_punching")
        .select("product_description, customer_name")
        .eq("uiorn", uiorn)
        .single();

      if (orderError && orderError.code !== 'PGRST116') {
        console.error("Error fetching order data:", orderError);
      }

      // Then get artwork data from master_data_artworks_se
      const { data: artworkData, error: artworkError } = await supabase
        .from("master_data_artworks_se")
        .select("*")
        .ilike("item_name", `%${orderData?.product_description || ''}%`)
        .limit(1)
        .single();

      if (artworkError && artworkError.code !== 'PGRST116') {
        console.error("Error fetching artwork data:", artworkError);
      }

      // Also try _artworks_revised_staging as fallback
      let fallbackArtwork = null;
      if (!artworkData) {
        const { data: stagingData } = await supabase
          .from("_artworks_revised_staging")
          .select("*")
          .ilike("item_name", `%${orderData?.product_description || ''}%`)
          .limit(1)
          .single();
        fallbackArtwork = stagingData;
      }

      return {
        order: orderData,
        artwork: artworkData || fallbackArtwork,
        customer_name: orderData?.customer_name || artworkData?.customer_name || fallbackArtwork?.customer_name,
        no_of_colours: artworkData?.no_of_colours || fallbackArtwork?.no_of_colours
      };
    },
    enabled: !!uiorn,
  });
}
