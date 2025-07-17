import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

export interface TurnoverItem {
  item_code: string;
  item_name: string;
  category_name: string;
  average_stock: number;
  total_issued: number;
  turnover_ratio: number;
  days_of_stock: number;
  classification: 'Fast' | 'Medium' | 'Slow' | 'Dead';
}

export interface TurnoverSummary {
  classification: 'Fast' | 'Medium' | 'Slow' | 'Dead';
  item_count: number;
  percentage: number;
  avg_turnover: number;
}

export const useInventoryTurnover = (days: number = 90) => {
  const turnoverAnalysis = useQuery({
    queryKey: ["turnover-analysis", days],
    queryFn: async (): Promise<TurnoverItem[]> => {
      const endDate = new Date();
      const startDate = subDays(endDate, days);

      // Get current stock levels
      const { data: stockData, error: stockError } = await supabase
        .from("satguru_stock_summary_view")
        .select(`
          item_code,
          item_name,
          category_name,
          current_qty
        `);

      if (stockError) throw stockError;

      // Get issue data for the period
      const { data: issueData, error: issueError } = await supabase
        .from("satguru_issue_log")
        .select("item_code, qty_issued, date")
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      if (issueError) throw issueError;

      // Calculate turnover for each item
      const turnoverMap = new Map<string, {
        total_issued: number;
        issue_count: number;
      }>();

      issueData?.forEach(issue => {
        const existing = turnoverMap.get(issue.item_code) || { total_issued: 0, issue_count: 0 };
        turnoverMap.set(issue.item_code, {
          total_issued: existing.total_issued + (issue.qty_issued || 0),
          issue_count: existing.issue_count + 1
        });
      });

      const turnoverItems: TurnoverItem[] = stockData?.map(item => {
        const turnoverData = turnoverMap.get(item.item_code) || { total_issued: 0, issue_count: 0 };
        const currentStock = item.current_qty || 0;
        const totalIssued = turnoverData.total_issued;
        
        // Calculate average stock (simplified - using current stock as proxy)
        const averageStock = currentStock;
        
        // Calculate turnover ratio (issues per period / average stock)
        const turnoverRatio = averageStock > 0 ? totalIssued / averageStock : 0;
        
        // Calculate days of stock remaining
        const dailyConsumption = totalIssued / days;
        const daysOfStock = dailyConsumption > 0 ? currentStock / dailyConsumption : Infinity;
        
        // Classify based on turnover ratio
        let classification: 'Fast' | 'Medium' | 'Slow' | 'Dead';
        if (turnoverRatio >= 2) {
          classification = 'Fast';
        } else if (turnoverRatio >= 0.5) {
          classification = 'Medium';
        } else if (turnoverRatio > 0) {
          classification = 'Slow';
        } else {
          classification = 'Dead';
        }

        return {
          item_code: item.item_code,
          item_name: item.item_name || '',
          category_name: item.category_name || 'Uncategorized',
          average_stock: averageStock,
          total_issued: totalIssued,
          turnover_ratio: Number(turnoverRatio.toFixed(2)),
          days_of_stock: daysOfStock === Infinity ? 999 : Number(daysOfStock.toFixed(0)),
          classification
        };
      }) || [];

      return turnoverItems.sort((a, b) => b.turnover_ratio - a.turnover_ratio);
    },
    refetchInterval: 300000, // 5 minutes
  });

  const turnoverSummary = useQuery({
    queryKey: ["turnover-summary", turnoverAnalysis.data],
    queryFn: async (): Promise<TurnoverSummary[]> => {
      if (!turnoverAnalysis.data) return [];

      const summary = {
        Fast: { count: 0, total_turnover: 0 },
        Medium: { count: 0, total_turnover: 0 },
        Slow: { count: 0, total_turnover: 0 },
        Dead: { count: 0, total_turnover: 0 }
      };

      turnoverAnalysis.data.forEach(item => {
        summary[item.classification].count++;
        summary[item.classification].total_turnover += item.turnover_ratio;
      });

      const totalItems = turnoverAnalysis.data.length;

      return (['Fast', 'Medium', 'Slow', 'Dead'] as const).map(cls => ({
        classification: cls,
        item_count: summary[cls].count,
        percentage: totalItems > 0 ? (summary[cls].count / totalItems) * 100 : 0,
        avg_turnover: summary[cls].count > 0 ? summary[cls].total_turnover / summary[cls].count : 0
      }));
    },
    enabled: !!turnoverAnalysis.data,
  });

  return {
    turnoverAnalysis,
    turnoverSummary,
  };
};