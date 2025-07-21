
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LowStockAlert {
  item_code: string;
  item_name: string;
  current_qty: number;
  reorder_level: number;
  stock_status: string;
  category_name: string;
  urgency_level: string;
  estimated_days_stock: number;
  shortage_qty: number;
  unit_of_measure: string;
  suggested_order_qty: number;
  avg_daily_consumption: number;
}

export interface LowStockFilters {
  urgencyLevel?: string;
  maxDaysStock?: number;
  minShortage?: number;
}

export interface LowStockSummary {
  totalLowStockItems: number;
  criticalItems: number;
  highPriorityItems: number;
  totalShortageValue: number;
  avgDaysToStockOut: number;
}

export const useLowStockAlerts = (filters: LowStockFilters = {}) => {
  const lowStockAlerts = useQuery({
    queryKey: ["low-stock-alerts", filters],
    queryFn: async (): Promise<LowStockAlert[]> => {
      try {
        let query = supabase
          .from("satguru_stock_summary_view")
          .select("*")
          .or("stock_status.eq.low_stock,stock_status.eq.out_of_stock,stock_status.eq.ZERO")
          .order("current_qty", { ascending: true });

        if (filters.maxDaysStock) {
          // Add filter logic for days stock when available
        }

        if (filters.minShortage) {
          // Add filter logic for shortage quantity when available
        }

        const { data, error } = await query.limit(100);

        if (error) {
          console.error("Low stock alerts query error:", error);
          throw error;
        }

        // Transform data to match expected interface
        const transformedData = (data || []).map(item => ({
          item_code: item.item_code,
          item_name: item.item_name || item.item_code,
          current_qty: item.current_qty || 0,
          reorder_level: item.reorder_level || 0,
          stock_status: item.stock_status || 'unknown',
          category_name: item.category_name || 'Uncategorized',
          urgency_level: item.current_qty === 0 ? 'CRITICAL' : 
                        item.current_qty <= (item.reorder_level || 0) * 0.5 ? 'HIGH' :
                        item.current_qty <= item.reorder_level ? 'MEDIUM' : 'LOW',
          estimated_days_stock: Math.max(0, Math.floor((item.current_qty || 0) / 1)), // Assuming 1 unit per day consumption
          shortage_qty: Math.max(0, (item.reorder_level || 0) - (item.current_qty || 0)),
          unit_of_measure: item.unit_of_measure || 'PCS',
          suggested_order_qty: Math.max(0, (item.reorder_level || 0) * 2 - (item.current_qty || 0)),
          avg_daily_consumption: 1 // Default consumption rate
        }));

        // Apply urgency level filter
        const filteredData = filters.urgencyLevel && filters.urgencyLevel !== 'all' 
          ? transformedData.filter(item => item.urgency_level === filters.urgencyLevel)
          : transformedData;

        return filteredData;
      } catch (error) {
        console.error("Low stock alerts fetch error:", error);
        throw error;
      }
    },
    refetchInterval: 30000,
  });

  const lowStockSummary = useQuery({
    queryKey: ["low-stock-summary", filters],
    queryFn: async (): Promise<LowStockSummary> => {
      try {
        const { data, error } = await supabase
          .from("satguru_stock_summary_view")
          .select("current_qty, reorder_level, stock_status")
          .or("stock_status.eq.low_stock,stock_status.eq.out_of_stock,stock_status.eq.ZERO");

        if (error) {
          console.error("Low stock summary query error:", error);
          throw error;
        }

        const items = data || [];
        const totalLowStockItems = items.length;
        const criticalItems = items.filter(item => (item.current_qty || 0) === 0).length;
        const highPriorityItems = items.filter(item => 
          (item.current_qty || 0) > 0 && 
          (item.current_qty || 0) <= ((item.reorder_level || 0) * 0.5)
        ).length;

        return {
          totalLowStockItems,
          criticalItems,
          highPriorityItems,
          totalShortageValue: 0, // Calculate based on your pricing logic
          avgDaysToStockOut: Math.round(
            items.reduce((sum, item) => sum + Math.max(0, (item.current_qty || 0)), 0) / Math.max(1, items.length)
          )
        };
      } catch (error) {
        console.error("Low stock summary fetch error:", error);
        throw error;
      }
    },
    refetchInterval: 30000,
  });

  return {
    lowStockAlerts,
    lowStockSummary
  };
};
