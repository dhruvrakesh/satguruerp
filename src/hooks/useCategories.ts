
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

export interface CategoryStats extends Category {
  total_items: number;
  fg_items: number;
  rm_items: number;
  packaging_items: number;
  consumable_items: number;
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

export function useCategoryStats() {
  return useQuery({
    queryKey: ['categoryStats'],
    queryFn: async () => {
      console.log('Fetching category stats...');
      const { data, error } = await supabase
        .from('categories')
        .select(`
          id,
          category_name,
          description,
          created_at,
          updated_at
        `)
        .eq('is_active', true)
        .order('category_name');
      
      if (error) {
        console.error('Error fetching category stats:', error);
        throw error;
      }
      
      // For now, return basic stats - can be enhanced later with actual counts
      const statsData = data?.map(cat => ({
        ...cat,
        total_items: 0,
        fg_items: 0,
        rm_items: 0,
        packaging_items: 0,
        consumable_items: 0,
        active_items: 0
      })) || [];
      
      console.log('Category stats processed:', statsData.length);
      return statsData as CategoryStats[];
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
      queryClient.invalidateQueries({ queryKey: ['categoryStats'] });
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
      queryClient.invalidateQueries({ queryKey: ['categoryStats'] });
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
      queryClient.invalidateQueries({ queryKey: ['categoryStats'] });
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
