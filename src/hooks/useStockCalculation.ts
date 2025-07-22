
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
  openingStockDate: string = '2025-03-31' // Default to FY 2024-25 end (financial year baseline)
) {
  return useQuery({
    queryKey: ['stock-calculation', itemCodes, openingStockDate],
    queryFn: async (): Promise<StockCalculationResult[]> => {
      if (!itemCodes.length) return [];
      
      console.log(`🔍 Fetching financial year stock data for ${itemCodes.length} items (FY Opening Stock: Mar 31, 2025)`);
      
      // Use single source of truth: satguru_stock_summary_view with financial year logic
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
              openingStockDate: '2025-03-31',
              calculationDate: new Date().toISOString().split('T')[0],
              grnEntries: 0,
              issueEntries: 0,
              dataQuality: 'NO_DATA'
            }
          };
        }

        // Extract financial year stock data from the enhanced view (using type assertion for new fields)
        const stockRecord = stockData as any;
        const openingStock = Number(stockData.opening_stock) || 0;
        const legacyGrns = Number(stockRecord.legacy_grns) || 0;
        const legacyIssues = Number(stockRecord.legacy_issues) || 0;
        const operationalGrns = Number(stockRecord.operational_grns) || 0;
        const operationalIssues = Number(stockRecord.operational_issues) || 0;
        const legacyBaseline = Number(stockRecord.legacy_baseline) || 0;
        
        // Total movements (financial year calculation)
        const totalGRNs = Number(stockData.total_grns) || 0;
        const totalIssues = Number(stockData.total_issues) || 0;
        const currentStock = Number(stockData.current_qty) || 0;
        
        console.log(`✅ Financial Year Stock for ${itemCode}:`, {
          opening: openingStock,
          legacyPeriod: { grns: legacyGrns, issues: legacyIssues, baseline: legacyBaseline },
          operationalPeriod: { grns: operationalGrns, issues: operationalIssues },
          totals: { grns: totalGRNs, issues: totalIssues },
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
            openingStockDate: '2025-03-31', // Fixed to financial year end
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
    refetchInterval: 60000, // Refresh every minute for real-time updates
  });
}
