import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
          table: 'satguru_stock'
        },
        (payload) => {
          // Only invalidate if the changed item matches our tracked item
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          if (newRecord?.item_code === itemCode || oldRecord?.item_code === itemCode) {
            queryClient.invalidateQueries({ queryKey: ['stock-validation', itemCode] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [itemCode, queryClient]);

  return useQuery({
    queryKey: ['stock-validation', itemCode],
    queryFn: async () => {
      if (!itemCode) return null;
      
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
        ? { item_name: 'Unknown Item', uom: 'PCS' }
        : itemResult.data;
      
      if (stockResult.error && stockResult.error.code !== 'PGRST116') throw stockResult.error;
      if (itemResult.error && itemResult.error.code !== 'PGRST116') throw itemResult.error;
      
      return {
        available: stockData?.current_qty || 0,
        isAvailable: (stockData?.current_qty || 0) > 0,
        itemName: itemData?.item_name || 'Unknown Item',
        current_qty: stockData?.current_qty || 0,
        last_updated: stockData?.last_updated || null
      };
    },
    enabled: !!itemCode,
    refetchInterval: 10000,
  });
}

export function useItemCodeValidation(itemCode?: string) {
  return useQuery({
    queryKey: ['item-code-validation', itemCode],
    queryFn: async () => {
      if (!itemCode) return null;
      
      const { data, error } = await supabase
        .from('satguru_item_master')
        .select('item_code, item_name, uom, status')
        .eq('item_code', itemCode)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      return data;
    },
    enabled: !!itemCode,
  });
}