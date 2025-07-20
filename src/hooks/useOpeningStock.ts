
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export interface UseOpeningStockOptions {
  page?: number;
  pageSize?: number;
  filters?: OpeningStockFilters;
  sort?: OpeningStockSort;
}

export function useOpeningStock(options: UseOpeningStockOptions = {}) {
  const { page = 1, pageSize = 50, filters = {}, sort } = options;
  
  return useQuery({
    queryKey: ['opening-stock', page, pageSize, filters, sort],
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

        // Filter by opening stock using existing vendor field
        query = query.eq('vendor', 'Opening Stock');

        // Apply filters
        if (filters.search) {
          query = query.or(`item_code.ilike.%${filters.search}%,remarks.ilike.%${filters.search}%`);
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
        
        if (error) {
          console.error('Opening stock query error:', error);
          throw error;
        }
        
        return {
          data: data || [],
          count: count || 0,
          totalPages: Math.ceil((count || 0) / pageSize)
        };
      } catch (error) {
        console.error('Opening stock hook error:', error);
        throw error;
      }
    },
  });
}
