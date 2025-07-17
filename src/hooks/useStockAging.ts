import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, format } from "date-fns";

export interface StockAgingData {
  item_code: string;
  item_name: string;
  category: string;
  current_qty: number;
  unit_cost: number;
  total_value: number;
  last_transaction_date: string | null;
  days_since_last_transaction: number;
  aging_bracket: '0-30' | '31-60' | '61-90' | '91-180' | '181-365' | '365+';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  valuation_impact: number;
  recommended_action: 'monitor' | 'review' | 'liquidate' | 'writeoff';
  aging_trend: 'improving' | 'stable' | 'deteriorating';
}

export interface AgingSummary {
  total_items: number;
  total_value: number;
  aging_distribution: {
    bracket: string;
    item_count: number;
    total_value: number;
    percentage: number;
  }[];
  risk_summary: {
    low_risk: { items: number; value: number };
    medium_risk: { items: number; value: number };
    high_risk: { items: number; value: number };
    critical_risk: { items: number; value: number };
  };
}

export interface StockAgingFilters {
  category?: string;
  minValue?: number;
  maxValue?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  agingBracket?: string;
}

export const useStockAging = (filters: StockAgingFilters = {}) => {
  return useQuery({
    queryKey: ["stock-aging", filters],
    queryFn: async (): Promise<StockAgingData[]> => {
      // Get current stock with last transaction dates
      let stockQuery = supabase
        .from("stock_summary")
        .select(`
          item_code,
          current_qty,
          item_master!inner(
            item_name,
            unit_cost,
            categories(category_name)
          )
        `)
        .gt("current_qty", 0);

      if (filters.category) {
        stockQuery = stockQuery.eq("item_master.categories.category_name", filters.category);
      }

      const { data: stockData, error: stockError } = await stockQuery;
      if (stockError) throw stockError;

      // Get last transaction dates for each item
      const itemCodes = stockData?.map(item => item.item_code) || [];
      
      // Get last GRN dates
      const { data: lastGrnData } = await supabase
        .from("grn_log")
        .select("item_code, grn_date")
        .in("item_code", itemCodes)
        .order("grn_date", { ascending: false });

      // Get last issue dates
      const { data: lastIssueData } = await supabase
        .from("issue_log")
        .select("item_code, issue_date")
        .in("item_code", itemCodes)
        .order("issue_date", { ascending: false });

      // Create maps for last transaction dates
      const lastGrnMap = new Map<string, string>();
      const lastIssueMap = new Map<string, string>();

      lastGrnData?.forEach(grn => {
        if (!lastGrnMap.has(grn.item_code)) {
          lastGrnMap.set(grn.item_code, grn.grn_date);
        }
      });

      lastIssueData?.forEach(issue => {
        if (!lastIssueMap.has(issue.item_code)) {
          lastIssueMap.set(issue.item_code, issue.issue_date);
        }
      });

      const today = new Date();

      const results: StockAgingData[] = stockData?.map((stock: any) => {
        const unitCost = stock.item_master?.unit_cost || 0;
        const totalValue = stock.current_qty * unitCost;

        // Find the most recent transaction date
        const lastGrn = lastGrnMap.get(stock.item_code);
        const lastIssue = lastIssueMap.get(stock.item_code);
        
        let lastTransactionDate: string | null = null;
        if (lastGrn && lastIssue) {
          lastTransactionDate = lastGrn > lastIssue ? lastGrn : lastIssue;
        } else if (lastGrn) {
          lastTransactionDate = lastGrn;
        } else if (lastIssue) {
          lastTransactionDate = lastIssue;
        }

        const daysSinceLastTransaction = lastTransactionDate 
          ? differenceInDays(today, new Date(lastTransactionDate))
          : 365; // Assume very old if no transaction found

        // Determine aging bracket
        let agingBracket: '0-30' | '31-60' | '61-90' | '91-180' | '181-365' | '365+';
        if (daysSinceLastTransaction <= 30) agingBracket = '0-30';
        else if (daysSinceLastTransaction <= 60) agingBracket = '31-60';
        else if (daysSinceLastTransaction <= 90) agingBracket = '61-90';
        else if (daysSinceLastTransaction <= 180) agingBracket = '91-180';
        else if (daysSinceLastTransaction <= 365) agingBracket = '181-365';
        else agingBracket = '365+';

        // Determine risk level
        let riskLevel: 'low' | 'medium' | 'high' | 'critical';
        if (daysSinceLastTransaction <= 60) riskLevel = 'low';
        else if (daysSinceLastTransaction <= 120) riskLevel = 'medium';
        else if (daysSinceLastTransaction <= 365) riskLevel = 'high';
        else riskLevel = 'critical';

        // Calculate valuation impact (potential loss due to aging)
        let valuationImpact = 0;
        if (riskLevel === 'medium') valuationImpact = totalValue * 0.1;
        else if (riskLevel === 'high') valuationImpact = totalValue * 0.25;
        else if (riskLevel === 'critical') valuationImpact = totalValue * 0.5;

        // Determine recommended action
        let recommendedAction: 'monitor' | 'review' | 'liquidate' | 'writeoff';
        if (riskLevel === 'low') recommendedAction = 'monitor';
        else if (riskLevel === 'medium') recommendedAction = 'review';
        else if (riskLevel === 'high') recommendedAction = 'liquidate';
        else recommendedAction = 'writeoff';

        // Simplified aging trend (would need historical data for real calculation)
        const agingTrend: 'improving' | 'stable' | 'deteriorating' = 
          daysSinceLastTransaction > 180 ? 'deteriorating' : 
          daysSinceLastTransaction > 60 ? 'stable' : 'improving';

        return {
          item_code: stock.item_code,
          item_name: stock.item_master?.item_name || '',
          category: stock.item_master?.categories?.category_name || 'Uncategorized',
          current_qty: stock.current_qty,
          unit_cost: unitCost,
          total_value: totalValue,
          last_transaction_date: lastTransactionDate,
          days_since_last_transaction: daysSinceLastTransaction,
          aging_bracket: agingBracket,
          risk_level: riskLevel,
          valuation_impact: Math.round(valuationImpact * 100) / 100,
          recommended_action: recommendedAction,
          aging_trend: agingTrend
        };
      }).filter((item: StockAgingData) => {
        if (filters.minValue && item.total_value < filters.minValue) return false;
        if (filters.maxValue && item.total_value > filters.maxValue) return false;
        if (filters.riskLevel && item.risk_level !== filters.riskLevel) return false;
        if (filters.agingBracket && item.aging_bracket !== filters.agingBracket) return false;
        return true;
      }) || [];

      return results.sort((a, b) => b.days_since_last_transaction - a.days_since_last_transaction);
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });
};

export const useStockAgingSummary = (filters: StockAgingFilters = {}) => {
  const { data: agingData } = useStockAging(filters);

  return useQuery({
    queryKey: ["stock-aging-summary", agingData],
    queryFn: (): AgingSummary => {
      if (!agingData) {
        return {
          total_items: 0,
          total_value: 0,
          aging_distribution: [],
          risk_summary: {
            low_risk: { items: 0, value: 0 },
            medium_risk: { items: 0, value: 0 },
            high_risk: { items: 0, value: 0 },
            critical_risk: { items: 0, value: 0 }
          }
        };
      }

      const totalItems = agingData.length;
      const totalValue = agingData.reduce((sum, item) => sum + item.total_value, 0);

      // Calculate aging distribution
      const agingBrackets = ['0-30', '31-60', '61-90', '91-180', '181-365', '365+'];
      const agingDistribution = agingBrackets.map(bracket => {
        const items = agingData.filter(item => item.aging_bracket === bracket);
        const value = items.reduce((sum, item) => sum + item.total_value, 0);
        return {
          bracket,
          item_count: items.length,
          total_value: value,
          percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
        };
      });

      // Calculate risk summary
      const riskSummary = {
        low_risk: {
          items: agingData.filter(item => item.risk_level === 'low').length,
          value: agingData.filter(item => item.risk_level === 'low').reduce((sum, item) => sum + item.total_value, 0)
        },
        medium_risk: {
          items: agingData.filter(item => item.risk_level === 'medium').length,
          value: agingData.filter(item => item.risk_level === 'medium').reduce((sum, item) => sum + item.total_value, 0)
        },
        high_risk: {
          items: agingData.filter(item => item.risk_level === 'high').length,
          value: agingData.filter(item => item.risk_level === 'high').reduce((sum, item) => sum + item.total_value, 0)
        },
        critical_risk: {
          items: agingData.filter(item => item.risk_level === 'critical').length,
          value: agingData.filter(item => item.risk_level === 'critical').reduce((sum, item) => sum + item.total_value, 0)
        }
      };

      return {
        total_items: totalItems,
        total_value: totalValue,
        aging_distribution: agingDistribution,
        risk_summary: riskSummary
      };
    },
    enabled: !!agingData
  });
};