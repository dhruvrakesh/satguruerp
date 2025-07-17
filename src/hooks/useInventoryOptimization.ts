import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OptimizationData {
  item_code: string;
  item_name: string;
  current_stock: number;
  recommended_reorder_point: number;
  recommended_max_stock: number;
  economic_order_quantity: number;
  total_cost_reduction: number;
  implementation_priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface OptimizationFilters {
  categoryId?: string;
  serviceLevel?: number;
}

export const useInventoryOptimization = (filters: OptimizationFilters) => {
  return useQuery({
    queryKey: ["inventory-optimization", filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("optimize_inventory_levels", {
        p_category_id: filters.categoryId || null,
        p_service_level: filters.serviceLevel || 0.95,
      });

      if (error) {
        console.error("Error fetching inventory optimization data:", error);
        throw error;
      }

      return data as OptimizationData[];
    },
    refetchInterval: 300000, // 5 minutes
  });
};

export const useRefreshAnalytics = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("refresh_analytics_materialized_views");
      
      if (error) {
        console.error("Error refreshing analytics views:", error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all analytics-related queries
      queryClient.invalidateQueries({ queryKey: ["stock-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["consumption-patterns"] });
      queryClient.invalidateQueries({ queryKey: ["ml-forecasting"] });
      queryClient.invalidateQueries({ queryKey: ["advanced-forecasting"] });
      queryClient.invalidateQueries({ queryKey: ["consumption-anomalies"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-optimization"] });
      queryClient.invalidateQueries({ queryKey: ["abc-analysis"] });
      queryClient.invalidateQueries({ queryKey: ["dead-stock-analysis"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-turnover"] });
    },
  });
};