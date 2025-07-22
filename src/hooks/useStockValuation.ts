
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
      // Use the enhanced stock valuation view
      let query = supabase
        .from("stock_valuation_enhanced")
        .select("*");

      // Apply filters
      if (filters.category) {
        query = query.eq("category_name", filters.category);
      }
      if (filters.supplier) {
        query = query.eq("supplier_code", filters.supplier);
      }
      if (filters.minValue) {
        query = query.gte("total_value", filters.minValue);
      }
      if (filters.maxValue) {
        query = query.lte("total_value", filters.maxValue);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform data to match interface
      const valuationData: StockValuationData[] = data?.map(item => ({
        item_code: item.item_code,
        item_name: item.item_name || '',
        category_name: item.category_name || '',
        current_qty: item.current_qty || 0,
        unit_price: item.unit_price || 0,
        total_value: item.total_value || 0,
        last_grn_price: item.grn_average_price,
        avg_price: item.unit_price || 0,
        stock_age_days: item.stock_age_days || 0,
        valuation_method: filters.valuationMethod || 'WEIGHTED_AVG'
      })) || [];

      return valuationData.sort((a, b) => b.total_value - a.total_value);
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const valuationSummary = useQuery({
    queryKey: ["valuation-summary", filters],
    queryFn: async (): Promise<ValuationSummary> => {
      const valuationData = stockValuation.data || [];
      
      const totalValue = valuationData.reduce((sum, item) => sum + item.total_value, 0);
      const totalItems = valuationData.length;
      const averageValue = totalItems > 0 ? totalValue / totalItems : 0;

      // Classify items by value (ABC-like classification)
      const sortedByValue = [...valuationData].sort((a, b) => b.total_value - a.total_value);
      const highValueThreshold = totalValue * 0.8; // Top items contributing to 80% of value
      const mediumValueThreshold = totalValue * 0.95; // Items contributing to next 15% of value

      let runningValue = 0;
      let highValueItems = 0;
      let mediumValueItems = 0;

      sortedByValue.forEach(item => {
        runningValue += item.total_value;
        if (runningValue <= highValueThreshold) {
          highValueItems++;
        } else if (runningValue <= mediumValueThreshold) {
          mediumValueItems++;
        }
      });

      const lowValueItems = totalItems - highValueItems - mediumValueItems;

      return {
        totalValue,
        totalItems,
        averageValue,
        highValueItems,
        mediumValueItems,
        lowValueItems
      };
    },
    enabled: !!stockValuation.data,
  });

  return {
    stockValuation,
    valuationSummary,
  };
};
