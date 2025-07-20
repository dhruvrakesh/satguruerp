
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
        // Get opening stock for this item
        const { data: openingStock } = await supabase
          .from('satguru_grn_log')
          .select('qty_received')
          .eq('item_code', itemCode)
          .eq('transaction_type', 'OPENING_STOCK')
          .single();

        // Get sum of GRNs from opening stock date to now
        const { data: grnData } = await supabase
          .from('satguru_grn_log')
          .select('qty_received')
          .eq('item_code', itemCode)
          .in('transaction_type', ['REGULAR_GRN', 'RETURN', 'ADJUSTMENT'])
          .gte('created_at', openingStockDate);

        // Get sum of Issues till present date
        const { data: issueData } = await supabase
          .from('satguru_issue_log')
          .select('qty_issued')
          .eq('item_code', itemCode)
          .gte('created_at', openingStockDate);

        // Get item name
        const { data: itemData } = await supabase
          .from('satguru_item_master')
          .select('item_name')
          .eq('item_code', itemCode)
          .single();

        const openingQty = openingStock?.qty_received || 0;
        const totalGRNs = grnData?.reduce((sum, grn) => sum + (grn.qty_received || 0), 0) || 0;
        const totalIssues = issueData?.reduce((sum, issue) => sum + (issue.qty_issued || 0), 0) || 0;
        
        // Stock = Opening Stock + Sum(GRNs) - Sum(Issues)
        const currentStock = openingQty + totalGRNs - totalIssues;

        results.push({
          itemCode,
          itemName: itemData?.item_name,
          openingStock: openingQty,
          totalGRNs,
          totalIssues,
          currentStock,
          calculationDetails: {
            openingStockDate,
            calculationDate: new Date().toISOString().split('T')[0],
            grnEntries: grnData?.length || 0,
            issueEntries: issueData?.length || 0
          }
        });
      }

      return results;
    },
    enabled: itemCodes.length > 0,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
  });
}
