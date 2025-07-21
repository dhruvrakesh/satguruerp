
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StockMetrics {
  totalItems: number;
  lowStockItems: number;
  totalStockQty: number;
  recentGrnCount: number;
  recentIssueCount: number;
}

export const useStockMetrics = () => {
  return useQuery({
    queryKey: ["stock-metrics"],
    queryFn: async (): Promise<StockMetrics> => {
      try {
        // Get total items, low stock items, and total stock quantity
        const { data: stockData, error: stockError } = await supabase
          .from("satguru_stock_summary_view")
          .select("current_qty, stock_status");

        if (stockError) {
          console.error("Stock metrics query error:", stockError);
          throw stockError;
        }

        const totalItems = stockData?.length || 0;
        const lowStockItems = stockData?.filter(item => 
          item.stock_status === 'low_stock' || item.stock_status === 'out_of_stock'
        ).length || 0;
        const totalStockQty = stockData?.reduce((sum, item) => sum + (item.current_qty || 0), 0) || 0;

        // Get recent GRN count (last 7 days)
        const { count: recentGrnCount, error: grnError } = await supabase
          .from("satguru_grn_log")
          .select("*", { count: "exact", head: true })
          .gte("date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .not('transaction_type', 'eq', 'OPENING_STOCK');

        if (grnError) {
          console.error("Recent GRN count query error:", grnError);
        }

        // Get recent issue count (last 7 days)
        const { count: recentIssueCount, error: issueError } = await supabase
          .from("satguru_issue_log")
          .select("*", { count: "exact", head: true })
          .gte("date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

        if (issueError) {
          console.error("Recent issue count query error:", issueError);
        }

        return {
          totalItems,
          lowStockItems,
          totalStockQty,
          recentGrnCount: recentGrnCount || 0,
          recentIssueCount: recentIssueCount || 0,
        };
      } catch (error) {
        console.error("Stock metrics calculation error:", error);
        throw error;
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};
