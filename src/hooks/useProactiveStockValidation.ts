
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StockValidationResult {
  itemCode: string;
  itemName?: string;
  available: number;
  required: number;
  status: 'sufficient' | 'insufficient' | 'critical' | 'not_found';
  suggestion?: string;
}

export function useProactiveStockValidation(items: Array<{ item_code: string; qty_required: number }>) {
  return useQuery({
    queryKey: ['proactive-stock-validation', items.map(i => `${i.item_code}-${i.qty_required}`).join(',')],
    queryFn: async (): Promise<StockValidationResult[]> => {
      if (!items.length) return [];
      
      const itemCodes = items.map(i => i.item_code).filter(Boolean);
      
      // Get stock data for all items
      const { data: stockData, error: stockError } = await supabase
        .from('satguru_stock')
        .select('item_code, current_qty')
        .in('item_code', itemCodes);
      
      if (stockError) throw stockError;
      
      // Get item names
      const { data: itemData, error: itemError } = await supabase
        .from('satguru_item_master')
        .select('item_code, item_name')
        .in('item_code', itemCodes);
      
      if (itemError) throw itemError;
      
      // Create lookup maps
      const stockMap = new Map(stockData?.map(s => [s.item_code, s.current_qty]) || []);
      const itemNameMap = new Map(itemData?.map(i => [i.item_code, i.item_name]) || []);
      
      // Process each item
      return items.map(({ item_code, qty_required }) => {
        const available = stockMap.get(item_code) || 0;
        const itemName = itemNameMap.get(item_code);
        
        let status: StockValidationResult['status'] = 'not_found';
        let suggestion = '';
        
        if (itemName) {
          if (available >= qty_required) {
            status = 'sufficient';
          } else if (available > 0) {
            status = 'insufficient';
            suggestion = `Only ${available} units available. Consider reducing quantity or sourcing more stock.`;
          } else {
            status = 'critical';
            suggestion = `No stock available. This item needs to be restocked before processing.`;
          }
        } else {
          suggestion = `Item code not found in master data. Please verify the item code.`;
        }
        
        return {
          itemCode: item_code,
          itemName,
          available,
          required: qty_required,
          status,
          suggestion
        };
      });
    },
    enabled: items.length > 0,
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
