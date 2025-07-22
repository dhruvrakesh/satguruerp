import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface EnhancedCategory {
  id: string;
  category_name: string;
  description?: string | null;
  category_code?: string | null;
  parent_category_id?: string | null;
  category_level: number;
  sort_order: number;
  is_active: boolean;
  category_type: 'STANDARD' | 'SYSTEM' | 'TEMPORARY';
  business_rules: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string | null;
  updated_at: string | null;
  last_modified_by?: string | null;
  // Stats from materialized view
  total_items: number;
  active_items: number;
  fg_items: number;
  rm_items: number;
  packaging_items: number;
  consumable_items: number;
  last_item_added?: string | null;
  avg_item_value: number;
}

export interface CategoryFilters {
  search?: string;
  category_type?: string;
  is_active?: boolean;
  parent_category_id?: string;
  min_items?: number;
  max_items?: number;
}

export interface CategorySortOptions {
  field: 'category_name' | 'total_items' | 'created_at' | 'avg_item_value';
  direction: 'asc' | 'desc';
}

export function useEnhancedCategories(filters: CategoryFilters = {}, sort: CategorySortOptions = { field: 'category_name', direction: 'asc' }) {
  return useQuery({
    queryKey: ['enhanced-categories', filters, sort],
    queryFn: async (): Promise<EnhancedCategory[]> => {
      console.log('Fetching enhanced categories...');
      
      // First get stats from materialized view
      const { data: statsData, error: statsError } = await supabase
        .from('category_stats_mv')
        .select('*');
      
      if (statsError) {
        console.error('Error fetching category stats:', statsError);
        throw statsError;
      }

      // Then get full category data from main table
      let categoryQuery = supabase
        .from('satguru_categories')
        .select(`
          id, category_name, description, category_code, parent_category_id,
          category_level, sort_order, is_active, category_type, business_rules,
          metadata, created_at, updated_at, last_modified_by
        `);

      // Apply filters
      if (filters.search) {
        categoryQuery = categoryQuery.or(`category_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      if (filters.category_type) {
        categoryQuery = categoryQuery.eq('category_type', filters.category_type);
      }

      if (filters.is_active !== undefined) {
        categoryQuery = categoryQuery.eq('is_active', filters.is_active);
      }

      if (filters.parent_category_id) {
        categoryQuery = categoryQuery.eq('parent_category_id', filters.parent_category_id);
      }

      const { data: categoryData, error: categoryError } = await categoryQuery;
      
      if (categoryError) {
        console.error('Error fetching categories:', categoryError);
        throw categoryError;
      }

      // Merge category data with stats
      const statsMap = new Map(statsData?.map(stat => [stat.id, stat]) || []);
      
      let enhancedData = (categoryData || []).map(category => {
        const stats = statsMap.get(category.id) || {
          total_items: 0,
          active_items: 0,
          fg_items: 0,
          rm_items: 0,
          packaging_items: 0,
          consumable_items: 0,
          last_item_added: null,
          avg_item_value: 0
        };

        return {
          ...category,
          ...stats,
          category_level: category.category_level || 1,
          sort_order: category.sort_order || 0,
          is_active: category.is_active ?? true,
          category_type: (category.category_type || 'STANDARD') as 'STANDARD' | 'SYSTEM' | 'TEMPORARY',
          business_rules: (category.business_rules as Record<string, any>) || {},
          metadata: (category.metadata as Record<string, any>) || {}
        } as EnhancedCategory;
      });

      // Apply item count filters
      if (filters.min_items !== undefined) {
        enhancedData = enhancedData.filter(item => item.total_items >= filters.min_items!);
      }

      if (filters.max_items !== undefined) {
        enhancedData = enhancedData.filter(item => item.total_items <= filters.max_items!);
      }

      // Apply sorting
      enhancedData.sort((a, b) => {
        const aVal = a[sort.field];
        const bVal = b[sort.field];
        const multiplier = sort.direction === 'asc' ? 1 : -1;
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal) * multiplier;
        }
        
        return ((aVal as number) - (bVal as number)) * multiplier;
      });
      
      console.log('Enhanced categories processed:', enhancedData.length);
      return enhancedData;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });
}

export function useCategoryHierarchy() {
  return useQuery({
    queryKey: ['category-hierarchy'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_hierarchy_view')
        .select('*')
        .order('full_path');
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function useEnhancedCategoryMutations() {
  const queryClient = useQueryClient();

  const createCategory = useMutation({
    mutationFn: async (category: Partial<EnhancedCategory>) => {
      // Validate before creating
      if (category.category_name) {
        const { data: validation } = await supabase.rpc('validate_category_data', {
          p_category_name: category.category_name,
          p_category_code: category.category_code || null,
          p_parent_id: category.parent_category_id || null
        });

        const validationResult = validation as { valid: boolean; errors?: string[] };
        if (validationResult && !validationResult.valid) {
          throw new Error(validationResult.errors?.[0] || 'Validation failed');
        }
      }

      const { data, error } = await supabase
        .from('satguru_categories')
        .insert([{
          category_name: category.category_name,
          description: category.description,
          category_code: category.category_code,
          parent_category_id: category.parent_category_id,
          category_type: category.category_type || 'STANDARD',
          sort_order: category.sort_order || 0,
          business_rules: category.business_rules || {},
          metadata: category.metadata || {}
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-categories'] });
      queryClient.invalidateQueries({ queryKey: ['category-hierarchy'] });
      // Refresh materialized view
      supabase.rpc('refresh_category_stats');
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
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EnhancedCategory> }) => {
      const { data, error } = await supabase
        .from('satguru_categories')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
          last_modified_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-categories'] });
      queryClient.invalidateQueries({ queryKey: ['category-hierarchy'] });
      supabase.rpc('refresh_category_stats');
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

  const bulkUpdateCategories = useMutation({
    mutationFn: async (operations: Array<{ action: string; [key: string]: any }>) => {
      const { data, error } = await supabase.rpc('bulk_update_categories', {
        p_operations: operations
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-categories'] });
      queryClient.invalidateQueries({ queryKey: ['category-hierarchy'] });
      supabase.rpc('refresh_category_stats');
      
      const result = data as { success: number; failed: number; errors?: any[] };
      
      if (result.success > 0) {
        toast({ 
          title: "Success", 
          description: `Successfully processed ${result.success} operations${result.failed > 0 ? `, ${result.failed} failed` : ''}` 
        });
      }
      
      if (result.failed > 0) {
        console.error('Bulk operation errors:', result.errors);
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to perform bulk operations",
        variant: "destructive" 
      });
    }
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('satguru_categories')
        .update({ 
          is_active: false, 
          updated_at: new Date().toISOString(),
          last_modified_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-categories'] });
      queryClient.invalidateQueries({ queryKey: ['category-hierarchy'] });
      supabase.rpc('refresh_category_stats');
      toast({ title: "Success", description: "Category deactivated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete category",
        variant: "destructive" 
      });
    }
  });

  return { 
    createCategory, 
    updateCategory, 
    deleteCategory, 
    bulkUpdateCategories 
  };
}

export function useCategoryAnalytics() {
  return useQuery({
    queryKey: ['category-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_stats_mv')
        .select('*');
      
      if (error) throw error;

      const categories = data || [];
      
      // Calculate analytics
      const totalCategories = categories.length;
      const totalItems = categories.reduce((sum, cat) => sum + cat.total_items, 0);
      const totalFGItems = categories.reduce((sum, cat) => sum + cat.fg_items, 0);
      const totalRMItems = categories.reduce((sum, cat) => sum + cat.rm_items, 0);
      const avgItemsPerCategory = totalCategories > 0 ? totalItems / totalCategories : 0;
      const totalValue = categories.reduce((sum, cat) => sum + (cat.avg_item_value * cat.total_items), 0);
      
      // Top categories by different metrics
      const topCategoriesByItems = [...categories]
        .sort((a, b) => b.total_items - a.total_items)
        .slice(0, 5);
        
      const topCategoriesByValue = [...categories]
        .sort((a, b) => (b.avg_item_value * b.total_items) - (a.avg_item_value * a.total_items))
        .slice(0, 5);

      return {
        totalCategories,
        totalItems,
        totalFGItems,
        totalRMItems,
        avgItemsPerCategory: Math.round(avgItemsPerCategory * 100) / 100,
        totalValue: Math.round(totalValue * 100) / 100,
        topCategoriesByItems,
        topCategoriesByValue,
        fgRmRatio: totalRMItems > 0 ? totalFGItems / totalRMItems : 0
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });
}