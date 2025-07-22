
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
      let query = supabase
        .from("cost_categories")
        .select(`
          *,
          item_pricing_master!item_pricing_master_cost_category_id_fkey(id)
        `);

      // Apply filters
      if (filters.isActive !== undefined) {
        query = query.eq("is_active", filters.isActive);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform data to match interface
      const transformedData = data?.map(category => ({
        id: category.id,
        category_code: category.category_code,
        category_name: category.category_name,
        description: category.description || '',
        level: 1, // Since we don't have hierarchical levels in our schema
        display_order: 1, // Default ordering
        allocation_method: category.allocation_method as 'percentage' | 'fixed' | 'weighted' | 'activity',
        is_active: category.is_active,
        created_at: category.created_at,
        updated_at: category.updated_at,
        applicable_item_count: category.item_pricing_master?.length || 0
      })) || [];

      return transformedData.sort((a, b) => a.category_name.localeCompare(b.category_name));
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useAddCostCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newCategory: Omit<CostCategory, 'id' | 'created_at' | 'updated_at' | 'applicable_item_count'>) => {
      const { data, error } = await supabase
        .from("cost_categories")
        .insert({
          category_code: newCategory.category_code,
          category_name: newCategory.category_name,
          description: newCategory.description,
          allocation_method: newCategory.allocation_method.toUpperCase(),
          is_active: newCategory.is_active
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        id: data.id,
        ...newCategory,
        created_at: data.created_at,
        updated_at: data.updated_at,
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
      const { data, error } = await supabase
        .from("cost_categories")
        .update({
          category_code: updates.category_code,
          category_name: updates.category_name,
          description: updates.description,
          allocation_method: updates.allocation_method?.toUpperCase(),
          is_active: updates.is_active
        })
        .eq("id", categoryId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        categoryId,
        updates,
        updated_at: data.updated_at
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
      // Check if category is in use
      const { data: usageCheck } = await supabase
        .from("item_pricing_master")
        .select("id", { count: 'exact' })
        .eq("cost_category_id", categoryId);

      if (usageCheck && usageCheck.length > 0) {
        throw new Error("Cannot delete category that is in use by pricing entries");
      }

      const { error } = await supabase
        .from("cost_categories")
        .delete()
        .eq("id", categoryId);

      if (error) throw error;

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
        description: error.message || "Could not delete cost category. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useCategoryStatistics = () => {
  return useQuery({
    queryKey: ["category-statistics"],
    queryFn: async () => {
      // Get total categories
      const { data: totalCategories } = await supabase
        .from("cost_categories")
        .select("id", { count: 'exact' });

      // Get active categories
      const { data: activeCategories } = await supabase
        .from("cost_categories")
        .select("id", { count: 'exact' })
        .eq("is_active", true);

      // Get allocation methods distribution
      const { data: allocationData } = await supabase
        .from("cost_categories")
        .select("allocation_method")
        .eq("is_active", true);

      const allocationCounts = allocationData?.reduce((acc, cat) => {
        acc[cat.allocation_method] = (acc[cat.allocation_method] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        totalCategories: totalCategories?.length || 0,
        activeCategories: activeCategories?.length || 0,
        hierarchyLevels: 1, // Currently flat structure
        averageAllocation: 25, // Placeholder
        allocationMethods: allocationCounts,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
