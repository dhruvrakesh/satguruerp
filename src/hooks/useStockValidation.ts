
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StockValidationResult {
  itemCode: string;
  available: number;
  required: number;
  status: 'sufficient' | 'insufficient' | 'critical' | 'unknown';
  itemExists: boolean;
  itemName?: string;
  uom?: string;
  lastUpdated?: string;
}

export function useStockValidation(itemCode?: string) {
  const queryClient = useQueryClient();

  // Set up real-time subscription for stock level updates
  useEffect(() => {
    if (!itemCode) return;

    const channel = supabase
      .channel('stock-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'satguru_stock',
          filter: `item_code=eq.${itemCode}`
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['stock-validation', itemCode] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [itemCode, queryClient]);

  return useQuery({
    queryKey: ['stock-validation', itemCode],
    queryFn: async (): Promise<StockValidationResult> => {
      if (!itemCode) {
        return {
          itemCode: '',
          available: 0,
          required: 0,
          status: 'unknown',
          itemExists: false
        };
      }
      
      // Get stock and item details
      const [stockResult, itemResult] = await Promise.all([
        supabase
          .from('satguru_stock')
          .select('current_qty, last_updated')
          .eq('item_code', itemCode)
          .single(),
        supabase
          .from('satguru_item_master')
          .select('item_name, uom')
          .eq('item_code', itemCode)
          .single()
      ]);
      
      const stockData = stockResult.error?.code === 'PGRST116' 
        ? { current_qty: 0, last_updated: null }
        : stockResult.data;
        
      const itemData = itemResult.error?.code === 'PGRST116'
        ? null
        : itemResult.data;
      
      if (stockResult.error && stockResult.error.code !== 'PGRST116') throw stockResult.error;
      if (itemResult.error && itemResult.error.code !== 'PGRST116') throw itemResult.error;
      
      return {
        itemCode,
        available: stockData?.current_qty || 0,
        required: 0, // Will be set by component
        status: 'unknown', // Will be calculated by component
        itemExists: !!itemData,
        itemName: itemData?.item_name,
        uom: itemData?.uom,
        lastUpdated: stockData?.last_updated
      };
    },
    enabled: !!itemCode,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useBulkStockValidation(itemCodes: string[]) {
  return useQuery({
    queryKey: ['bulk-stock-validation', itemCodes.sort()],
    queryFn: async (): Promise<StockValidationResult[]> => {
      if (!itemCodes.length) return [];
      
      // Get all stock data in one query
      const { data: stockData, error: stockError } = await supabase
        .from('satguru_stock')
        .select('item_code, current_qty, last_updated')
        .in('item_code', itemCodes);
      
      if (stockError) throw stockError;
      
      // Get all item data in one query
      const { data: itemData, error: itemError } = await supabase
        .from('satguru_item_master')
        .select('item_code, item_name, uom')
        .in('item_code', itemCodes);
      
      if (itemError) throw itemError;
      
      // Create lookup maps
      const stockMap = new Map(stockData?.map(s => [s.item_code, s]) || []);
      const itemMap = new Map(itemData?.map(i => [i.item_code, i]) || []);
      
      // Build results
      return itemCodes.map(itemCode => {
        const stock = stockMap.get(itemCode);
        const item = itemMap.get(itemCode);
        
        return {
          itemCode,
          available: stock?.current_qty || 0,
          required: 0,
          status: 'unknown' as const,
          itemExists: !!item,
          itemName: item?.item_name,
          uom: item?.uom,
          lastUpdated: stock?.last_updated
        };
      });
    },
    enabled: itemCodes.length > 0,
    staleTime: 15000, // Consider fresh for 15 seconds
  });
}
