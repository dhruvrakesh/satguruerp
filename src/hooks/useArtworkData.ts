
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useArtworkByUiorn(uiorn: string) {
  return useQuery({
    queryKey: ["artwork-by-uiorn", uiorn],
    queryFn: async () => {
      console.log("Fetching artwork data for UIORN:", uiorn);
      
      // First, get order data from order_punching
      const { data: orderData, error: orderError } = await supabase
        .from("order_punching")
        .select("product_description, customer_name")
        .eq("uiorn", uiorn)
        .single();

      if (orderError && orderError.code !== 'PGRST116') {
        console.error("Error fetching order data:", orderError);
      }

      console.log("Order data:", orderData);

      let artworkData = null;
      let customerName = orderData?.customer_name || null;

      if (orderData?.product_description) {
        // Try exact item_code match first
        const { data: exactMatch } = await supabase
          .from("master_data_artworks_se")
          .select("*")
          .eq("item_code", orderData.product_description)
          .single();

        if (exactMatch) {
          artworkData = exactMatch;
          customerName = exactMatch.customer_name || customerName;
          console.log("Found exact item_code match:", exactMatch);
        } else {
          // Try item_name similarity match
          const { data: similarItems } = await supabase
            .from("master_data_artworks_se")
            .select("*")
            .ilike("item_name", `%${orderData.product_description}%`)
            .limit(5);

          if (similarItems && similarItems.length > 0) {
            // Pick the best match (first one for now, could implement better scoring)
            artworkData = similarItems[0];
            customerName = artworkData.customer_name || customerName;
            console.log("Found similar item_name match:", artworkData);
          } else {
            // Try reverse match - product description contains item_name
            const { data: reverseMatches } = await supabase
              .from("master_data_artworks_se")
              .select("*")
              .not("item_name", "is", null)
              .limit(20);

            if (reverseMatches) {
              const bestMatch = reverseMatches.find(item => 
                item.item_name && orderData.product_description.toLowerCase().includes(item.item_name.toLowerCase())
              );
              
              if (bestMatch) {
                artworkData = bestMatch;
                customerName = bestMatch.customer_name || customerName;
                console.log("Found reverse match:", bestMatch);
              }
            }
          }
        }
      }

      // If still no artwork found, try fallback staging table
      if (!artworkData && orderData?.product_description) {
        const { data: stagingData } = await supabase
          .from("_artworks_revised_staging")
          .select("*")
          .or(`item_code.eq.${orderData.product_description},item_name.ilike.%${orderData.product_description}%`)
          .limit(1)
          .single();
        
        if (stagingData) {
          artworkData = stagingData;
          customerName = stagingData.customer_name || customerName;
          console.log("Found staging data match:", stagingData);
        }
      }

      const result = {
        order: orderData,
        artwork: artworkData,
        customer_name: customerName,
        no_of_colours: artworkData?.no_of_colours || "4COL", // default fallback
        item_code: artworkData?.item_code || orderData?.product_description
      };

      console.log("Final result:", result);
      return result;
    },
    enabled: !!uiorn,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}
