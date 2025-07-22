
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ItemPricingEntry {
  id: string;
  item_code: string;
  item_name: string;
  category: string;
  uom: string;
  current_price: number;
  previous_price?: number;
  cost_category: string;
  supplier?: string;
  effective_date: string;
  created_by: string;
  updated_at: string;
  is_active: boolean;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  price_change_reason?: string;
}

export interface PricingFilters {
  category?: string;
  costCategory?: string;
  supplier?: string;
  approvalStatus?: string;
  search?: string;
}

export const useItemPricing = (filters: PricingFilters = {}) => {
  return useQuery({
    queryKey: ["item-pricing", filters],
    queryFn: async (): Promise<ItemPricingEntry[]> => {
      let query = supabase
        .from("item_pricing_master")
        .select(`
          *,
          cost_categories!item_pricing_master_cost_category_id_fkey(category_name),
          satguru_item_master!inner(item_name, category_name, unit_of_measure)
        `)
        .eq("is_active", true);

      // Apply filters
      if (filters.costCategory && filters.costCategory !== "all") {
        query = query.eq("cost_categories.category_code", filters.costCategory);
      }

      if (filters.supplier && filters.supplier !== "all") {
        query = query.eq("supplier_code", filters.supplier);
      }

      if (filters.approvalStatus && filters.approvalStatus !== "all") {
        query = query.eq("approval_status", filters.approvalStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform data to match interface
      let transformedData = data?.map(item => ({
        id: item.id,
        item_code: item.item_code,
        item_name: item.satguru_item_master?.item_name || '',
        category: item.satguru_item_master?.category_name || '',
        uom: item.unit_of_measure || item.satguru_item_master?.unit_of_measure || 'KG',
        current_price: Number(item.current_price) || 0,
        previous_price: Number(item.previous_price),
        cost_category: item.cost_categories?.category_name || '',
        supplier: item.supplier_code,
        effective_date: item.effective_date,
        created_by: item.created_by || '',
        updated_at: item.updated_at,
        is_active: item.is_active,
        approval_status: item.approval_status as 'PENDING' | 'APPROVED' | 'REJECTED',
        price_change_reason: item.price_change_reason
      })) || [];

      // Apply search filter after transformation
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        transformedData = transformedData.filter(item => 
          item.item_code.toLowerCase().includes(searchLower) ||
          item.item_name.toLowerCase().includes(searchLower)
        );
      }

      // Apply category filter after transformation
      if (filters.category && filters.category !== "all") {
        transformedData = transformedData.filter(item => item.category === filters.category);
      }

      return transformedData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUpdateItemPrice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      itemId, 
      newPrice, 
      reason 
    }: { 
      itemId: string; 
      newPrice: number; 
      reason?: string;
    }) => {
      // Get current price for history
      const { data: currentItem, error: fetchError } = await supabase
        .from("item_pricing_master")
        .select("current_price, item_code")
        .eq("id", itemId)
        .single();

      if (fetchError) throw fetchError;

      const oldPrice = Number(currentItem.current_price);
      const priceChangePercentage = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;

      // Update the price
      const { data, error } = await supabase
        .from("item_pricing_master")
        .update({
          previous_price: oldPrice,
          current_price: newPrice,
          price_change_reason: reason,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
          approval_status: 'PENDING', // Reset approval for new price
          effective_date: new Date().toISOString().split('T')[0]
        })
        .eq("id", itemId)
        .select()
        .single();

      if (error) throw error;

      // Add to price history
      await supabase
        .from("item_price_history")
        .insert({
          item_code: currentItem.item_code,
          old_price: oldPrice,
          new_price: newPrice,
          price_change_percentage: priceChangePercentage,
          change_reason: reason,
          change_type: 'UPDATE',
          changed_by: (await supabase.auth.getUser()).data.user?.id
        });

      return {
        success: true,
        itemId,
        newPrice,
        previousPrice: oldPrice,
        updatedAt: data.updated_at
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["item-pricing"] });
      queryClient.invalidateQueries({ queryKey: ["stock-valuation"] });
      
      toast({
        title: "Price Updated Successfully",
        description: `Item price updated to ₹${data.newPrice}`,
      });
    },
    onError: (error) => {
      console.error("Failed to update item price:", error);
      toast({
        title: "Price Update Failed", 
        description: "Failed to update item price. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useAddItemPrice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newPricing: Omit<ItemPricingEntry, 'id' | 'created_by' | 'updated_at'>) => {
      // Get cost category ID from category name
      const { data: costCategory } = await supabase
        .from("cost_categories")
        .select("id")
        .eq("category_name", newPricing.cost_category)
        .single();

      const { data, error } = await supabase
        .from("item_pricing_master")
        .insert({
          item_code: newPricing.item_code,
          cost_category_id: costCategory?.id,
          current_price: newPricing.current_price,
          supplier_code: newPricing.supplier,
          unit_of_measure: newPricing.uom,
          effective_date: newPricing.effective_date,
          price_change_reason: newPricing.price_change_reason,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          approval_status: 'PENDING'
        })
        .select()
        .single();

      if (error) throw error;

      // Add to price history
      await supabase
        .from("item_price_history")
        .insert({
          item_code: newPricing.item_code,
          new_price: newPricing.current_price,
          change_reason: newPricing.price_change_reason || 'Initial price entry',
          change_type: 'UPDATE',
          changed_by: (await supabase.auth.getUser()).data.user?.id
        });

      return {
        success: true,
        id: data.id,
        ...newPricing,
        created_by: data.created_by,
        updated_at: data.updated_at
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-pricing"] });
      queryClient.invalidateQueries({ queryKey: ["stock-valuation"] });
      
      toast({
        title: "Pricing Added Successfully",
        description: "New item pricing has been added to the system",
      });
    },
    onError: (error) => {
      console.error("Failed to add item pricing:", error);
      toast({
        title: "Failed to Add Pricing",
        description: "Could not add new pricing entry. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const usePricingStatistics = () => {
  return useQuery({
    queryKey: ["pricing-statistics"],
    queryFn: async () => {
      // Get total items from stock
      const { data: totalItemsData } = await supabase
        .from("satguru_stock_summary_view")
        .select("item_code", { count: 'exact' });

      // Get items with pricing
      const { data: pricedItemsData } = await supabase
        .from("item_pricing_master")
        .select("item_code", { count: 'exact' })
        .eq("is_active", true);

      // Get pending approvals
      const { data: pendingData } = await supabase
        .from("item_pricing_master")
        .select("id", { count: 'exact' })
        .eq("approval_status", "PENDING")
        .eq("is_active", true);

      // Get total value from stock valuation view
      const { data: valuationData } = await supabase
        .from("stock_valuation_enhanced")
        .select("total_value, unit_price");

      const totalValue = valuationData?.reduce((sum, item) => sum + (item.total_value || 0), 0) || 0;
      const averagePrice = valuationData?.length > 0 
        ? valuationData.reduce((sum, item) => sum + (item.unit_price || 0), 0) / valuationData.length 
        : 0;

      // Calculate price variance (standard deviation)
      const prices = valuationData?.map(item => item.unit_price || 0) || [];
      const variance = prices.length > 0 
        ? Math.sqrt(prices.reduce((sum, price) => sum + Math.pow(price - averagePrice, 2), 0) / prices.length)
        : 0;
      const priceVariance = averagePrice > 0 ? (variance / averagePrice) * 100 : 0;

      return {
        totalItems: totalItemsData?.length || 0,
        itemsWithPricing: pricedItemsData?.length || 0,
        pendingApprovals: pendingData?.length || 0,
        totalValue: Math.round(totalValue),
        averagePrice: Math.round(averagePrice * 100) / 100,
        priceVariance: Math.round(priceVariance * 100) / 100,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
