
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OptimizationMetrics {
  currentStock: number;
  averageDemand: number;
  leadTime: number;
  safetyStock: number;
  reorderLevel: number;
  economicOrderQuantity: number;
  stockoutRisk: number;
  carryingCost: number;
}

export interface OptimizationFilters {
  categoryId?: string;
  serviceLevel?: number;
  priority?: string;
}

export interface OptimizationRecommendation {
  itemCode: string;
  itemName: string;
  category: string;
  currentStock: number;
  recommendedStock: number;
  action: 'INCREASE' | 'DECREASE' | 'MAINTAIN';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  potentialSavings: number;
  reasoning: string;
  metrics: OptimizationMetrics;
}

export interface OptimizationSummary {
  totalRecommendations: number;
  potentialSavings: number;
  highPriorityItems: number;
  turnoverImprovement: number;
}

export const useInventoryOptimization = (filters: OptimizationFilters = {}) => {
  const optimizationData = useQuery({
    queryKey: ["inventory-optimization", filters],
    queryFn: async (): Promise<OptimizationRecommendation[]> => {
      // Get stock summary data
      let stockQuery = supabase
        .from("satguru_stock_summary_view")
        .select(`
          item_code,
          item_name,
          category_name,
          current_qty,
          reorder_level,
          stock_status
        `);

      if (filters.categoryId) {
        stockQuery = stockQuery.eq("category_name", filters.categoryId);
      }

      const { data: stockData, error: stockError } = await stockQuery;
      if (stockError) throw stockError;

      // Get recent consumption data from correct table
      const { data: issueData, error: issueError } = await supabase
        .from("satguru_issue_log")
        .select("item_code, qty_issued, date")
        .gte("date", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order("date", { ascending: false });

      if (issueError) throw issueError;

      // Get GRN data for lead time calculation
      const { data: grnData, error: grnError } = await supabase
        .from("satguru_grn_log")
        .select("item_code, qty_received, date")
        .gte("date", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order("date", { ascending: false });

      if (grnError) throw grnError;

      const recommendations: OptimizationRecommendation[] = [];

      stockData?.forEach(stock => {
        // Calculate consumption patterns
        const itemIssues = issueData?.filter(issue => issue.item_code === stock.item_code) || [];
        const itemGrns = grnData?.filter(grn => grn.item_code === stock.item_code) || [];

        // Calculate average daily demand
        const totalConsumption = itemIssues.reduce((sum, issue) => sum + (issue.qty_issued || 0), 0);
        const averageDailyDemand = totalConsumption / 90; // 90 days

        // Calculate lead time (average days between GRNs)
        let leadTime = 30; // Default 30 days
        if (itemGrns.length > 1) {
          const intervals = [];
          for (let i = 1; i < itemGrns.length; i++) {
            const timeDiff = new Date(itemGrns[i-1].date || '').getTime() - new Date(itemGrns[i].date || '').getTime();
            intervals.push(timeDiff / (1000 * 60 * 60 * 24));
          }
          leadTime = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        }

        // Calculate safety stock using service level
        const serviceLevel = filters.serviceLevel || 95;
        const serviceFactor = serviceLevel >= 99 ? 2.33 : serviceLevel >= 95 ? 1.65 : 1.28;
        const demandVariability = Math.sqrt(averageDailyDemand * 0.3); // Assuming 30% coefficient of variation
        const safetyStock = serviceFactor * demandVariability * Math.sqrt(leadTime);

        // Calculate reorder level
        const reorderLevel = (averageDailyDemand * leadTime) + safetyStock;

        // Calculate EOQ (Economic Order Quantity)
        const annualDemand = averageDailyDemand * 365;
        const orderingCost = 500; // Assuming ₹500 per order
        const carryingCostRate = 0.25; // 25% of item value
        const unitCost = 100; // Default unit cost if not available
        const eoq = Math.sqrt((2 * annualDemand * orderingCost) / (carryingCostRate * unitCost));

        // Determine action and priority
        const currentStock = stock.current_qty || 0;
        let action: 'INCREASE' | 'DECREASE' | 'MAINTAIN' = 'MAINTAIN';
        let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        let reasoning = 'Current stock levels are optimal';
        let potentialSavings = 0;

        if (currentStock < reorderLevel * 0.8) {
          action = 'INCREASE';
          priority = currentStock < reorderLevel * 0.5 ? 'HIGH' : 'MEDIUM';
          reasoning = 'Stock below reorder level, risk of stockout';
          potentialSavings = averageDailyDemand * 7 * unitCost; // Cost of 7 days stockout
        } else if (currentStock > reorderLevel * 2) {
          action = 'DECREASE';
          priority = currentStock > reorderLevel * 3 ? 'HIGH' : 'MEDIUM';
          reasoning = 'Excess stock, high carrying costs';
          potentialSavings = (currentStock - reorderLevel) * unitCost * carryingCostRate;
        }

        const metrics: OptimizationMetrics = {
          currentStock,
          averageDemand: averageDailyDemand,
          leadTime,
          safetyStock,
          reorderLevel,
          economicOrderQuantity: eoq,
          stockoutRisk: currentStock < reorderLevel ? 
            ((reorderLevel - currentStock) / reorderLevel) * 100 : 0,
          carryingCost: currentStock * unitCost * carryingCostRate / 365
        };

        if (averageDailyDemand > 0 || currentStock > 0) { // Only include items with activity
          const recommendation: OptimizationRecommendation = {
            itemCode: stock.item_code,
            itemName: stock.item_name || '',
            category: stock.category_name || '',
            currentStock,
            recommendedStock: Math.round(reorderLevel),
            action,
            priority,
            potentialSavings: Math.round(potentialSavings),
            reasoning,
            metrics
          };

          // Apply priority filter if specified
          if (!filters.priority || recommendation.priority.toLowerCase() === filters.priority.toLowerCase()) {
            recommendations.push(recommendation);
          }
        }
      });

      // Sort by priority and potential savings
      return recommendations.sort((a, b) => {
        const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return b.potentialSavings - a.potentialSavings;
      });
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Calculate summary data
  const optimizationSummary = useQuery({
    queryKey: ["inventory-optimization-summary", filters],
    queryFn: async (): Promise<OptimizationSummary> => {
      const recommendations = optimizationData.data || [];
      
      return {
        totalRecommendations: recommendations.length,
        potentialSavings: recommendations.reduce((sum, rec) => sum + rec.potentialSavings, 0),
        highPriorityItems: recommendations.filter(rec => rec.priority === 'HIGH').length,
        turnoverImprovement: Math.round(recommendations.length > 0 ? 
          recommendations.reduce((sum, rec) => sum + (rec.metrics.stockoutRisk > 50 ? 15 : 5), 0) / recommendations.length : 0)
      };
    },
    enabled: optimizationData.isSuccess && !!optimizationData.data,
  });

  return {
    optimizationRecommendations: optimizationData,
    optimizationSummary,
  };
};
