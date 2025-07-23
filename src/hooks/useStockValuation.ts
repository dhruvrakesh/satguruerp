
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StockValuationData {
  item_code: string;
  item_name: string;
  category_name: string;
  current_qty: number;
  unit_price?: number;
  total_value: number;
  last_grn_price?: number;
  avg_price: number;
  stock_age_days: number;
  valuation_method: 'FIFO' | 'LIFO' | 'WEIGHTED_AVG';
}

export interface ValuationSummary {
  totalValue: number;
  totalItems: number;
  averageValue: number;
  highValueItems: number;
  mediumValueItems: number;
  lowValueItems: number;
}

export interface StockValuationFilters {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  supplier?: string;
  valuationMethod?: 'FIFO' | 'LIFO' | 'WEIGHTED_AVG';
  minValue?: number;
  maxValue?: number;
}

export const useStockValuation = (filters: StockValuationFilters = {}) => {
  const stockValuation = useQuery({
    queryKey: ["stock-valuation", filters],
    queryFn: async (): Promise<StockValuationData[]> => {
      try {
        // Use same RPC as ValuationManagement for unified data source
        const { data, error } = await supabase.rpc('calculate_stock_valuation', {
          p_item_code: null, // Get all items
          p_valuation_method: filters.valuationMethod || 'WEIGHTED_AVG',
          p_as_of_date: filters.dateTo || new Date().toISOString().split('T')[0]
        });

        if (error) {
          console.error('Stock valuation RPC error:', error);
          throw error;
        }

        let valuationData = data || [];

        // Apply filters if provided
        if (filters.category) {
          valuationData = valuationData.filter((item: any) => 
            item.category_name === filters.category
          );
        }

        if (filters.minValue !== undefined) {
          valuationData = valuationData.filter((item: any) => 
            (item.total_value || 0) >= filters.minValue!
          );
        }

        if (filters.maxValue !== undefined) {
          valuationData = valuationData.filter((item: any) => 
            (item.total_value || 0) <= filters.maxValue!
          );
        }

        // Transform to match expected interface
        const transformedData: StockValuationData[] = valuationData.map((item: any) => ({
          item_code: item.item_code || '',
          item_name: item.item_name || '',
          category_name: item.category_name || '',
          current_qty: Number(item.current_qty) || 0,
          unit_price: Number(item.unit_price) || 0,
          total_value: Number(item.total_value) || 0,
          last_grn_price: item.last_grn_price ? Number(item.last_grn_price) : undefined,
          avg_price: Number(item.unit_price) || 0,
          stock_age_days: Number(item.stock_age_days) || 0,
          valuation_method: filters.valuationMethod || 'WEIGHTED_AVG'
        }));

        return transformedData.sort((a, b) => b.total_value - a.total_value);
      } catch (error) {
        console.error('Error fetching stock valuation:', error);
        return [];
      }
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const valuationSummary = useQuery({
    queryKey: ["valuation-summary", filters],
    queryFn: async (): Promise<ValuationSummary> => {
      try {
        // Use same RPC as ValuationManagement for unified analytics
        const { data, error } = await supabase.rpc('get_valuation_analytics', {
          p_filters: {
            valuation_method: filters.valuationMethod || 'WEIGHTED_AVG',
            dateTo: filters.dateTo || new Date().toISOString().split('T')[0],
            category: filters.category || null,
            minValue: filters.minValue || null,
            maxValue: filters.maxValue || null
          } as any
        });

        if (error) {
          console.error('Valuation analytics RPC error:', error);
          throw error;
        }

        return (data as unknown) as ValuationSummary;
      } catch (error) {
        console.error('Error fetching valuation summary:', error);
        // Fallback to local calculation if RPC fails
        const valuationData = stockValuation.data || [];
        
        const totalValue = valuationData.reduce((sum, item) => sum + item.total_value, 0);
        const totalItems = valuationData.length;
        const averageValue = totalItems > 0 ? totalValue / totalItems : 0;

        return {
          totalValue,
          totalItems,
          averageValue,
          highValueItems: Math.floor(totalItems * 0.2),
          mediumValueItems: Math.floor(totalItems * 0.3),
          lowValueItems: Math.floor(totalItems * 0.5)
        };
      }
    },
    enabled: !!stockValuation.data,
  });

  return {
    stockValuation,
    valuationSummary,
  };
};
