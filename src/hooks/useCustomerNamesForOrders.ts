
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface OrderCustomerData {
  uiorn: string;
  customer_name: string;
  product_description: string;
  is_resolved: boolean;
}

export function useCustomerNamesForOrders(orders: any[]) {
  return useQuery({
    queryKey: ["customer-names-for-orders", orders.map(o => o.uiorn)],
    queryFn: async () => {
      console.log("🔍 Resolving customer names for orders:", orders.length);
      
      const results: OrderCustomerData[] = [];
      
      for (const order of orders) {
        let resolvedCustomerName = order.customer_name;
        let isResolved = false;
        
        // First priority: Use item_code if available (new architecture)
        if (order.item_code) {
          console.log(`🎯 Using item_code ${order.item_code} for UIORN ${order.uiorn}`);
          
          const { data: itemData } = await supabase
            .from("satguru_item_master")
            .select("customer_name, item_name")
            .eq("item_code", order.item_code)
            .single();

          if (itemData?.customer_name) {
            resolvedCustomerName = itemData.customer_name;
            isResolved = true;
            console.log(`✅ Found customer via item_code for ${order.uiorn}: ${resolvedCustomerName}`);
          }
        }
        // Fallback: Legacy resolution for orders without item_code
        else if (order.customer_name === "Legacy Customer" && order.product_description) {
          console.log(`🎯 Legacy resolution for UIORN ${order.uiorn} with product: ${order.product_description}`);
          
          // Try exact item_name match first
          const { data: exactMatch } = await supabase
            .from("master_data_artworks_se")
            .select("customer_name, item_name")
            .eq("item_name", order.product_description)
            .single();

          if (exactMatch?.customer_name) {
            resolvedCustomerName = exactMatch.customer_name;
            isResolved = true;
            console.log(`✅ Found exact legacy match for ${order.uiorn}: ${resolvedCustomerName}`);
          } else {
            // Try fuzzy matching
            const { data: fuzzyMatches } = await supabase
              .from("master_data_artworks_se")
              .select("customer_name, item_name")
              .ilike("item_name", `%${order.product_description}%`)
              .limit(3);

            if (fuzzyMatches?.length > 0) {
              const bestMatch = fuzzyMatches.find(item => item.customer_name);
              if (bestMatch) {
                resolvedCustomerName = bestMatch.customer_name;
                isResolved = true;
                console.log(`✅ Found fuzzy legacy match for ${order.uiorn}: ${resolvedCustomerName}`);
              }
            }
          }
        }
        
        results.push({
          uiorn: order.uiorn,
          customer_name: resolvedCustomerName,
          product_description: order.product_description,
          is_resolved: isResolved
        });
      }
      
      console.log(`🎯 Resolved ${results.filter(r => r.is_resolved).length}/${results.length} customer names`);
      return results;
    },
    enabled: orders.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
