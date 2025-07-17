import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DeadStockItem {
  item_code: string;
  item_name: string;
  category_name: string;
  current_qty: number;
  last_movement_date?: string;
  days_since_movement: number;
  estimated_value: number;
  stock_status: string;
  recommended_action: 'DISPOSE' | 'LIQUIDATE' | 'REVIEW' | 'MONITOR';
}

export interface DeadStockSummary {
  totalDeadStockItems: number;
  totalDeadStockValue: number;
  averageDaysNoMovement: number;
  itemsToDispose: number;
  itemsToLiquidate: number;
  itemsToReview: number;
}

export interface DeadStockFilters {
  minDaysNoMovement?: number;
  maxDaysNoMovement?: number;
  category?: string;
  minValue?: number;
  maxValue?: number;
}

export const useDeadStockAnalysis = (filters: DeadStockFilters = {}) => {
  const { minDaysNoMovement = 90 } = filters;

  const deadStockAnalysis = useQuery({
    queryKey: ["dead-stock-analysis", filters],
    queryFn: async (): Promise<DeadStockItem[]> => {
      // Get all stock items
      let stockQuery = supabase
        .from("satguru_stock_summary_view")
        .select(`
          item_code,
          item_name,
          category_name,
          current_qty,
          stock_status
        `);

      if (filters.category) {
        stockQuery = stockQuery.eq("category_name", filters.category);
      }

      const { data: stockData, error: stockError } = await stockQuery;
      if (stockError) throw stockError;

      // Get recent transactions to find last movement dates
      const { data: grnData, error: grnError } = await supabase
        .from("satguru_grn_log")
        .select("item_code, date, amount_inr, qty_received")
        .order("date", { ascending: false });

      if (grnError) throw grnError;

      const { data: issueData, error: issueError } = await supabase
        .from("satguru_issue_log")
        .select("item_code, date, qty_issued")
        .order("date", { ascending: false });

      if (issueError) throw issueError;

      const deadStockItems: DeadStockItem[] = [];

      stockData?.forEach(stock => {
        // Find last GRN and issue dates
        const lastGrn = grnData?.find(grn => grn.item_code === stock.item_code);
        const lastIssue = issueData?.find(issue => issue.item_code === stock.item_code);

        // Determine last movement date
        const lastGrnDate = lastGrn?.date ? new Date(lastGrn.date) : null;
        const lastIssueDate = lastIssue?.date ? new Date(lastIssue.date) : null;

        let lastMovementDate: Date | null = null;
        if (lastGrnDate && lastIssueDate) {
          lastMovementDate = lastGrnDate > lastIssueDate ? lastGrnDate : lastIssueDate;
        } else if (lastGrnDate) {
          lastMovementDate = lastGrnDate;
        } else if (lastIssueDate) {
          lastMovementDate = lastIssueDate;
        }

        const daysSinceMovement = lastMovementDate 
          ? Math.floor((new Date().getTime() - lastMovementDate.getTime()) / (1000 * 60 * 60 * 24))
          : 999; // If no movement data, assume very old

        // Filter by movement threshold
        if (daysSinceMovement < minDaysNoMovement) return;
        if (filters.maxDaysNoMovement && daysSinceMovement > filters.maxDaysNoMovement) return;

        // Estimate value (use last GRN price or default)
        const estimatedUnitPrice = lastGrn ? (lastGrn.amount_inr || 0) / (lastGrn.qty_received || 1) : 0;
        const estimatedValue = estimatedUnitPrice * (stock.current_qty || 0);

        // Apply value filters
        if (filters.minValue && estimatedValue < filters.minValue) return;
        if (filters.maxValue && estimatedValue > filters.maxValue) return;

        // Determine recommended action
        let recommendedAction: DeadStockItem['recommended_action'] = 'MONITOR';
        if (daysSinceMovement > 365) {
          recommendedAction = 'DISPOSE';
        } else if (daysSinceMovement > 180) {
          recommendedAction = 'LIQUIDATE';
        } else if (daysSinceMovement > 120) {
          recommendedAction = 'REVIEW';
        }

        deadStockItems.push({
          item_code: stock.item_code,
          item_name: stock.item_name || '',
          category_name: stock.category_name || '',
          current_qty: stock.current_qty || 0,
          last_movement_date: lastMovementDate?.toISOString().split('T')[0],
          days_since_movement: daysSinceMovement,
          estimated_value: estimatedValue,
          stock_status: stock.stock_status || '',
          recommended_action: recommendedAction
        });
      });

      return deadStockItems.sort((a, b) => b.days_since_movement - a.days_since_movement);
    },
    refetchInterval: 600000, // Refresh every 10 minutes
  });

  const deadStockSummary = useQuery({
    queryKey: ["dead-stock-summary", filters],
    queryFn: async (): Promise<DeadStockSummary> => {
      const deadStockItems = deadStockAnalysis.data || [];
      
      const totalDeadStockItems = deadStockItems.length;
      const totalDeadStockValue = deadStockItems.reduce((sum, item) => sum + item.estimated_value, 0);
      const averageDaysNoMovement = totalDeadStockItems > 0 
        ? deadStockItems.reduce((sum, item) => sum + item.days_since_movement, 0) / totalDeadStockItems 
        : 0;

      const itemsToDispose = deadStockItems.filter(item => item.recommended_action === 'DISPOSE').length;
      const itemsToLiquidate = deadStockItems.filter(item => item.recommended_action === 'LIQUIDATE').length;
      const itemsToReview = deadStockItems.filter(item => item.recommended_action === 'REVIEW').length;

      return {
        totalDeadStockItems,
        totalDeadStockValue,
        averageDaysNoMovement: Math.round(averageDaysNoMovement),
        itemsToDispose,
        itemsToLiquidate,
        itemsToReview
      };
    },
    enabled: !!deadStockAnalysis.data,
  });

  return {
    deadStockAnalysis,
    deadStockSummary,
  };
};