import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StockDistribution {
  status: string;
  count: number;
  percentage: number;
}

export interface CategoryAnalysis {
  category: string;
  itemCount: number;
  totalQty: number;
}

export const useStockAnalytics = () => {
  const stockDistribution = useQuery({
    queryKey: ["stock-distribution"],
    queryFn: async (): Promise<StockDistribution[]> => {
      const { data, error } = await supabase
        .from("satguru_stock_summary_view")
        .select("stock_status");

      if (error) throw error;

      const statusCounts: { [key: string]: number } = {};
      const total = data?.length || 0;

      data?.forEach(item => {
        const status = item.stock_status || 'Unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      return Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }));
    },
    refetchInterval: 60000,
  });

  const categoryAnalysis = useQuery({
    queryKey: ["category-analysis"],
    queryFn: async (): Promise<CategoryAnalysis[]> => {
      const { data, error } = await supabase
        .from("satguru_stock_summary_view")
        .select("category_name, current_qty");

      if (error) throw error;

      const categoryMap: { [key: string]: { itemCount: number; totalQty: number } } = {};

      data?.forEach(item => {
        const category = item.category_name || 'Uncategorized';
        if (!categoryMap[category]) {
          categoryMap[category] = { itemCount: 0, totalQty: 0 };
        }
        categoryMap[category].itemCount += 1;
        categoryMap[category].totalQty += item.current_qty || 0;
      });

      return Object.entries(categoryMap)
        .map(([category, data]) => ({
          category,
          itemCount: data.itemCount,
          totalQty: data.totalQty,
        }))
        .sort((a, b) => b.totalQty - a.totalQty);
    },
    refetchInterval: 60000,
  });

  return {
    stockDistribution,
    categoryAnalysis,
  };
};