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
        .from("item_master")
        .select("item_code, item_name, customer_name, uom, status, usage_type")
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
      console.log('Fetching item master with options:', { page, pageSize, filters, sort });
      
      let query = supabase
        .from('item_master')
        .select(`
          *,
          categories (
            id,
            category_name
          )
        `, { count: 'exact' });

      // Apply filters
      if (filters.search) {
        console.log('Applying search filter:', filters.search);
        query = query.or(`item_code.ilike.%${filters.search}%,item_name.ilike.%${filters.search}%`);
      }
      
      if (filters.category_id) {
        console.log('Applying category filter:', filters.category_id);
        query = query.eq('category_id', filters.category_id);
      }
      
      if (filters.status) {
        console.log('Applying status filter:', filters.status);
        query = query.eq('status', filters.status);
      }
      
      if (filters.uom) {
        console.log('Applying UOM filter:', filters.uom);
        query = query.eq('uom', filters.uom);
      }
      
      if (filters.usage_type) {
        console.log('Applying usage type filter:', filters.usage_type);
        query = query.eq('usage_type', filters.usage_type);
      }

      // Apply sorting
      if (sort) {
        query = query.order(sort.column, { ascending: sort.direction === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      
      if (error) {
        console.error('Error fetching item master:', error);
        throw error;
      }

      console.log('Item master fetched:', data?.length || 0, 'total:', count);
      console.log('Sample item with category:', data?.[0]);
      
      return {
        data: data || [],
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
        .from('item_master')
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
        .from('item_master')
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
        .from('item_master')
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
        .from('item_master')
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
