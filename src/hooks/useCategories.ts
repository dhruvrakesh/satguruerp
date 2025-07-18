
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
    queryFn: async () => {
      console.log('Fetching categories from categories table...');
      const { data, error } = await supabase
        .from('categories')
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
    queryFn: async () => {
      console.log('Fetching categories with detailed item stats...');
      
      // First get all categories
      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('id, category_name, description, created_at, updated_at')
        .eq('is_active', true)
        .order('category_name');
      
      if (categoriesError) {
        console.error('Error fetching categories:', categoriesError);
        throw categoriesError;
      }

      // Then get detailed item counts for each category
      const categoriesWithStats: CategoryWithStats[] = [];
      
      for (const category of categories || []) {
        // Get total count
        const { count: totalCount, error: totalError } = await supabase
          .from('item_master')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id);

        // Get active count
        const { count: activeCount, error: activeError } = await supabase
          .from('item_master')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id)
          .eq('status', 'active');

        // Get counts by usage type
        const { count: fgCount, error: fgError } = await supabase
          .from('item_master')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id)
          .eq('usage_type', 'FINISHED_GOOD');

        const { count: rmCount, error: rmError } = await supabase
          .from('item_master')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id)
          .eq('usage_type', 'RAW_MATERIAL');

        const { count: packagingCount, error: packagingError } = await supabase
          .from('item_master')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id)
          .eq('usage_type', 'PACKAGING');

        const { count: consumableCount, error: consumableError } = await supabase
          .from('item_master')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id)
          .eq('usage_type', 'CONSUMABLE');

        if (totalError || activeError || fgError || rmError || packagingError || consumableError) {
          console.error('Error counting items for category:', category.category_name);
          continue;
        }

        categoriesWithStats.push({
          ...category,
          total_items: totalCount || 0,
          active_items: activeCount || 0,
          fg_items: fgCount || 0,
          rm_items: rmCount || 0,
          packaging_items: packagingCount || 0,
          consumable_items: consumableCount || 0
        });
      }
      
      console.log('Categories with detailed stats processed:', categoriesWithStats.length);
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
        .from('categories')
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
        .from('categories')
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
        .from('categories')
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
