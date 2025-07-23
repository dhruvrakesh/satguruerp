
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ItemWithPurchaseHistory {
  item_code: string;
  item_name: string;
  uom: string;
  category_name: string;
  current_stock: number;
  stock_status: string;
  last_purchase_price: number;
  last_purchase_date: string;
  last_vendor: string;
  reorder_point: number;
  avg_consumption: number;
}

export const useItemSelection = (searchQuery: string, vendorId?: string) => {
  return useQuery({
    queryKey: ['item-selection', searchQuery, vendorId],
    queryFn: async () => {
      // Get items from item master
      let itemQuery = supabase
        .from('satguru_item_master')
        .select(`
          item_code,
          item_name,
          uom,
          category_id,
          status,
          categories:category_id(category_name)
        `)
        .eq('status', 'active')
        .order('item_name');

      if (searchQuery && searchQuery.trim() !== '') {
        itemQuery = itemQuery.or(`item_code.ilike.%${searchQuery}%,item_name.ilike.%${searchQuery}%`);
      }

      const { data: items, error } = await itemQuery.limit(100);
      
      if (error) throw error;

      // Get enhanced data for each item
      const enhancedItems = await Promise.all(
        (items || []).map(async (item) => {
          // Get current stock
          const { data: stockData } = await supabase
            .from('satguru_stock_summary_view')
            .select('current_qty, stock_status')
            .eq('item_code', item.item_code)
            .maybeSingle();

          // Get last purchase info
          const { data: lastPurchase } = await supabase
            .from('satguru_grn_log')
            .select('amount_inr, qty_received, date, vendor')
            .eq('item_code', item.item_code)
            .not('amount_inr', 'is', null)
            .not('qty_received', 'is', null)
            .gt('qty_received', 0)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Calculate average consumption (last 3 months)
          const { data: consumptionData } = await supabase
            .from('satguru_issue_log')
            .select('qty_issued')
            .eq('item_code', item.item_code)
            .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
            .order('date', { ascending: false });

          const totalConsumption = consumptionData?.reduce((sum, entry) => sum + entry.qty_issued, 0) || 0;
          const avgConsumption = totalConsumption / 3; // Monthly average

          const unitPrice = lastPurchase && lastPurchase.amount_inr && lastPurchase.qty_received 
            ? lastPurchase.amount_inr / lastPurchase.qty_received 
            : 0;

          return {
            item_code: item.item_code,
            item_name: item.item_name,
            uom: item.uom,
            category_name: item.categories?.category_name || 'Unknown',
            current_stock: stockData?.current_qty || 0,
            stock_status: stockData?.stock_status || 'normal',
            last_purchase_price: unitPrice,
            last_purchase_date: lastPurchase?.date || '',
            last_vendor: lastPurchase?.vendor || 'Unknown',
            reorder_point: avgConsumption * 2, // 2 months buffer
            avg_consumption: avgConsumption,
          };
        })
      );

      return enhancedItems;
    },
    enabled: !!searchQuery || searchQuery === '',
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
