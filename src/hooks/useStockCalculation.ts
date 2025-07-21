
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
        try {
          // Use the improved backend function for consistent calculation
          // This function processes ALL records without any limits
          const { data, error } = await supabase.rpc('calculate_current_stock', {
            p_item_code: itemCode,
            p_opening_stock_date: openingStockDate
          });

          if (error) {
            console.error('Error calculating stock for', itemCode, ':', error);
            // Add a default entry for failed calculations to maintain data flow
            results.push({
              itemCode: itemCode,
              itemName: '',
              openingStock: 0,
              totalGRNs: 0,
              totalIssues: 0,
              currentStock: 0,
              calculationDetails: {
                openingStockDate: openingStockDate,
                calculationDate: new Date().toISOString().split('T')[0],
                grnEntries: 0,
                issueEntries: 0
              }
            });
            continue;
          }

          if (data && typeof data === 'object') {
            const stockData = data as any;
            // Ensure we always have valid numeric values
            const openingStock = Number(stockData.opening_stock) || 0;
            const totalGRNs = Number(stockData.total_grns) || 0;
            const totalIssues = Number(stockData.total_issues) || 0;
            const currentStock = Number(stockData.current_stock) || 0;
            
            results.push({
              itemCode: stockData.item_code || itemCode,
              itemName: stockData.item_name || '',
              openingStock,
              totalGRNs,
              totalIssues,
              currentStock,
              calculationDetails: {
                openingStockDate: stockData.opening_stock_date || openingStockDate,
                calculationDate: stockData.calculation_date || new Date().toISOString().split('T')[0],
                grnEntries: totalGRNs,
                issueEntries: totalIssues
              }
            });
            
            console.log(`✅ Stock calculation for ${itemCode}: Opening=${openingStock}, GRNs=${totalGRNs}, Issues=${totalIssues}, Current=${currentStock}`);
          } else {
            console.warn('No data returned for stock calculation of', itemCode);
            // Add default entry for null/undefined data
            results.push({
              itemCode: itemCode,
              itemName: '',
              openingStock: 0,
              totalGRNs: 0,
              totalIssues: 0,
              currentStock: 0,
              calculationDetails: {
                openingStockDate: openingStockDate,
                calculationDate: new Date().toISOString().split('T')[0],
                grnEntries: 0,
                issueEntries: 0
              }
            });
          }
        } catch (error) {
          console.error('Exception calculating stock for', itemCode, ':', error);
          // Add default entry for exceptions
          results.push({
            itemCode: itemCode,
            itemName: '',
            openingStock: 0,
            totalGRNs: 0,
            totalIssues: 0,
            currentStock: 0,
            calculationDetails: {
              openingStockDate: openingStockDate,
              calculationDate: new Date().toISOString().split('T')[0],
              grnEntries: 0,
              issueEntries: 0
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
