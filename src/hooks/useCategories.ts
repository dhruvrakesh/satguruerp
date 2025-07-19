
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Category {
  id: string;
  category_name: string;
  description?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CategoryWithStats extends Category {
  total_items: number;
  active_items: number;
  fg_items: number;
  rm_items: number;
  packaging_items: number;
  consumable_items: number;
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<Category[]> => {
      console.log('Fetching categories from satguru_categories table...');
      const { data, error } = await supabase
        .from('satguru_categories')
        .select('id, category_name, description, created_at, updated_at')
        .eq('is_active', true)
        .order('category_name');
      
      if (error) {
        console.error('Error fetching categories:', error);
        throw error;
      }
      
      console.log('Categories fetched:', data?.length || 0);
      return data || [];
    },
  });
}

export function useCategoriesWithStats() {
  return useQuery({
    queryKey: ['categoriesWithStats'],
    queryFn: async (): Promise<CategoryWithStats[]> => {
      console.log('Fetching categories with stats using manual aggregation...');
      
      // Get all categories from satguru_categories
      const { data: categoryData, error: categoryError } = await supabase
        .from('satguru_categories')
        .select(`
          id,
          category_name,
          description,
          created_at,
          updated_at
        `)
        .eq('is_active', true)
        .order('category_name');
      
      if (categoryError) {
        console.error('Error fetching categories:', categoryError);
        throw categoryError;
      }

      const categories = categoryData || [];
      const categoriesWithStats: CategoryWithStats[] = [];
      
      // Get item counts for each category from satguru_item_master
      for (const category of categories) {
        const { data: itemData, error: itemError } = await supabase
          .from('satguru_item_master')
          .select('status, usage_type')
          .eq('category_id', category.id);
        
        if (itemError) {
          console.error(`Error fetching items for category ${category.category_name}:`, itemError);
          continue;
        }

        const items = itemData || [];
        const total_items = items.length;
        const active_items = items.filter(item => item.status === 'active').length;
        const fg_items = items.filter(item => item.usage_type === 'FINISHED_GOOD').length;
        const rm_items = items.filter(item => item.usage_type === 'RAW_MATERIAL').length;
        const packaging_items = items.filter(item => item.usage_type === 'PACKAGING').length;
        const consumable_items = items.filter(item => item.usage_type === 'CONSUMABLE').length;

        categoriesWithStats.push({
          id: category.id,
          category_name: category.category_name,
          description: category.description,
          created_at: category.created_at,
          updated_at: category.updated_at,
          total_items,
          active_items,
          fg_items,
          rm_items,
          packaging_items,
          consumable_items
        });
      }
      
      console.log('Categories with stats (manual aggregation):', categoriesWithStats.length);
      if (categoriesWithStats.length > 0) {
        console.log('Sample category stats:', categoriesWithStats[0]);
      }
      
      return categoriesWithStats;
    },
  });
}

// Create an alias for backward compatibility
export const useCategoryStats = useCategoriesWithStats;
export type CategoryStats = CategoryWithStats;

export function useCategoryMutations() {
  const queryClient = useQueryClient();

  const createCategory = useMutation({
    mutationFn: async (category: { category_name: string; description?: string }) => {
      const { data, error } = await supabase
        .from('satguru_categories')
        .insert([category])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['categoriesWithStats'] });
      toast({ title: "Success", description: "Category created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create category",
        variant: "destructive" 
      });
    }
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Category> }) => {
      const { data, error } = await supabase
        .from('satguru_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['categoriesWithStats'] });
      toast({ title: "Success", description: "Category updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update category",
        variant: "destructive" 
      });
    }
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('satguru_categories')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['categoriesWithStats'] });
      toast({ title: "Success", description: "Category deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete category",
        variant: "destructive" 
      });
    }
  });

  return { createCategory, updateCategory, deleteCategory };
}
