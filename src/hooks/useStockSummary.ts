
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
    queryKey: ['stock-summary-calculated', page, pageSize, optimizedFilters, sort],
    queryFn: async () => {
      try {
        console.log('Fetching stock summary with accurate calculation...');
        
        // Get all items from satguru_item_master with usage_type for categories
        const { data: items, error: itemsError } = await supabase
          .from('satguru_item_master')
          .select('item_code, item_name, category_id, uom, usage_type')
          .order('item_code');
        
        if (itemsError) {
          console.error('Error fetching items:', itemsError);
          throw itemsError;
        }

        if (!items || items.length === 0) {
          return {
            data: [],
            count: 0,
            totalPages: 0
          };
        }

        // Apply search filter if provided
        let filteredItems = items;
        if (optimizedFilters.search) {
          filteredItems = items.filter(item => 
            item.item_code.toLowerCase().includes(optimizedFilters.search!.toLowerCase()) ||
            item.item_name.toLowerCase().includes(optimizedFilters.search!.toLowerCase())
          );
        }

        // Calculate stock for each item
        const stockPromises = filteredItems.map(async (item) => {
          try {
            const { data: stockData, error: stockError } = await supabase
              .rpc('calculate_current_stock', {
                p_item_code: item.item_code,
                p_opening_stock_date: optimizedFilters.openingStockDate || '2024-01-01'
              });

            if (stockError) {
              console.error(`Error calculating stock for ${item.item_code}:`, stockError);
              return null;
            }

            // Simple casting to avoid TypeScript issues
            const stockResult = stockData as any;
            if (!stockResult) {
              return null;
            }

            const currentQty = Number(stockResult.current_stock) || 0;
            const openingStock = Number(stockResult.opening_stock) || 0;
            const totalGrns = Number(stockResult.total_grns) || 0;
            const totalIssues = Number(stockResult.total_issues) || 0;

            // Use usage_type as category instead of looking up category table
            const categoryName = item.usage_type || 'UNKNOWN';
            const displayCategory = categoryName.replace('_', ' ').toLowerCase()
              .replace(/\b\w/g, l => l.toUpperCase());

            // Calculate 30-day metrics
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: grnData } = await supabase
              .from('satguru_grn_log')
              .select('qty_received')
              .eq('item_code', item.item_code)
              .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

            const { data: issueData } = await supabase
              .from('satguru_issue_log')
              .select('qty_issued')
              .eq('item_code', item.item_code)
              .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

            const received30Days = grnData?.reduce((sum, grn) => sum + (grn.qty_received || 0), 0) || 0;
            const consumption30Days = issueData?.reduce((sum, issue) => sum + (issue.qty_issued || 0), 0) || 0;

            // Set default reorder level since column doesn't exist
            const reorderLevel = 0;

            // Determine stock status
            let stockStatus = 'normal';
            if (currentQty <= 0) stockStatus = 'out_of_stock';
            else if (currentQty <= reorderLevel) stockStatus = 'low_stock';
            else if (currentQty > reorderLevel * 3) stockStatus = 'overstock';

            const record: StockSummaryRecord = {
              item_code: item.item_code,
              item_name: item.item_name,
              category_name: displayCategory,
              category_id: item.category_id || '',
              current_qty: currentQty,
              received_30_days: received30Days,
              consumption_30_days: consumption30Days,
              reorder_level: reorderLevel,
              stock_status: stockStatus,
              last_updated: new Date().toISOString().split('T')[0],
              opening_stock: openingStock,
              total_grns: totalGrns,
              total_issues: totalIssues,
              uom: item.uom || 'KG'
            };

            return record;
          } catch (error) {
            console.error(`Error processing item ${item.item_code}:`, error);
            return null;
          }
        });

        const stockResults = await Promise.all(stockPromises);
        const validResults = stockResults.filter((result): result is StockSummaryRecord => result !== null);

        // Apply additional filters
        let finalResults = validResults;
        
        if (optimizedFilters.category && optimizedFilters.category !== 'all') {
          finalResults = finalResults.filter(item => 
            item.category_name.toLowerCase().includes(optimizedFilters.category!.toLowerCase())
          );
        }
        
        if (optimizedFilters.stockStatus && optimizedFilters.stockStatus !== 'all') {
          finalResults = finalResults.filter(item => item.stock_status === optimizedFilters.stockStatus);
        }
        
        if (optimizedFilters.minQty !== undefined) {
          finalResults = finalResults.filter(item => item.current_qty >= optimizedFilters.minQty!);
        }
        
        if (optimizedFilters.maxQty !== undefined) {
          finalResults = finalResults.filter(item => item.current_qty <= optimizedFilters.maxQty!);
        }

        // Apply sorting with proper numeric handling
        if (sort) {
          finalResults.sort((a, b) => {
            const aValue = a[sort.column as keyof StockSummaryRecord];
            const bValue = b[sort.column as keyof StockSummaryRecord];
            
            // Handle numeric columns specifically
            if (sort.column === 'current_qty' || sort.column === 'received_30_days' || 
                sort.column === 'consumption_30_days' || sort.column === 'opening_stock') {
              const aNum = Number(aValue) || 0;
              const bNum = Number(bValue) || 0;
              return sort.direction === 'asc' ? aNum - bNum : bNum - aNum;
            }
            
            // Handle string columns
            if (typeof aValue === 'string' && typeof bValue === 'string') {
              return sort.direction === 'asc' 
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
            }
            
            return 0;
          });
        }

        // Apply pagination
        const totalCount = finalResults.length;
        const totalPages = Math.ceil(totalCount / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedResults = finalResults.slice(startIndex, endIndex);

        console.log(`✅ Retrieved ${paginatedResults.length} stock records with accurate calculation`);
        
        return {
          data: paginatedResults,
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
