import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { ItemMasterFormData } from "@/schemas/itemMasterSchema";

// Hook for item selection (for order creation)
export const useItemsForSelection = () => {
  return useQuery({
    queryKey: ["items-for-selection"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_active_items_for_selection');
      if (error) throw error;
      return (data || []) as Array<{
        item_code: string;
        item_name: string;
        uom: string;
        status: string;
        usage_type: string;
      }>;
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
      
      try {
        // Build query step by step to avoid type issues, joining with categories
        const query = supabase.from('satguru_item_master');
        let selectQuery = query.select(`
          *,
          satguru_categories!inner(
            id,
            category_name
          )
        `, { count: 'exact' });

        // Apply filters - skip if value is "all" or empty
        if (filters.search && filters.search.trim() !== '') {
          console.log('Applying search filter:', filters.search);
          // Improved search: prioritize items starting with search term, then containing it
          const searchTerm = filters.search.toLowerCase();
          selectQuery = selectQuery.or(`item_code.ilike.${searchTerm}%,item_code.ilike.%${searchTerm}%,item_name.ilike.${searchTerm}%,item_name.ilike.%${searchTerm}%`);
        }
        
        if (filters.category_id && filters.category_id !== 'all') {
          console.log('Applying category filter:', filters.category_id);
          selectQuery = selectQuery.eq('category_id', filters.category_id);
        }
        
        if (filters.status && filters.status !== 'all') {
          console.log('Applying status filter:', filters.status);
          selectQuery = selectQuery.eq('status', filters.status);
        }
        
        if (filters.uom && filters.uom !== 'all') {
          console.log('Applying UOM filter:', filters.uom);
          selectQuery = selectQuery.eq('uom', filters.uom);
        }
        
        if (filters.usage_type && filters.usage_type !== 'all') {
          console.log('Applying usage type filter:', filters.usage_type);
          selectQuery = selectQuery.eq('usage_type', filters.usage_type);
        }

        // Apply sorting - prioritize items starting with search term if searching
        if (filters.search && filters.search.trim() !== '') {
          // For searches, order by relevance: exact matches first, then starts with, then contains
          selectQuery = selectQuery.order('item_code', { ascending: true });
        } else if (sort) {
          selectQuery = selectQuery.order(sort.column, { ascending: sort.direction === 'asc' });
        } else {
          selectQuery = selectQuery.order('created_at', { ascending: false });
        }

        // Apply pagination
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        selectQuery = selectQuery.range(from, to);

        const result = await selectQuery;
        
        if (result.error) {
          console.error('Error fetching satguru item master:', result.error);
          throw new Error(`Failed to fetch item master data: ${result.error.message}`);
        }

        const items = result.data || [];
        console.log('Satguru item master fetched:', items.length, 'total:', result.count);
        
        return {
          data: items,
          count: result.count || 0,
          totalPages: Math.ceil((result.count || 0) / pageSize)
        };
      } catch (error) {
        console.error('Failed to fetch item master data:', error);
        throw error;
      }
    },
    retry: (failureCount, error) => {
      // Retry up to 2 times for network errors, but not for permission errors
      if (failureCount >= 2) return false;
      if (error?.message?.includes('permission')) return false;
      return true;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes - items don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useItemMasterMutations() {
  const queryClient = useQueryClient();

  const createItem = useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase
        .from('satguru_item_master')
        .insert(item)
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
      console.error('Failed to create item:', error);
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
      console.error('Failed to update item:', error);
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
      console.error('Failed to delete item:', error);
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
      console.error('Failed to delete items:', error);
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
