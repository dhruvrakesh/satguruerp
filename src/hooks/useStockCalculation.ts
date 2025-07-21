
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
      
      console.log(`🔍 Fetching stock data from single source of truth for ${itemCodes.length} items`);
      
      // Use single source of truth: satguru_stock_summary_view
      const { data, error } = await supabase
        .from('satguru_stock_summary_view')
        .select('*')
        .in('item_code', itemCodes);

      if (error) {
        console.error('❌ Error fetching stock data:', error);
        throw error;
      }

      const results: StockCalculationResult[] = itemCodes.map(itemCode => {
        const stockData = data?.find(item => item.item_code === itemCode);
        
        if (!stockData) {
          console.warn(`⚠️ No stock data found for ${itemCode}`);
          return {
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
          };
        }

        const openingStock = Number(stockData.opening_stock) || 0;
        const totalGRNs = Number(stockData.total_grns) || 0;
        const totalIssues = Number(stockData.total_issues) || 0;
        const currentStock = Number(stockData.current_qty) || 0;
        
        console.log(`✅ Stock data for ${itemCode}: Opening=${openingStock}, GRNs=${totalGRNs}, Issues=${totalIssues}, Current=${currentStock}`);
        
        return {
          itemCode: stockData.item_code,
          itemName: stockData.item_name || '',
          openingStock,
          totalGRNs,
          totalIssues,
          currentStock,
          calculationDetails: {
            openingStockDate: openingStockDate,
            calculationDate: new Date().toISOString().split('T')[0],
            grnEntries: totalGRNs,
            issueEntries: totalIssues
          }
        };
      });

      return results;
    },
    enabled: itemCodes.length > 0,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
  });
}
