import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LowStockItem {
  item_code: string;
  item_name: string;
  current_qty: number;
  reorder_level: number;
  reorder_qty: number;
  category_name: string;
  unit_of_measure: string;
  last_grn_date: string | null;
  last_issue_date: string | null;
  stock_status: string;
  urgency_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  shortage_qty: number;
  estimated_days_stock: number;
  avg_daily_consumption: number;
  suggested_order_qty: number;
}

export interface LowStockFilters {
  urgencyLevel?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category?: string;
  minShortage?: number;
  maxDaysStock?: number;
}

export interface LowStockSummary {
  totalLowStockItems: number;
  criticalItems: number;
  highPriorityItems: number;
  totalShortageValue: number;
  categoriesAffected: number;
  avgDaysToStockOut: number;
}

export const useLowStockAlerts = (filters: LowStockFilters = {}) => {
  const lowStockQuery = useQuery({
    queryKey: ["low-stock-alerts", filters],
    queryFn: async (): Promise<LowStockItem[]> => {
      console.log("Fetching low stock alerts with filters:", filters);
      
      let query = supabase
        .from("satguru_stock_summary_view")
        .select(`
          item_code,
          item_name,
          current_qty,
          reorder_level,
          category_name,
          stock_status,
          consumption_30_days,
          received_30_days,
          last_updated
        `)
        .in('stock_status', ['LOW', 'CRITICAL', 'OUT_OF_STOCK']);

      if (filters.category) {
        query = query.eq('category_name', filters.category);
      }

      const { data, error } = await query.order('current_qty', { ascending: true });

      if (error) {
        console.error("Error fetching low stock data:", error);
        throw error;
      }

      // Calculate additional metrics for each item
      const enhancedData = (data || []).map(item => {
        const shortage = Math.max(0, (item.reorder_level || 0) - (item.current_qty || 0));
        const avgDailyConsumption = (item.consumption_30_days || 0) / 30;
        const estimatedDaysStock = avgDailyConsumption > 0 ? (item.current_qty || 0) / avgDailyConsumption : 999;
        
        let urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        if (item.stock_status === 'OUT_OF_STOCK' || estimatedDaysStock <= 1) {
          urgencyLevel = 'CRITICAL';
        } else if (item.stock_status === 'CRITICAL' || estimatedDaysStock <= 7) {
          urgencyLevel = 'HIGH';
        } else if (estimatedDaysStock <= 14) {
          urgencyLevel = 'MEDIUM';
        }

        // Calculate suggested order quantity based on consumption pattern
        const bufferDays = 30; // 30 days buffer
        const bufferStock = avgDailyConsumption * bufferDays;
        const suggestedOrderQty = Math.max(
          (item.reorder_level || 100), // Default to reorder level
          shortage + bufferStock // Shortage plus buffer
        );

        return {
          ...item,
          reorder_qty: item.reorder_level || 100, // Default reorder qty
          unit_of_measure: 'Units', // Default unit
          last_grn_date: null, // Not available in view
          last_issue_date: null, // Not available in view
          urgency_level: urgencyLevel,
          shortage_qty: shortage,
          estimated_days_stock: Math.round(estimatedDaysStock),
          avg_daily_consumption: avgDailyConsumption,
          suggested_order_qty: Math.round(suggestedOrderQty)
        };
      });

      // Apply additional filters
      let filteredData = enhancedData;
      
      if (filters.urgencyLevel) {
        filteredData = filteredData.filter(item => item.urgency_level === filters.urgencyLevel);
      }
      
      if (filters.minShortage !== undefined) {
        filteredData = filteredData.filter(item => item.shortage_qty >= filters.minShortage);
      }
      
      if (filters.maxDaysStock !== undefined) {
        filteredData = filteredData.filter(item => item.estimated_days_stock <= filters.maxDaysStock);
      }

      return filteredData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
  });

  const summaryQuery = useQuery({
    queryKey: ["low-stock-summary", filters],
    queryFn: async (): Promise<LowStockSummary> => {
      const items = lowStockQuery.data || [];
      
      const totalLowStockItems = items.length;
      const criticalItems = items.filter(item => item.urgency_level === 'CRITICAL').length;
      const highPriorityItems = items.filter(item => item.urgency_level === 'HIGH').length;
      
      // Estimate shortage value (simplified calculation)
      const totalShortageValue = items.reduce((sum, item) => {
        // Assuming average cost of ₹100 per unit for estimation
        return sum + (item.shortage_qty * 100);
      }, 0);
      
      const categoriesAffected = new Set(items.map(item => item.category_name)).size;
      const avgDaysToStockOut = items.length > 0 
        ? items.reduce((sum, item) => sum + item.estimated_days_stock, 0) / items.length
        : 0;

      return {
        totalLowStockItems,
        criticalItems,
        highPriorityItems,
        totalShortageValue,
        categoriesAffected,
        avgDaysToStockOut: Math.round(avgDaysToStockOut)
      };
    },
    enabled: !!lowStockQuery.data,
    staleTime: 5 * 60 * 1000,
  });

  return {
    lowStockAlerts: lowStockQuery,
    lowStockSummary: summaryQuery,
  };
};
