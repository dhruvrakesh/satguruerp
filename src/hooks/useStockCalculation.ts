
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
    legacyBaseline?: number;
    operationalMovement?: number;
    dataQuality?: string;
  };
}

export function useStockCalculation(
  itemCodes: string[], 
  openingStockDate: string = '2025-03-31' // Default to FY 2024-25 end
) {
  return useQuery({
    queryKey: ['stock-calculation', itemCodes, openingStockDate],
    queryFn: async (): Promise<StockCalculationResult[]> => {
      if (!itemCodes.length) return [];
      
      console.log(`🔍 Fetching financial year stock data for ${itemCodes.length} items (Opening Stock Date: ${openingStockDate})`);
      
      // Use single source of truth: satguru_stock_summary_view with legacy cutoff awareness
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

        // Extract financial year aware stock data with proper type casting
        const stockRecord = stockData as any;
        const openingStock = Number(stockData.opening_stock) || 0;
        const legacyGrns = Number(stockRecord.legacy_grns) || 0;
        const legacyIssues = Number(stockRecord.legacy_issues) || 0;
        const operationalGrns = Number(stockRecord.operational_grns) || 0;
        const operationalIssues = Number(stockRecord.operational_issues) || 0;
        
        // Total GRNs and Issues (legacy + operational) - using new view structure
        const totalGRNs = Number(stockData.total_grns) || 0;
        const totalIssues = Number(stockData.total_issues) || 0;
        const currentStock = Number(stockData.current_qty) || 0;
        
        // Legacy baseline calculation for transparency
        const legacyBaseline = openingStock + legacyGrns - legacyIssues;
        
        console.log(`✅ FY Stock data for ${itemCode}:`, {
          opening: openingStock,
          legacyGrns,
          legacyIssues,
          legacyBaseline,
          operationalGrns,
          operationalIssues,
          totalGrns: totalGRNs,
          totalIssues,
          current: currentStock,
          dataQuality: stockRecord.data_quality
        });
        
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
            issueEntries: totalIssues,
            legacyBaseline,
            operationalMovement: operationalGrns - operationalIssues,
            dataQuality: stockRecord.data_quality || 'CLEAN'
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
