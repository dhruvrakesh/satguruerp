
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";

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

export interface UseOptimizedStockIssuesOptions {
  page?: number;
  pageSize?: number;
  filters?: StockIssueFilters;
  sort?: StockIssueSort;
}

export function useOptimizedStockIssues(options: UseOptimizedStockIssuesOptions = {}) {
  const { page = 1, pageSize = 50, filters = {}, sort } = options;
  const queryClient = useQueryClient();
  
  // Debounce search to prevent excessive queries
  const debouncedSearch = useDebounce(filters.search || "", 400);
  
  // Create optimized filters with debounced search
  const optimizedFilters = {
    ...filters,
    search: debouncedSearch
  };
  
  // Set up selective real-time subscription for stock issue updates
  useEffect(() => {
    const channel = supabase
      .channel('optimized-issue-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'satguru_issue_log'
        },
        () => {
          // Selective invalidation - only invalidate if we have data
          queryClient.invalidateQueries({ 
            queryKey: ['optimized-stock-issues'],
            exact: false 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
  
  return useQuery({
    queryKey: ['optimized-stock-issues', page, pageSize, optimizedFilters, sort],
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
      if (optimizedFilters.search) {
        query = query.or(`item_code.ilike.%${optimizedFilters.search}%,purpose.ilike.%${optimizedFilters.search}%`);
      }
      
      if (optimizedFilters.purpose) {
        query = query.ilike('purpose', `%${optimizedFilters.purpose}%`);
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
      
      if (error) throw error;
      
      return {
        data: data || [],
        count: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useOptimizedStockIssueMutations() {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optimized-stock-issues'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['recent-issues'] });
      toast({ title: "Success", description: "Stock issue created successfully" });
    },
    onError: (error: any) => {
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
      queryClient.invalidateQueries({ queryKey: ['optimized-stock-issues'] });
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
      queryClient.invalidateQueries({ queryKey: ['optimized-stock-issues'] });
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
