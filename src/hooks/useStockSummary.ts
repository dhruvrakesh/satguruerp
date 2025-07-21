
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
  // These fields are now available via the new calculation function
  opening_stock: number;
  total_grns: number;
  total_issues: number;
  uom: string;
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
    queryKey: ['stock-summary-calculated', page, pageSize, optimizedFilters, sort],
    queryFn: async () => {
      try {
        console.log('Fetching stock summary with accurate calculation...');
        
        // Use the new database function for accurate stock calculation
        const { data, error } = await supabase.rpc('get_stock_summary_with_calculation', {
          p_limit: pageSize,
          p_offset: (page - 1) * pageSize,
          p_search: optimizedFilters.search || null,
          p_category: (optimizedFilters.category && optimizedFilters.category !== 'all') ? optimizedFilters.category : null,
          p_stock_status: (optimizedFilters.stockStatus && optimizedFilters.stockStatus !== 'all') ? optimizedFilters.stockStatus : null,
          p_min_qty: optimizedFilters.minQty || null,
          p_max_qty: optimizedFilters.maxQty || null,
          p_opening_stock_date: optimizedFilters.openingStockDate || '2024-01-01'
        });
        
        if (error) {
          console.error('Stock summary query error:', error);
          throw error;
        }
        
        console.log(`✅ Retrieved ${data?.length || 0} stock records with accurate calculation`);
        
        // Get total count from the first record (all records have the same total_count)
        const totalCount = data && data.length > 0 ? data[0].total_count : 0;
        
        return {
          data: data || [],
          count: totalCount,
          totalPages: Math.ceil(totalCount / pageSize)
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
        .from('categories')
        .select('category_name')
        .eq('is_active', true);
      
      if (error) throw error;
      
      const uniqueCategories = [...new Set(data?.map(item => item.category_name) || [])];
      return uniqueCategories.sort();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
