
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
  opening_stock: number;
  total_grns: number;
  total_issues: number;
  uom: string;
  // New fields from enhanced view
  legacy_baseline?: number;
  operational_grns?: number;
  operational_issues?: number;
  data_quality?: string;
  net_operational_movement?: number;
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

// Simple interface for stock calculation result
interface StockResult {
  item_code: string;
  item_name: string;
  opening_stock: number;
  total_grns: number;
  total_issues: number;
  current_stock: number;
  calculation_date: string;
  opening_stock_date: string;
  has_explicit_opening: boolean;
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
    queryKey: ['stock-summary-view', page, pageSize, optimizedFilters, sort],
    queryFn: async () => {
      try {
        console.log('Fetching stock summary from standardized view...');
        
        // Build the query from the standardized view
        let query = supabase
          .from('satguru_stock_summary_view')
          .select('*', { count: 'exact' });

        // Apply search filter
        if (optimizedFilters.search) {
          query = query.or(`item_code.ilike.%${optimizedFilters.search}%,item_name.ilike.%${optimizedFilters.search}%`);
        }

        // Apply category filter
        if (optimizedFilters.category && optimizedFilters.category !== 'all') {
          query = query.ilike('category_name', `%${optimizedFilters.category}%`);
        }

        // Apply stock status filter
        if (optimizedFilters.stockStatus && optimizedFilters.stockStatus !== 'all') {
          query = query.eq('stock_status', optimizedFilters.stockStatus);
        }

        // Apply quantity filters
        if (optimizedFilters.minQty !== undefined) {
          query = query.gte('current_qty', optimizedFilters.minQty);
        }
        if (optimizedFilters.maxQty !== undefined) {
          query = query.lte('current_qty', optimizedFilters.maxQty);
        }

        // Apply sorting
        if (sort) {
          const ascending = sort.direction === 'asc';
          query = query.order(sort.column, { ascending });
        } else {
          // Default sort by item_code
          query = query.order('item_code');
        }

        // Apply pagination
        const startIndex = (page - 1) * pageSize;
        query = query.range(startIndex, startIndex + pageSize - 1);

        const { data, error, count } = await query;

        if (error) {
          console.error('Error fetching stock summary:', error);
          throw error;
        }

        if (!data) {
          return {
            data: [],
            count: 0,
            totalPages: 0
          };
        }

        // Enhanced view already includes 30-day metrics, no need for extra queries
        const enrichedData = data.map((item: any) => {
          const record: StockSummaryRecord = {
            item_code: item.item_code,
            item_name: item.item_name,
            category_name: item.category_name || 'UNKNOWN',
            category_id: item.category_id || '',
            current_qty: Number(item.current_qty) || 0,
            received_30_days: Number(item.received_30_days) || 0,
            consumption_30_days: Number(item.consumption_30_days) || 0,
            reorder_level: Number(item.reorder_level) || 0,
            stock_status: item.stock_status,
            last_updated: item.last_updated,
            opening_stock: Number(item.opening_stock) || 0,
            total_grns: Number(item.total_grns) || 0,
            total_issues: Number(item.total_issues) || 0,
            uom: item.uom || 'KG',
            // Enhanced view fields
            legacy_baseline: Number(item.legacy_baseline) || 0,
            operational_grns: Number(item.operational_grns) || 0,
            operational_issues: Number(item.operational_issues) || 0,
            data_quality: item.data_quality || 'CLEAN',
            net_operational_movement: Number(item.net_operational_movement) || 0
          };

          return record;
        });

        const validResults = enrichedData.filter((result): result is StockSummaryRecord => result !== null);

        const totalCount = count || 0;
        const totalPages = Math.ceil(totalCount / pageSize);

        console.log(`✅ Retrieved ${validResults.length} stock records from standardized view`);
        
        return {
          data: validResults,
          count: totalCount,
          totalPages: totalPages
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
