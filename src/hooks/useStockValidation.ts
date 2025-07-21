
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StockValidationResult {
  itemCode: string;
  available: number;
  current_qty: number; // Alias for available
  required: number;
  status: 'sufficient' | 'insufficient' | 'critical' | 'unknown';
  itemExists: boolean;
  isAvailable: boolean; // Computed property
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
          current_qty: 0,
          required: 0,
          status: 'unknown',
          itemExists: false,
          isAvailable: false
        };
      }
      
      // Get stock from the standardized summary view
      const { data: stockData, error: stockError } = await supabase
        .from('satguru_stock_summary_view')
        .select('current_qty, last_updated, item_name, uom')
        .eq('item_code', itemCode)
        .single();

      const data = stockError?.code === 'PGRST116' 
        ? { current_qty: 0, last_updated: null, item_name: null, uom: null }
        : stockData;
        
      if (stockError && stockError.code !== 'PGRST116') throw stockError;
      
      const availableQty = data?.current_qty || 0;
      
      return {
        itemCode,
        available: availableQty,
        current_qty: availableQty,
        required: 0, // Will be set by component
        status: 'unknown', // Will be calculated by component
        itemExists: !!data?.item_name,
        isAvailable: availableQty > 0,
        itemName: data?.item_name,
        uom: data?.uom,
        lastUpdated: data?.last_updated
      };
    },
    enabled: !!itemCode,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Add the missing useItemCodeValidation hook
export function useItemCodeValidation(itemCode?: string) {
  return useQuery({
    queryKey: ['item-validation', itemCode],
    queryFn: async () => {
      if (!itemCode) return null;
      
      const { data, error } = await supabase
        .from('satguru_item_master')
        .select('item_name, uom')
        .eq('item_code', itemCode)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      return data;
    },
    enabled: !!itemCode,
  });
}

export function useBulkStockValidation(itemCodes: string[]) {
  return useQuery({
    queryKey: ['bulk-stock-validation', itemCodes.sort()],
    queryFn: async (): Promise<StockValidationResult[]> => {
      if (!itemCodes.length) return [];
      
      // Get all data from the standardized summary view in one query
      const { data: summaryData, error: summaryError } = await supabase
        .from('satguru_stock_summary_view')
        .select('item_code, current_qty, last_updated, item_name, uom')
        .in('item_code', itemCodes);
      
      if (summaryError) throw summaryError;
      
      // Create lookup map
      const summaryMap = new Map(summaryData?.map(s => [s.item_code, s]) || []);
      
      // Build results
      return itemCodes.map(itemCode => {
        const summary = summaryMap.get(itemCode);
        const availableQty = summary?.current_qty || 0;
        
        return {
          itemCode,
          available: availableQty,
          current_qty: availableQty,
          required: 0,
          status: 'unknown' as const,
          itemExists: !!summary?.item_name,
          isAvailable: availableQty > 0,
          itemName: summary?.item_name,
          uom: summary?.uom,
          lastUpdated: summary?.last_updated
        };
      });
    },
    enabled: itemCodes.length > 0,
    staleTime: 15000, // Consider fresh for 15 seconds
  });
}
