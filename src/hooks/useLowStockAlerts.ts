
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LowStockAlert {
  item_code: string;
  item_name: string;
  current_qty: number;
  reorder_level: number;
  stock_status: string;
  category_name: string;
}

export const useLowStockAlerts = () => {
  return useQuery({
    queryKey: ["low-stock-alerts"],
    queryFn: async (): Promise<LowStockAlert[]> => {
      try {
        const { data, error } = await supabase
          .from("satguru_stock_summary_view")
          .select("*")
          .or("stock_status.eq.low_stock,stock_status.eq.out_of_stock,stock_status.eq.ZERO")
          .order("current_qty", { ascending: true })
          .limit(20);

        if (error) {
          console.error("Low stock alerts query error:", error);
          throw error;
        }

        return data || [];
      } catch (error) {
        console.error("Low stock alerts fetch error:", error);
        throw error;
      }
    },
    refetchInterval: 30000,
  });
};
