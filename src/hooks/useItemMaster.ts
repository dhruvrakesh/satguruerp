import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ItemMasterFormData } from "@/schemas/itemMasterSchema";

// Hook for item selection (for order creation)
export const useItemsForSelection = () => {
  return useQuery({
    queryKey: ["items-for-selection"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("satguru_item_master")
        .select("item_code, item_name, uom, status, usage_type")
        .eq("is_active", true)
        .order("item_name");
      
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export interface ItemMasterFilters {
  search?: string;
  category_id?: string;
  status?: string;
  uom?: string;
  usage_type?: string;
}

export interface ItemMasterSort {
  column: string;
  direction: 'asc' | 'desc';
}

export interface UseItemMasterOptions {
  page?: number;
  pageSize?: number;
  filters?: ItemMasterFilters;
  sort?: ItemMasterSort;
}

export function useItemMaster(options: UseItemMasterOptions = {}) {
  const { page = 1, pageSize = 50, filters = {}, sort } = options;
  
  return useQuery({
    queryKey: ['itemMaster', page, pageSize, filters, sort],
    queryFn: async () => {
      console.log('Fetching satguru item master with options:', { page, pageSize, filters, sort });
      
      // First get the items
      let itemQuery = supabase
        .from('satguru_item_master')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters.search) {
        console.log('Applying search filter:', filters.search);
        itemQuery = itemQuery.or(`item_code.ilike.%${filters.search}%,item_name.ilike.%${filters.search}%`);
      }
      
      if (filters.category_id) {
        console.log('Applying category filter:', filters.category_id);
        itemQuery = itemQuery.eq('category_id', filters.category_id);
      }
      
      if (filters.status) {
        console.log('Applying status filter:', filters.status);
        itemQuery = itemQuery.eq('status', filters.status);
      }
      
      if (filters.uom) {
        console.log('Applying UOM filter:', filters.uom);
        itemQuery = itemQuery.eq('uom', filters.uom);
      }
      
      if (filters.usage_type) {
        console.log('Applying usage type filter:', filters.usage_type);
        itemQuery = itemQuery.eq('usage_type', filters.usage_type);
      }

      // Apply sorting
      if (sort) {
        itemQuery = itemQuery.order(sort.column, { ascending: sort.direction === 'asc' });
      } else {
        itemQuery = itemQuery.order('created_at', { ascending: false });
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      itemQuery = itemQuery.range(from, to);

      const { data: items, error: itemError, count } = await itemQuery;
      
      if (itemError) {
        console.error('Error fetching satguru item master:', itemError);
        throw itemError;
      }

      // Now get categories separately for the items that have category_id
      const categoryIds = items?.filter(item => item.category_id).map(item => item.category_id) || [];
      let categories: any[] = [];
      
      if (categoryIds.length > 0) {
        const { data: categoryData, error: categoryError } = await supabase
          .from('categories')
          .select('id, category_name')
          .in('id', categoryIds);
        
        if (!categoryError) {
          categories = categoryData || [];
        }
      }

      // Merge category data with items
      const itemsWithCategories = items?.map(item => ({
        ...item,
        category: item.category_id 
          ? categories.find(cat => cat.id === item.category_id) 
          : null
      })) || [];

      console.log('Satguru item master fetched:', itemsWithCategories?.length || 0, 'total:', count);
      
      return {
        data: itemsWithCategories,
        count: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
  });
}

export function useItemMasterMutations() {
  const queryClient = useQueryClient();

  const createItem = useMutation({
    mutationFn: async (item: ItemMasterFormData) => {
      const { data, error } = await supabase
        .from('satguru_item_master')
        .insert([item as any])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itemMaster'] });
      queryClient.invalidateQueries({ queryKey: ['categoriesWithStats'] });
      toast({ title: "Success", description: "Item created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create item",
        variant: "destructive" 
      });
    }
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { data, error } = await supabase
        .from('satguru_item_master')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itemMaster'] });
      queryClient.invalidateQueries({ queryKey: ['categoriesWithStats'] });
      toast({ title: "Success", description: "Item updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update item",
        variant: "destructive" 
      });
    }
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('satguru_item_master')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itemMaster'] });
      queryClient.invalidateQueries({ queryKey: ['categoriesWithStats'] });
      toast({ title: "Success", description: "Item deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete item",
        variant: "destructive" 
      });
    }
  });

  const deleteMultipleItems = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('satguru_item_master')
        .delete()
        .in('id', ids);
      
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['itemMaster'] });
      queryClient.invalidateQueries({ queryKey: ['categoriesWithStats'] });
      toast({ title: "Success", description: `${ids.length} items deleted successfully` });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete items",
        variant: "destructive" 
      });
    }
  });

  return {
    createItem,
    updateItem,
    deleteItem,
    deleteMultipleItems
  };
}
