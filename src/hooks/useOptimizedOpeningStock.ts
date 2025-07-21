
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";

export interface OpeningStockRecord {
  id: string;
  item_code: string;
  qty_received: number;
  date: string;
  remarks?: string;
  created_at: string;
  satguru_item_master?: {
    item_name: string;
    uom: string;
  };
}

export interface OpeningStockFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface OpeningStockSort {
  column: string;
  direction: 'asc' | 'desc';
}

export interface UseOptimizedOpeningStockOptions {
  page?: number;
  pageSize?: number;
  filters?: OpeningStockFilters;
  sort?: OpeningStockSort;
}

export function useOptimizedOpeningStock(options: UseOptimizedOpeningStockOptions = {}) {
  const { page = 1, pageSize = 50, filters = {}, sort } = options;
  
  // Debounce search to prevent excessive queries
  const debouncedSearch = useDebounce(filters.search || "", 400);
  
  // Create optimized filters with debounced search
  const optimizedFilters = {
    ...filters,
    search: debouncedSearch
  };
  
  return useQuery({
    queryKey: ['optimized-opening-stock', page, pageSize, optimizedFilters, sort],
    queryFn: async () => {
      try {
        let query = supabase
          .from('satguru_grn_log')
          .select(`
            *,
            satguru_item_master (
              item_name,
              uom
            )
          `, { count: 'exact' });

        // Filter by opening stock using transaction_type column
        query = query.eq('transaction_type', 'OPENING_STOCK');

        // Apply filters
        if (optimizedFilters.search) {
          query = query.or(`item_code.ilike.%${optimizedFilters.search}%,remarks.ilike.%${optimizedFilters.search}%`);
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
          console.error('Optimized opening stock query error:', error);
          throw error;
        }
        
        return {
          data: data || [],
          count: count || 0,
          totalPages: Math.ceil((count || 0) / pageSize)
        };
      } catch (error) {
        console.error('Optimized opening stock hook error:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
