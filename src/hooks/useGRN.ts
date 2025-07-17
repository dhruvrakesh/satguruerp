import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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

export function useGRN(options: UseGRNOptions = {}) {
  const { page = 1, pageSize = 50, filters = {}, sort } = options;
  const queryClient = useQueryClient();
  
  // Set up real-time subscription for GRN updates
  useEffect(() => {
    const channel = supabase
      .channel('grn-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'satguru_grn_log'
        },
        () => {
          // Invalidate and refetch GRN data when changes occur
          queryClient.invalidateQueries({ queryKey: ['grn'] });
          queryClient.invalidateQueries({ queryKey: ['stock'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
  
  return useQuery({
    queryKey: ['grn', page, pageSize, filters, sort],
    queryFn: async () => {
      let query = supabase
        .from('satguru_grn_log')
        .select(`
          *,
          satguru_item_master (
            item_name,
            uom
          )
        `, { count: 'exact' });

      // Apply filters
      if (filters.search) {
        query = query.or(`grn_number.ilike.%${filters.search}%,item_code.ilike.%${filters.search}%,supplier.ilike.%${filters.search}%`);
      }
      
      if (filters.supplier) {
        query = query.ilike('supplier', `%${filters.supplier}%`);
      }
      
      if (filters.dateFrom) {
        query = query.gte('grn_date', filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query = query.lte('grn_date', filters.dateTo);
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
      
      if (error) throw error;
      
      return {
        data: data || [],
        count: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
    refetchInterval: 30000,
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
    onMutate: async (newGRN) => {
      // Optimistic update - immediately show in UI
      await queryClient.cancelQueries({ queryKey: ['grn'] });
      
      const previousGRN = queryClient.getQueryData(['grn']);
      
      // Optimistically update the cache
      queryClient.setQueryData(['grn'], (old: any) => {
        if (!old) return old;
        
        const optimisticGRN = {
          id: `temp-${Date.now()}`,
          ...newGRN,
          date: newGRN.grn_date || newGRN.date,
          vendor: newGRN.supplier || newGRN.vendor,
          amount_inr: newGRN.total_value || newGRN.amount_inr,
          created_at: new Date().toISOString(),
          satguru_item_master: null
        };
        
        return {
          ...old,
          data: [optimisticGRN, ...old.data],
          count: old.count + 1
        };
      });
      
      return { previousGRN };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['recent-grn'] });
      toast({ title: "Success", description: "GRN created successfully" });
    },
    onError: (error: any, newGRN, context) => {
      // Rollback optimistic update on error
      if (context?.previousGRN) {
        queryClient.setQueryData(['grn'], context.previousGRN);
      }
      
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
    }
  });
}