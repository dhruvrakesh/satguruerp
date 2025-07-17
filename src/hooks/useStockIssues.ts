import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface StockIssueFormData {
  date: string;
  item_code: string;
  qty_issued: number;
  purpose?: string;
  total_issued_qty?: number;
  remarks?: string;
}

export interface StockIssueFilters {
  search?: string;
  purpose?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface StockIssueSort {
  column: string;
  direction: 'asc' | 'desc';
}

export interface UseStockIssuesOptions {
  page?: number;
  pageSize?: number;
  filters?: StockIssueFilters;
  sort?: StockIssueSort;
}

export function useStockIssues(options: UseStockIssuesOptions = {}) {
  const { page = 1, pageSize = 50, filters = {}, sort } = options;
  const queryClient = useQueryClient();
  
  // Set up real-time subscription for stock issue updates
  useEffect(() => {
    const channel = supabase
      .channel('issue-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'satguru_issue_log'
        },
        () => {
          // Invalidate and refetch issue data when changes occur
          queryClient.invalidateQueries({ queryKey: ['stock-issues'] });
          queryClient.invalidateQueries({ queryKey: ['stock'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
  
  return useQuery({
    queryKey: ['stock-issues', page, pageSize, filters, sort],
    queryFn: async () => {
      let query = supabase
        .from('satguru_issue_log')
        .select(`
          *,
          satguru_item_master (
            item_name,
            uom
          )
        `, { count: 'exact' });

      // Apply filters
      if (filters.search) {
        query = query.or(`item_code.ilike.%${filters.search}%,purpose.ilike.%${filters.search}%`);
      }
      
      if (filters.purpose) {
        query = query.ilike('purpose', `%${filters.purpose}%`);
      }
      
      if (filters.dateFrom) {
        query = query.gte('date', filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query = query.lte('date', filters.dateTo);
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

export function useStockIssueMutations() {
  const queryClient = useQueryClient();

  const createIssue = useMutation({
    mutationFn: async (issue: StockIssueFormData) => {
      // First validate stock availability
      const { data: stockData, error: stockError } = await supabase
        .rpc('satguru_validate_stock_transaction', {
          p_item_code: issue.item_code,
          p_transaction_type: 'ISSUE',
          p_quantity: issue.qty_issued
        });

      if (stockError) throw stockError;

      const { data, error } = await supabase
        .from('satguru_issue_log')
        .insert([issue])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: async (newIssue) => {
      // Optimistic update - immediately show in UI
      await queryClient.cancelQueries({ queryKey: ['stock-issues'] });
      
      const previousIssues = queryClient.getQueryData(['stock-issues']);
      
      // Optimistically update the cache
      queryClient.setQueryData(['stock-issues'], (old: any) => {
        if (!old) return old;
        
        const optimisticIssue = {
          id: `temp-${Date.now()}`,
          ...newIssue,
          created_at: new Date().toISOString(),
          satguru_item_master: null
        };
        
        return {
          ...old,
          data: [optimisticIssue, ...old.data],
          count: old.count + 1
        };
      });
      
      return { previousIssues };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-issues'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['recent-issues'] });
      toast({ title: "Success", description: "Stock issue created successfully" });
    },
    onError: (error: any, newIssue, context) => {
      // Rollback optimistic update on error
      if (context?.previousIssues) {
        queryClient.setQueryData(['stock-issues'], context.previousIssues);
      }
      
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create stock issue",
        variant: "destructive" 
      });
    }
  });

  const updateIssue = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { data, error } = await supabase
        .from('satguru_issue_log')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-issues'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: "Success", description: "Stock issue updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update stock issue",
        variant: "destructive" 
      });
    }
  });

  const deleteIssue = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('satguru_issue_log')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-issues'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      toast({ title: "Success", description: "Stock issue deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete stock issue",
        variant: "destructive" 
      });
    }
  });

  return {
    createIssue,
    updateIssue,
    deleteIssue
  };
}