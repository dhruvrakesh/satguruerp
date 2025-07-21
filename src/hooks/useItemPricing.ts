
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
      console.log("Fetching item pricing data with filters:", filters);
      
      // For now, return mock data since the table doesn't exist yet
      // This will be replaced with actual Supabase query once tables are created
      const mockData: ItemPricingEntry[] = [
        {
          id: "1",
          item_code: "CHE_001",
          item_name: "Printing Ink - Cyan",
          category: "Chemicals",
          uom: "KG",
          current_price: 450.00,
          previous_price: 430.00,
          cost_category: "Raw Materials",
          supplier: "Supplier A",
          effective_date: "2024-01-15",
          created_by: "user1",
          updated_at: "2024-01-15T10:00:00Z",
          is_active: true,
          approval_status: "APPROVED",
          price_change_reason: "Market price increase"
        },
        {
          id: "2",
          item_code: "PAC_002",
          item_name: "BOPP Film 20 micron",
          category: "Packaging",
          uom: "KG",
          current_price: 125.00,
          previous_price: 120.00,
          cost_category: "Substrates",
          supplier: "Supplier B",
          effective_date: "2024-01-14",
          created_by: "user2",
          updated_at: "2024-01-14T15:30:00Z",
          is_active: true,
          approval_status: "APPROVED",
          price_change_reason: "Supplier rate update"
        }
      ];

      // Apply filters
      let filteredData = mockData;

      if (filters.category && filters.category !== "all") {
        filteredData = filteredData.filter(item => item.category === filters.category);
      }

      if (filters.costCategory && filters.costCategory !== "all") {
        filteredData = filteredData.filter(item => item.cost_category === filters.costCategory);
      }

      if (filters.supplier && filters.supplier !== "all") {
        filteredData = filteredData.filter(item => item.supplier === filters.supplier);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter(item => 
          item.item_code.toLowerCase().includes(searchLower) ||
          item.item_name.toLowerCase().includes(searchLower)
        );
      }

      return filteredData;
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
      console.log(`Updating price for item ${itemId} to ${newPrice}`, { reason });
      
      // Mock implementation - replace with actual Supabase update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        itemId,
        newPrice,
        previousPrice: 0, // Would come from database
        updatedAt: new Date().toISOString()
      };
    },
    onSuccess: (data) => {
      // Invalidate and refetch item pricing data
      queryClient.invalidateQueries({ queryKey: ["item-pricing"] });
      
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
      console.log("Adding new item pricing:", newPricing);
      
      // Mock implementation - replace with actual Supabase insert
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        id: `new_${Date.now()}`,
        ...newPricing,
        created_by: "current_user",
        updated_at: new Date().toISOString()
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-pricing"] });
      
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
      // Mock implementation - replace with actual calculations
      return {
        totalItems: 1500,
        itemsWithPricing: 1250,
        pendingApprovals: 25,
        totalValue: 2450000,
        averagePrice: 1960,
        priceVariance: 12.5,
        lastUpdated: "2024-01-15"
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
