
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useDebounce } from "./useDebounce";

export interface GRNFormData {
  grn_number: string;
  grn_date?: string;
  date?: string;
  item_code: string;
  qty_received: number;
  unit_price?: number;
  total_value?: number;
  supplier?: string;
  vendor?: string;
  invoice_number?: string;
  remarks?: string;
  amount_inr?: number;
  uom?: string;
}

export interface GRNFilters {
  search?: string;
  supplier?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface GRNSort {
  column: string;
  direction: 'asc' | 'desc';
}

export interface UseGRNOptions {
  page?: number;
  pageSize?: number;
  filters?: GRNFilters;
  sort?: GRNSort;
}

export function useOptimizedGRN(options: UseGRNOptions = {}) {
  const { page = 1, pageSize = 50, filters = {}, sort } = options;
  const queryClient = useQueryClient();
  
  // Debounce search input to prevent excessive queries
  const debouncedSearch = useDebounce(filters.search || '', 400);
  
  // Create optimized filters with debounced search
  const optimizedFilters = useMemo(() => ({
    ...filters,
    search: debouncedSearch
  }), [filters, debouncedSearch]);

  // Set up selective real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('grn-changes-optimized')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'satguru_grn_log'
        },
        (payload) => {
          // Only invalidate if we're on the first page and no active search
          if (page === 1 && !debouncedSearch) {
            queryClient.invalidateQueries({ queryKey: ['grn'] });
            queryClient.invalidateQueries({ queryKey: ['stock'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, page, debouncedSearch]);
  
  return useQuery({
    queryKey: ['grn', page, pageSize, optimizedFilters, sort],
    queryFn: async () => {
      let query = supabase
        .from('satguru_grn_log')
        .select(`
          *,
          satguru_item_master (
            item_name,
            uom
          )
        `, { count: 'exact' })
        .not('transaction_type', 'eq', 'OPENING_STOCK');

      // Apply filters - using correct column names (vendor instead of supplier)
      if (optimizedFilters.search) {
        query = query.or(`grn_number.ilike.%${optimizedFilters.search}%,item_code.ilike.%${optimizedFilters.search}%,vendor.ilike.%${optimizedFilters.search}%`);
      }
      
      if (optimizedFilters.supplier) {
        query = query.ilike('vendor', `%${optimizedFilters.supplier}%`);
      }
      
      if (optimizedFilters.dateFrom) {
        query = query.gte('date', optimizedFilters.dateFrom);
      }
      
      if (optimizedFilters.dateTo) {
        query = query.lte('date', optimizedFilters.dateTo);
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
        console.error('GRN Query Error:', error);
        throw error;
      }
      
      return {
        data: data || [],
        count: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
    // Optimized caching settings
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: false, // Remove aggressive refetching
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (failureCount < 2 && error?.message?.includes('network')) {
        return true;
      }
      return false;
    },
    enabled: true
  });
}

export function useGRNMutations() {
  const queryClient = useQueryClient();

  const createGRN = useMutation({
    mutationFn: async (grn: GRNFormData) => {
      const dbRecord = {
        grn_number: grn.grn_number,
        date: grn.grn_date || grn.date,
        item_code: grn.item_code,
        qty_received: grn.qty_received,
        vendor: grn.supplier || grn.vendor,
        invoice_number: grn.invoice_number,
        remarks: grn.remarks,
        amount_inr: grn.total_value || grn.amount_inr,
        uom: grn.uom || 'PCS',
      };

      const { data, error } = await supabase
        .from('satguru_grn_log')
        .insert([dbRecord])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['recent-grn'] });
      toast({ title: "Success", description: "GRN created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create GRN",
        variant: "destructive" 
      });
    }
  });

  const updateGRN = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { data, error } = await supabase
        .from('satguru_grn_log')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: "Success", description: "GRN updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update GRN",
        variant: "destructive" 
      });
    }
  });

  const deleteGRN = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('satguru_grn_log')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: "Success", description: "GRN deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete GRN",
        variant: "destructive" 
      });
    }
  });

  return {
    createGRN,
    updateGRN,
    deleteGRN
  };
}

// Auto-generate GRN number
export function useNextGRNNumber() {
  return useQuery({
    queryKey: ['next-grn-number'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const { data, error } = await supabase
        .from('satguru_grn_log')
        .select('grn_number')
        .like('grn_number', `SGRN${today}%`)
        .order('grn_number', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastNumber = data[0].grn_number;
        const lastSequence = parseInt(lastNumber.slice(-3));
        nextNumber = lastSequence + 1;
      }
      
      return `SGRN${today}${nextNumber.toString().padStart(3, '0')}`;
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000 // 2 minutes
  });
}
