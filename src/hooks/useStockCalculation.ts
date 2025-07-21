
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StockCalculationResult {
  itemCode: string;
  itemName?: string;
  openingStock: number;
  totalGRNs: number;
  totalIssues: number;
  currentStock: number;
  calculationDetails: {
    openingStockDate: string;
    calculationDate: string;
    grnEntries: number;
    issueEntries: number;
  };
}

export function useStockCalculation(
  itemCodes: string[], 
  openingStockDate: string = '2024-01-01'
) {
  return useQuery({
    queryKey: ['stock-calculation', itemCodes, openingStockDate],
    queryFn: async (): Promise<StockCalculationResult[]> => {
      if (!itemCodes.length) return [];
      
      const results: StockCalculationResult[] = [];
      
      for (const itemCode of itemCodes) {
        // Use the improved backend function for consistent calculation
        const { data, error } = await supabase.rpc('calculate_current_stock', {
          p_item_code: itemCode,
          p_opening_stock_date: openingStockDate
        });

        if (error) {
          console.error('Error calculating stock for', itemCode, ':', error);
          continue;
        }

        if (data) {
          const stockData = data as any;
          results.push({
            itemCode: stockData.item_code || itemCode,
            itemName: stockData.item_name || '',
            openingStock: Number(stockData.opening_stock) || 0,
            totalGRNs: Number(stockData.total_grns) || 0,
            totalIssues: Number(stockData.total_issues) || 0,
            currentStock: Number(stockData.current_stock) || 0,
            calculationDetails: {
              openingStockDate: stockData.opening_stock_date || openingStockDate,
              calculationDate: stockData.calculation_date || new Date().toISOString().split('T')[0],
              grnEntries: Number(stockData.total_grns) || 0,
              issueEntries: Number(stockData.total_issues) || 0
            }
          });
        }
      }

      return results;
    },
    enabled: itemCodes.length > 0,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
  });
}
