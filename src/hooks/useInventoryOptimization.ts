
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

export interface OptimizationRecommendation {
  id: string;
  itemCode: string;
  description: string;
  action: string;
  priority: string;
  category: string;
  currentStock: number;
  recommendedStock: number;
  impactValue: number;
}

export interface OptimizationSummary {
  totalRecommendations: number;
  potentialSavings: number;
  highPriorityItems: number;
  turnoverImprovement: number;
}

export const useInventoryOptimization = (filters: OptimizationFilters) => {
  const optimizationRecommendations = useQuery({
    queryKey: ["optimization-recommendations", filters],
    queryFn: async (): Promise<OptimizationRecommendation[]> => {
      // Mock data for now
      return [
        {
          id: "1",
          itemCode: "RM001",
          description: "Reduce stock level for slow-moving item",
          action: "decrease",
          priority: "high",
          category: "raw_materials",
          currentStock: 1000,
          recommendedStock: 500,
          impactValue: 25000
        },
        {
          id: "2",
          itemCode: "FG002",
          description: "Increase reorder point for fast-moving item",
          action: "increase",
          priority: "medium",
          category: "finished_goods",
          currentStock: 100,
          recommendedStock: 250,
          impactValue: 15000
        }
      ];
    },
    refetchInterval: 300000, // 5 minutes
  });

  const optimizationSummary = useQuery({
    queryKey: ["optimization-summary", filters],
    queryFn: async (): Promise<OptimizationSummary> => {
      return {
        totalRecommendations: 25,
        potentialSavings: 150000,
        highPriorityItems: 8,
        turnoverImprovement: 15
      };
    },
    enabled: !!optimizationRecommendations.data,
    staleTime: 15 * 60 * 1000,
  });

  return {
    optimizationRecommendations,
    optimizationSummary
  };
};

export const useRefreshAnalytics = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("refresh_analytics_materialized_views" as any);
      
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
