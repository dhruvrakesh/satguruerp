import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MovementClassification {
  item_code: string;
  item_name: string;
  category_name: string;
  current_qty: number;
  total_issues_30d: number;
  total_receipts_30d: number;
  movement_frequency: number;
  movement_velocity: number;
  classification: 'FAST_MOVING' | 'MEDIUM_MOVING' | 'SLOW_MOVING' | 'DEAD_STOCK';
  avg_monthly_consumption: number;
  turnover_ratio: number;
  last_movement_date: string | null;
  movement_trend: 'INCREASING' | 'STABLE' | 'DECREASING' | 'NO_DATA';
  reorder_recommendation: 'INCREASE_STOCK' | 'MAINTAIN_STOCK' | 'REDUCE_STOCK' | 'DISCONTINUE';
}

export interface MovementFilters {
  classification?: 'FAST_MOVING' | 'MEDIUM_MOVING' | 'SLOW_MOVING' | 'DEAD_STOCK';
  category?: string;
  minTurnover?: number;
  maxTurnover?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface MovementSummary {
  totalItems: number;
  fastMovingItems: number;
  mediumMovingItems: number;
  slowMovingItems: number;
  deadStockItems: number;
  avgTurnoverRatio: number;
  totalMovementValue: number;
}

export const useMovementClassification = (filters: MovementFilters = {}) => {
  const movementQuery = useQuery({
    queryKey: ["movement-classification", filters],
    queryFn: async (): Promise<MovementClassification[]> => {
      console.log("Fetching movement classification with filters:", filters);
      
      // Get stock summary data
      let stockQuery = supabase
        .from("satguru_stock_summary_view")
        .select(`
          item_code,
          item_name,
          category_name,
          current_qty,
          consumption_30_days,
          received_30_days,
          stock_status,
          last_updated
        `);

      if (filters.category) {
        stockQuery = stockQuery.eq('category_name', filters.category);
      }

      const { data: stockData, error: stockError } = await stockQuery;

      if (stockError) {
        console.error("Error fetching stock data:", stockError);
        throw stockError;
      }

      // Get recent movement data for trend analysis
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: grnData } = await supabase
        .from("grn_log")
        .select("item_code, qty_received, grn_date")
        .gte('grn_date', thirtyDaysAgo.toISOString().split('T')[0]);

      const { data: issueData } = await supabase
        .from("issue_log")
        .select("item_code, qty_issued, issue_date")
        .gte('issue_date', thirtyDaysAgo.toISOString().split('T')[0]);

      // Process data and calculate classifications
      const enhancedData = (stockData || []).map(item => {
        const totalIssues30d = item.consumption_30_days || 0;
        const totalReceipts30d = item.received_30_days || 0;
        const currentQty = item.current_qty || 0;
        
        // Calculate movement metrics
        const avgMonthlyConsumption = totalIssues30d;
        const movementFrequency = totalIssues30d + totalReceipts30d;
        const movementVelocity = currentQty > 0 ? totalIssues30d / currentQty : 0;
        const turnoverRatio = currentQty > 0 ? (totalIssues30d * 12) / currentQty : 0;
        
        // Determine classification based on movement velocity and frequency
        let classification: 'FAST_MOVING' | 'MEDIUM_MOVING' | 'SLOW_MOVING' | 'DEAD_STOCK' = 'DEAD_STOCK';
        if (movementVelocity >= 2) classification = 'FAST_MOVING';
        else if (movementVelocity >= 0.5) classification = 'MEDIUM_MOVING';
        else if (movementVelocity > 0) classification = 'SLOW_MOVING';
        
        // Determine movement trend (simplified)
        let movementTrend: 'INCREASING' | 'STABLE' | 'DECREASING' | 'NO_DATA' = 'NO_DATA';
        if (totalIssues30d > 0) {
          if (totalIssues30d > totalReceipts30d) movementTrend = 'DECREASING';
          else if (totalIssues30d < totalReceipts30d) movementTrend = 'INCREASING';
          else movementTrend = 'STABLE';
        }
        
        // Determine reorder recommendation
        let reorderRecommendation: 'INCREASE_STOCK' | 'MAINTAIN_STOCK' | 'REDUCE_STOCK' | 'DISCONTINUE' = 'DISCONTINUE';
        if (classification === 'FAST_MOVING') {
          reorderRecommendation = movementTrend === 'INCREASING' ? 'INCREASE_STOCK' : 'MAINTAIN_STOCK';
        } else if (classification === 'MEDIUM_MOVING') {
          reorderRecommendation = 'MAINTAIN_STOCK';
        } else if (classification === 'SLOW_MOVING') {
          reorderRecommendation = 'REDUCE_STOCK';
        }

        return {
          item_code: item.item_code,
          item_name: item.item_name || '',
          category_name: item.category_name || 'Uncategorized',
          current_qty: currentQty,
          total_issues_30d: totalIssues30d,
          total_receipts_30d: totalReceipts30d,
          movement_frequency: movementFrequency,
          movement_velocity: Math.round(movementVelocity * 100) / 100,
          classification,
          avg_monthly_consumption: avgMonthlyConsumption,
          turnover_ratio: Math.round(turnoverRatio * 100) / 100,
          last_movement_date: item.last_updated,
          movement_trend: movementTrend,
          reorder_recommendation: reorderRecommendation
        };
      });

      // Apply filters
      let filteredData = enhancedData;
      
      if (filters.classification) {
        filteredData = filteredData.filter(item => item.classification === filters.classification);
      }
      
      if (filters.minTurnover !== undefined) {
        filteredData = filteredData.filter(item => item.turnover_ratio >= filters.minTurnover);
      }
      
      if (filters.maxTurnover !== undefined) {
        filteredData = filteredData.filter(item => item.turnover_ratio <= filters.maxTurnover);
      }

      return filteredData.sort((a, b) => b.movement_velocity - a.movement_velocity);
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    refetchInterval: 30 * 60 * 1000, // 30 minutes
  });

  const summaryQuery = useQuery({
    queryKey: ["movement-summary", filters],
    queryFn: async (): Promise<MovementSummary> => {
      const items = movementQuery.data || [];
      
      const totalItems = items.length;
      const fastMovingItems = items.filter(item => item.classification === 'FAST_MOVING').length;
      const mediumMovingItems = items.filter(item => item.classification === 'MEDIUM_MOVING').length;
      const slowMovingItems = items.filter(item => item.classification === 'SLOW_MOVING').length;
      const deadStockItems = items.filter(item => item.classification === 'DEAD_STOCK').length;
      
      const avgTurnoverRatio = items.length > 0
        ? items.reduce((sum, item) => sum + item.turnover_ratio, 0) / items.length
        : 0;
      
      const totalMovementValue = items.reduce((sum, item) => {
        // Estimate value using consumption * ₹100 average cost
        return sum + (item.total_issues_30d * 100);
      }, 0);

      return {
        totalItems,
        fastMovingItems,
        mediumMovingItems,
        slowMovingItems,
        deadStockItems,
        avgTurnoverRatio: Math.round(avgTurnoverRatio * 100) / 100,
        totalMovementValue
      };
    },
    enabled: !!movementQuery.data,
    staleTime: 15 * 60 * 1000,
  });

  return {
    movementClassification: movementQuery,
    movementSummary: summaryQuery,
  };
};