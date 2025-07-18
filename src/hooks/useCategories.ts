
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
      console.log('Fetching categories with item counts...');
      
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

      // Then get item counts for each category
      const categoriesWithStats: CategoryWithStats[] = [];
      
      for (const category of categories || []) {
        const { count: totalCount, error: totalError } = await supabase
          .from('item_master')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id);

        const { count: activeCount, error: activeError } = await supabase
          .from('item_master')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id)
          .eq('status', 'active');

        if (totalError || activeError) {
          console.error('Error counting items for category:', category.category_name, totalError || activeError);
          continue;
        }

        categoriesWithStats.push({
          ...category,
          total_items: totalCount || 0,
          active_items: activeCount || 0
        });
      }
      
      console.log('Categories with stats processed:', categoriesWithStats.length);
      return categoriesWithStats;
    },
  });
}

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
