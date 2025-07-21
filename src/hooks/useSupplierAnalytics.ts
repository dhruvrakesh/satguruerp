
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SupplierPerformance {
  supplierId: string;
  supplierName: string;
  category: string;
  onTimeDeliveryRate: number;
  qualityScore: number;
  avgLeadTime: number;
  totalOrders: number;
  overallScore: number;
}

export interface SupplierFilters {
  category?: string;
  days?: number;
}

export interface SupplierSummary {
  totalSuppliers: number;
  avgOnTimeDelivery: number;
  avgLeadTime: number;
  qualityIssues: number;
}

export const useSupplierAnalytics = (filters: SupplierFilters = {}) => {
  const supplierAnalytics = useQuery({
    queryKey: ["supplier-analytics", filters],
    queryFn: async (): Promise<SupplierPerformance[]> => {
      // Mock data for now - replace with actual supplier data query
      return [
        {
          supplierId: "SUP001",
          supplierName: "ABC Suppliers",
          category: "raw_materials",
          onTimeDeliveryRate: 95.5,
          qualityScore: 92.0,
          avgLeadTime: 7.5,
          totalOrders: 45,
          overallScore: 93.75
        },
        {
          supplierId: "SUP002",
          supplierName: "XYZ Materials",
          category: "packaging",
          onTimeDeliveryRate: 88.2,
          qualityScore: 96.5,
          avgLeadTime: 12.0,
          totalOrders: 32,
          overallScore: 92.35
        }
      ];
    },
    staleTime: 15 * 60 * 1000,
  });

  const supplierSummary = useQuery({
    queryKey: ["supplier-summary", filters],
    queryFn: async (): Promise<SupplierSummary> => {
      const suppliers = supplierAnalytics.data || [];
      
      return {
        totalSuppliers: suppliers.length,
        avgOnTimeDelivery: suppliers.length > 0 
          ? suppliers.reduce((sum, s) => sum + s.onTimeDeliveryRate, 0) / suppliers.length 
          : 0,
        avgLeadTime: suppliers.length > 0 
          ? suppliers.reduce((sum, s) => sum + s.avgLeadTime, 0) / suppliers.length 
          : 0,
        qualityIssues: suppliers.filter(s => s.qualityScore < 90).length
      };
    },
    enabled: !!supplierAnalytics.data,
    staleTime: 15 * 60 * 1000,
  });

  return {
    supplierPerformance: supplierAnalytics,
    supplierSummary
  };
};
