
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
  const { valuationMethod = 'WEIGHTED_AVG' } = filters;

  const stockValuation = useQuery({
    queryKey: ["stock-valuation", filters],
    queryFn: async (): Promise<StockValuationData[]> => {
      // Get stock summary with pricing data
      let query = supabase
        .from("satguru_stock_summary_view")
        .select(`
          item_code,
          item_name,
          category_name,
          current_qty,
          reorder_level,
          stock_status
        `);

      // Apply category filter
      if (filters.category) {
        query = query.eq("category_name", filters.category);
      }

      const { data: stockData, error: stockError } = await query;
      if (stockError) throw stockError;

      // Get recent GRN data for pricing
      let grnQuery = supabase
        .from("satguru_grn_log")
        .select("item_code, amount_inr, qty_received, date, vendor")
        .order("date", { ascending: false });

      if (filters.dateFrom) {
        grnQuery = grnQuery.gte("date", filters.dateFrom);
      }
      if (filters.dateTo) {
        grnQuery = grnQuery.lte("date", filters.dateTo);
      }
      if (filters.supplier) {
        grnQuery = grnQuery.eq("vendor", filters.supplier);
      }

      const { data: grnData, error: grnError } = await grnQuery;
      if (grnError) throw grnError;

      // Calculate valuations based on method
      const valuationData: StockValuationData[] = [];

      stockData?.forEach(stock => {
        const itemGrnData = grnData?.filter(grn => grn.item_code === stock.item_code) || [];
        
        if (itemGrnData.length === 0) {
          // No pricing data available, use default values
          valuationData.push({
            item_code: stock.item_code,
            item_name: stock.item_name || '',
            category_name: stock.category_name || '',
            current_qty: stock.current_qty || 0,
            total_value: 0,
            avg_price: 0,
            stock_age_days: 0,
            valuation_method: valuationMethod
          });
          return;
        }

        let calculatedPrice = 0;
        let stockAgeDays = 0;

        // Calculate price based on valuation method
        switch (valuationMethod) {
          case 'FIFO':
            // First In, First Out - use oldest prices first
            const sortedOldest = itemGrnData.sort((a, b) => 
              new Date(a.date || '').getTime() - new Date(b.date || '').getTime()
            );
            const oldestEntry = sortedOldest[0];
            calculatedPrice = oldestEntry ? (oldestEntry.amount_inr || 0) / (oldestEntry.qty_received || 1) : 0;
            break;

          case 'LIFO':
            // Last In, First Out - use newest prices first
            const sortedNewest = itemGrnData.sort((a, b) => 
              new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
            );
            const newestEntry = sortedNewest[0];
            calculatedPrice = newestEntry ? (newestEntry.amount_inr || 0) / (newestEntry.qty_received || 1) : 0;
            break;

          case 'WEIGHTED_AVG':
          default:
            // Weighted Average - calculate based on quantities
            const totalValue = itemGrnData.reduce((sum, grn) => 
              sum + (grn.amount_inr || 0), 0
            );
            const totalQty = itemGrnData.reduce((sum, grn) => 
              sum + (grn.qty_received || 0), 0
            );
            calculatedPrice = totalQty > 0 ? totalValue / totalQty : 0;
            break;
        }

        // Calculate stock age (days since last GRN)
        const latestGrn = itemGrnData.sort((a, b) => 
          new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
        )[0];
        
        if (latestGrn?.date) {
          stockAgeDays = Math.floor(
            (new Date().getTime() - new Date(latestGrn.date).getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        const totalValue = calculatedPrice * (stock.current_qty || 0);

        // Apply value filters
        if (filters.minValue && totalValue < filters.minValue) return;
        if (filters.maxValue && totalValue > filters.maxValue) return;

        valuationData.push({
          item_code: stock.item_code,
          item_name: stock.item_name || '',
          category_name: stock.category_name || '',
          current_qty: stock.current_qty || 0,
          unit_price: calculatedPrice,
          total_value: totalValue,
          last_grn_price: latestGrn ? (latestGrn.amount_inr || 0) / (latestGrn.qty_received || 1) : undefined,
          avg_price: calculatedPrice,
          stock_age_days: stockAgeDays,
          valuation_method: valuationMethod
        });
      });

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
