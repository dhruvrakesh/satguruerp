
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface CostCategory {
  id: string;
  category_code: string;
  category_name: string;
  description: string;
  parent_category_id?: string;
  level: number;
  display_order: number;
  default_percentage?: number;
  allocation_method: 'percentage' | 'fixed' | 'weighted' | 'activity';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  applicable_item_count?: number;
}

export interface CategoryFilters {
  level?: number;
  parentCategory?: string;
  isActive?: boolean;
}

export const useCostCategories = (filters: CategoryFilters = {}) => {
  return useQuery({
    queryKey: ["cost-categories", filters],
    queryFn: async (): Promise<CostCategory[]> => {
      console.log("Fetching cost categories with filters:", filters);
      
      // Mock data - replace with actual Supabase query once tables are created
      const mockData: CostCategory[] = [
        {
          id: "1",
          category_code: "RM",
          category_name: "Raw Materials",
          description: "Primary raw materials used in production",
          level: 1,
          display_order: 1,
          default_percentage: 60,
          allocation_method: "percentage",
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          applicable_item_count: 250
        },
        {
          id: "2",
          category_code: "SUB",
          category_name: "Substrates",
          description: "Base substrates for printing",
          parent_category_id: "1",
          level: 2,
          display_order: 2,
          default_percentage: 25,
          allocation_method: "percentage",
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          applicable_item_count: 150
        },
        {
          id: "3",
          category_code: "LAB",
          category_name: "Labor",
          description: "Direct and indirect labor costs",
          level: 1,
          display_order: 3,
          default_percentage: 15,
          allocation_method: "activity",
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          applicable_item_count: 0
        },
        {
          id: "4",
          category_code: "OH",
          category_name: "Overhead",
          description: "Manufacturing and administrative overhead",
          level: 1,
          display_order: 4,
          default_percentage: 10,
          allocation_method: "weighted",
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          applicable_item_count: 0
        }
      ];

      // Apply filters
      let filteredData = mockData;

      if (filters.level !== undefined) {
        filteredData = filteredData.filter(cat => cat.level === filters.level);
      }

      if (filters.parentCategory) {
        filteredData = filteredData.filter(cat => cat.parent_category_id === filters.parentCategory);
      }

      if (filters.isActive !== undefined) {
        filteredData = filteredData.filter(cat => cat.is_active === filters.isActive);
      }

      return filteredData.sort((a, b) => a.display_order - b.display_order);
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useAddCostCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newCategory: Omit<CostCategory, 'id' | 'created_at' | 'updated_at' | 'applicable_item_count'>) => {
      console.log("Adding new cost category:", newCategory);
      
      // Mock implementation - replace with actual Supabase insert
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        id: `cat_${Date.now()}`,
        ...newCategory,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        applicable_item_count: 0
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-categories"] });
      
      toast({
        title: "Category Added Successfully",
        description: "New cost category has been created",
      });
    },
    onError: (error) => {
      console.error("Failed to add cost category:", error);
      toast({
        title: "Failed to Add Category",
        description: "Could not create new cost category. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateCostCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      categoryId, 
      updates 
    }: { 
      categoryId: string; 
      updates: Partial<CostCategory>;
    }) => {
      console.log(`Updating cost category ${categoryId}:`, updates);
      
      // Mock implementation - replace with actual Supabase update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        categoryId,
        updates,
        updated_at: new Date().toISOString()
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-categories"] });
      
      toast({
        title: "Category Updated Successfully",
        description: "Cost category has been updated",
      });
    },
    onError: (error) => {
      console.error("Failed to update cost category:", error);
      toast({
        title: "Update Failed",
        description: "Could not update cost category. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteCostCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      console.log(`Deleting cost category ${categoryId}`);
      
      // Mock implementation - replace with actual Supabase delete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        categoryId
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-categories"] });
      
      toast({
        title: "Category Deleted Successfully",
        description: "Cost category has been removed from the system",
      });
    },
    onError: (error) => {
      console.error("Failed to delete cost category:", error);
      toast({
        title: "Delete Failed",
        description: "Could not delete cost category. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useCategoryStatistics = () => {
  return useQuery({
    queryKey: ["category-statistics"],
    queryFn: async () => {
      // Mock implementation - replace with actual calculations
      return {
        totalCategories: 8,
        activeCategories: 6,
        hierarchyLevels: 3,
        averageAllocation: 25,
        lastUpdated: "2024-01-15"
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
