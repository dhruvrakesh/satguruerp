
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

export interface StockSummaryRecord {
  item_code: string;
  item_name: string;
  category_name: string;
  category_id: string;
  current_qty: number;
  received_30_days: number;
  consumption_30_days: number;
  reorder_level: number;
  stock_status: string;
  last_updated: string;
  // These fields might be available via calculate_current_stock function
  opening_stock?: number;
  total_grns?: number;
  total_issues?: number;
  uom?: string;
}

export interface StockSummaryFilters {
  search?: string;
  category?: string;
  stockStatus?: string;
  minQty?: number;
  maxQty?: number;
  openingStockDate?: string;
}

export interface StockSummarySort {
  column: string;
  direction: 'asc' | 'desc';
}

export interface UseStockSummaryOptions {
  page?: number;
  pageSize?: number;
  filters?: StockSummaryFilters;
  sort?: StockSummarySort;
}

export function useStockSummary(options: UseStockSummaryOptions = {}) {
  const { page = 1, pageSize = 50, filters = {}, sort } = options;
  
  // Debounce search to prevent excessive queries
  const debouncedSearch = useDebounce(filters.search || "", 400);
  
  // Create optimized filters with debounced search
  const optimizedFilters = {
    ...filters,
    search: debouncedSearch
  };
  
  return useQuery({
    queryKey: ['stock-summary', page, pageSize, optimizedFilters, sort],
    queryFn: async () => {
      try {
        let query = supabase
          .from('satguru_stock_summary_view')
          .select('*', { count: 'exact' });

        // Apply search filter
        if (optimizedFilters.search) {
          query = query.or(`item_code.ilike.%${optimizedFilters.search}%,item_name.ilike.%${optimizedFilters.search}%`);
        }
        
        // Apply category filter
        if (optimizedFilters.category && optimizedFilters.category !== 'all') {
          query = query.eq('category_name', optimizedFilters.category);
        }
        
        // Apply stock status filter
        if (optimizedFilters.stockStatus && optimizedFilters.stockStatus !== 'all') {
          query = query.eq('stock_status', optimizedFilters.stockStatus);
        }
        
        // Apply quantity range filters
        if (optimizedFilters.minQty !== undefined) {
          query = query.gte('current_qty', optimizedFilters.minQty);
        }
        
        if (optimizedFilters.maxQty !== undefined) {
          query = query.lte('current_qty', optimizedFilters.maxQty);
        }

        // Apply sorting
        if (sort) {
          query = query.order(sort.column, { ascending: sort.direction === 'asc' });
        } else {
          query = query.order('item_code', { ascending: true });
        }

        // Apply pagination
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;
        
        if (error) {
          console.error('Stock summary query error:', error);
          throw error;
        }
        
        return {
          data: data || [],
          count: count || 0,
          totalPages: Math.ceil((count || 0) / pageSize)
        };
      } catch (error) {
        console.error('Stock summary hook error:', error);
        throw error;
      }
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute for real-time updates
  });
}

// Hook for getting categories for filter dropdown
export function useStockCategories() {
  return useQuery({
    queryKey: ['stock-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('satguru_stock_summary_view')
        .select('category_name')
        .not('category_name', 'is', null);
      
      if (error) throw error;
      
      const uniqueCategories = [...new Set(data?.map(item => item.category_name) || [])];
      return uniqueCategories.sort();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
