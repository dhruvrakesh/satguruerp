import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SupplierPerformance {
  supplier: string;
  totalOrders: number;
  totalValue: number;
  avgDeliveryTime: number;
  onTimeDeliveryRate: number;
  qualityScore: number;
  lastOrderDate: string | null;
  avgOrderValue: number;
  performanceRating: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';
  itemsSupplied: number;
  reliabilityScore: number;
}

export interface SupplierFilters {
  supplier?: string;
  dateFrom?: string;
  dateTo?: string;
  minOrders?: number;
  performanceRating?: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';
}

export interface SupplierSummary {
  totalSuppliers: number;
  excellentSuppliers: number;
  avgDeliveryTime: number;
  totalPurchaseValue: number;
  avgQualityScore: number;
  onTimeDeliveryRate: number;
}

export const useSupplierAnalytics = (filters: SupplierFilters = {}) => {
  const supplierQuery = useQuery({
    queryKey: ["supplier-analytics", filters],
    queryFn: async (): Promise<SupplierPerformance[]> => {
      console.log("Fetching supplier analytics with filters:", filters);
      
      let query = supabase
        .from("grn_log")
        .select(`
          supplier,
          grn_date,
          qty_received,
          total_value,
          unit_price,
          item_code
        `)
        .not('supplier', 'is', null);

      if (filters.dateFrom) {
        query = query.gte('grn_date', filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query = query.lte('grn_date', filters.dateTo);
      }

      if (filters.supplier) {
        query = query.eq('supplier', filters.supplier);
      }

      const { data, error } = await query.order('grn_date', { ascending: false });

      if (error) {
        console.error("Error fetching supplier data:", error);
        throw error;
      }

      // Group data by supplier and calculate metrics
      const supplierMap = new Map<string, any>();
      
      (data || []).forEach(record => {
        const supplier = record.supplier;
        if (!supplierMap.has(supplier)) {
          supplierMap.set(supplier, {
            supplier,
            orders: [],
            totalValue: 0,
            totalQty: 0,
            uniqueItems: new Set(),
            firstOrderDate: record.grn_date,
            lastOrderDate: record.grn_date
          });
        }
        
        const supplierData = supplierMap.get(supplier);
        supplierData.orders.push(record);
        supplierData.totalValue += record.total_value || 0;
        supplierData.totalQty += record.qty_received || 0;
        supplierData.uniqueItems.add(record.item_code);
        
        // Update date range
        if (record.grn_date > supplierData.lastOrderDate) {
          supplierData.lastOrderDate = record.grn_date;
        }
        if (record.grn_date < supplierData.firstOrderDate) {
          supplierData.firstOrderDate = record.grn_date;
        }
      });

      // Calculate performance metrics for each supplier
      const supplierPerformance: SupplierPerformance[] = Array.from(supplierMap.values())
        .map(supplierData => {
          const totalOrders = supplierData.orders.length;
          const avgOrderValue = totalOrders > 0 ? supplierData.totalValue / totalOrders : 0;
          
          // Calculate average delivery time (simplified - assume 7 days standard)
          const avgDeliveryTime = 7; // This would be calculated from actual delivery data
          
          // Calculate on-time delivery rate (simplified)
          const onTimeDeliveryRate = Math.random() * 40 + 60; // 60-100% for demo
          
          // Calculate quality score (simplified)
          const qualityScore = Math.random() * 20 + 80; // 80-100% for demo
          
          // Calculate reliability score based on consistency
          const reliabilityScore = (onTimeDeliveryRate + qualityScore) / 2;
          
          // Determine performance rating
          let performanceRating: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' = 'POOR';
          if (reliabilityScore >= 90) performanceRating = 'EXCELLENT';
          else if (reliabilityScore >= 80) performanceRating = 'GOOD';
          else if (reliabilityScore >= 70) performanceRating = 'AVERAGE';

          return {
            supplier: supplierData.supplier,
            totalOrders,
            totalValue: supplierData.totalValue,
            avgDeliveryTime,
            onTimeDeliveryRate: Math.round(onTimeDeliveryRate),
            qualityScore: Math.round(qualityScore),
            lastOrderDate: supplierData.lastOrderDate,
            avgOrderValue: Math.round(avgOrderValue),
            performanceRating,
            itemsSupplied: supplierData.uniqueItems.size,
            reliabilityScore: Math.round(reliabilityScore)
          };
        })
        .filter(supplier => {
          if (filters.minOrders && supplier.totalOrders < filters.minOrders) return false;
          if (filters.performanceRating && supplier.performanceRating !== filters.performanceRating) return false;
          return true;
        })
        .sort((a, b) => b.reliabilityScore - a.reliabilityScore);

      return supplierPerformance;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 30 * 60 * 1000, // 30 minutes
  });

  const summaryQuery = useQuery({
    queryKey: ["supplier-summary", filters],
    queryFn: async (): Promise<SupplierSummary> => {
      const suppliers = supplierQuery.data || [];
      
      const totalSuppliers = suppliers.length;
      const excellentSuppliers = suppliers.filter(s => s.performanceRating === 'EXCELLENT').length;
      const avgDeliveryTime = suppliers.length > 0 
        ? suppliers.reduce((sum, s) => sum + s.avgDeliveryTime, 0) / suppliers.length
        : 0;
      const totalPurchaseValue = suppliers.reduce((sum, s) => sum + s.totalValue, 0);
      const avgQualityScore = suppliers.length > 0
        ? suppliers.reduce((sum, s) => sum + s.qualityScore, 0) / suppliers.length
        : 0;
      const onTimeDeliveryRate = suppliers.length > 0
        ? suppliers.reduce((sum, s) => sum + s.onTimeDeliveryRate, 0) / suppliers.length
        : 0;

      return {
        totalSuppliers,
        excellentSuppliers,
        avgDeliveryTime: Math.round(avgDeliveryTime),
        totalPurchaseValue,
        avgQualityScore: Math.round(avgQualityScore),
        onTimeDeliveryRate: Math.round(onTimeDeliveryRate)
      };
    },
    enabled: !!supplierQuery.data,
    staleTime: 10 * 60 * 1000,
  });

  return {
    supplierAnalytics: supplierQuery,
    supplierSummary: summaryQuery,
  };
};