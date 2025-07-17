import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useStockValidation(itemCode: string | null) {
  return useQuery({
    queryKey: ['stock-validation', itemCode],
    queryFn: async () => {
      if (!itemCode) return null;
      
      const { data, error } = await supabase
        .from('satguru_stock')
        .select('current_qty, last_updated')
        .eq('item_code', itemCode)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      return data || { current_qty: 0, last_updated: null };
    },
    enabled: !!itemCode,
    refetchInterval: 10000,
  });
}

export function useItemCodeValidation(itemCode: string | null) {
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