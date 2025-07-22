
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
        // Use established source of truth - satguru_stock_summary_view
        let query = supabase
          .from("satguru_stock_summary_view")
          .select("*");

        // Apply basic filters
        if (filters.category) {
          query = query.eq("category_name", filters.category);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Get pricing data from both pricing master and GRN logs
        const [pricingMasterData, grnData] = await Promise.all([
          supabase
            .from("item_pricing_master")
            .select("item_code, current_price, effective_date")
            .eq("is_active", true)
            .eq("approval_status", "APPROVED"),
          supabase
            .from("satguru_grn_log")
            .select("item_code, amount_inr, qty_received, date")
            .order("date", { ascending: false })
        ]);

        // Create pricing lookup map (prioritize pricing master over GRN prices)
        const pricingMap = new Map<string, { unitPrice: number; lastGrnPrice?: number; lastDate: string; source: 'MASTER' | 'GRN' }>();
        
        // First, populate with pricing master data
        if (pricingMasterData.data) {
          pricingMasterData.data.forEach(price => {
            pricingMap.set(price.item_code, {
              unitPrice: price.current_price,
              lastDate: price.effective_date,
              source: 'MASTER'
            });
          });
        }

        // Then fill gaps with GRN data for items not in pricing master
        if (grnData.data) {
          grnData.data.forEach(grn => {
            if (!pricingMap.has(grn.item_code) && grn.qty_received > 0) {
              const unitPrice = (grn.amount_inr || 0) / grn.qty_received;
              pricingMap.set(grn.item_code, {
                unitPrice,
                lastGrnPrice: unitPrice,
                lastDate: grn.date,
                source: 'GRN'
              });
            }
          });
        }

        // Transform data to match interface with calculated pricing
        const valuationData: StockValuationData[] = (data || []).map(item => {
          const pricing = pricingMap.get(item.item_code);
          const unitPrice = pricing?.unitPrice || 0;
          const currentQty = Number(item.current_qty) || 0;
          
          // Calculate stock age from last GRN date
          const stockAgeDays = pricing?.lastDate 
            ? Math.floor((new Date().getTime() - new Date(pricing.lastDate).getTime()) / (1000 * 60 * 60 * 24))
            : 999; // Default high value if no GRN data
          
          return {
            item_code: item.item_code || '',
            item_name: item.item_name || '',
            category_name: item.category_name || '',
            current_qty: currentQty,
            unit_price: unitPrice,
            total_value: currentQty * unitPrice,
            last_grn_price: pricing?.lastGrnPrice || undefined,
            avg_price: unitPrice, // Using latest GRN price as average for now
            stock_age_days: stockAgeDays,
            valuation_method: filters.valuationMethod || 'WEIGHTED_AVG'
          };
        });

        return valuationData.sort((a, b) => b.total_value - a.total_value);
      } catch (error) {
        console.error('Error fetching stock valuation:', error);
        // Return empty array on error instead of throwing
        return [];
      }
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
