import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ValuationData {
  item_code: string;
  item_name: string;
  category_name: string;
  current_qty: number;
  unit_cost: number;
  total_value: number;
  valuation_method: string;
  last_transaction_date: string;
  cost_layers: any;
}

export interface ValuationSummary {
  summary: {
    total_items: number;
    total_inventory_value: number;
    avg_item_value: number;
    high_value_items: number;
    medium_value_items: number;
    low_value_items: number;
  };
  category_breakdown: Array<{
    category_name: string;
    item_count: number;
    category_value: number;
    avg_unit_cost: number;
  }>;
  calculation_method: string;
  calculated_at: string;
  filters_applied: any;
}

export interface ValuationFilters {
  item_code?: string;
  valuation_method?: 'FIFO' | 'LIFO' | 'WEIGHTED_AVG';
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: any; // Allow additional properties
}

export interface BulkOperationResult {
  total_records: number;
  success_count: number;
  error_count: number;
  errors: Array<{
    item_code: string;
    error: string;
  }>;
}

export const useValuationManagement = () => {
  const queryClient = useQueryClient();

  // Get stock valuation data
  const getStockValuation = (filters: ValuationFilters = {}) => {
    return useQuery({
      queryKey: ['stock-valuation', filters],
      queryFn: async (): Promise<ValuationData[]> => {
        const { data, error } = await supabase.rpc('calculate_stock_valuation', {
          p_item_code: filters.item_code || null,
          p_valuation_method: filters.valuation_method || 'WEIGHTED_AVG',
          p_as_of_date: filters.dateTo || new Date().toISOString().split('T')[0]
        });

        if (error) {
          console.error('Stock valuation error:', error);
          throw error;
        }

        return data || [];
      },
      refetchInterval: 300000, // 5 minutes
    });
  };

  // Get valuation analytics
  const getValuationAnalytics = (filters: ValuationFilters = {}) => {
    return useQuery({
      queryKey: ['valuation-analytics', filters],
      queryFn: async (): Promise<ValuationSummary> => {
        const { data, error } = await supabase.rpc('get_valuation_analytics', {
          p_filters: filters as any
        });

        if (error) {
          console.error('Valuation analytics error:', error);
          throw error;
        }

        return (data as unknown) as ValuationSummary;
      },
      refetchInterval: 600000, // 10 minutes
    });
  };

  // Process bulk price updates
  const processBulkPriceUpdate = useMutation({
    mutationFn: async (priceData: any[]): Promise<BulkOperationResult> => {
      // Create bulk operation record
      const { data: operationData, error: operationError } = await supabase
        .from('valuation_bulk_operations')
        .insert({
          operation_type: 'PRICE_IMPORT',
          status: 'PROCESSING', 
          total_records: priceData.length,
          processed_records: 0,
          failed_records: 0,
          success_records: 0,
          file_name: 'bulk_price_update.csv',
          started_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (operationError) throw operationError;

      // Process the data
      const { data, error } = await supabase.rpc('process_bulk_price_update', {
        p_operation_id: operationData.id,
        p_price_data: priceData as any
      });

      if (error) throw error;

      return (data as unknown) as BulkOperationResult;
    },
    onSuccess: (result) => {
      toast({
        title: "Bulk Update Complete",
        description: `Successfully updated ${result.success_count} prices. ${result.error_count} errors.`,
        variant: result.error_count > 0 ? "destructive" : "default",
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['stock-valuation'] });
      queryClient.invalidateQueries({ queryKey: ['valuation-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['item-pricing'] });
    },
    onError: (error) => {
      console.error('Bulk update error:', error);
      toast({
        title: "Bulk Update Failed",
        description: error.message || "Failed to process bulk price update",
        variant: "destructive",
      });
    },
  });

  // Add single item price
  const addItemPrice = useMutation({
    mutationFn: async (priceData: {
      item_code: string;
      new_price: number;
      change_reason?: string;
      effective_date?: string;
    }) => {
      const { data, error } = await supabase
        .from('valuation_price_history')
        .insert({
          item_code: priceData.item_code,
          new_price: priceData.new_price,
          change_reason: priceData.change_reason || 'Manual entry',
          effective_date: priceData.effective_date || new Date().toISOString().split('T')[0],
          price_source: 'MANUAL'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Price Added",
        description: "Item price has been successfully added",
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['stock-valuation'] });
      queryClient.invalidateQueries({ queryKey: ['valuation-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['item-pricing'] });
    },
    onError: (error) => {
      console.error('Add price error:', error);
      toast({
        title: "Failed to Add Price",
        description: error.message || "Could not add item price",
        variant: "destructive",
      });
    },
  });

  // Get bulk operations history
  const getBulkOperations = () => {
    return useQuery({
      queryKey: ['bulk-operations'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('valuation_bulk_operations')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        return data;
      },
    });
  };

  // Export current pricing data
  const exportPricingData = useMutation({
    mutationFn: async (filters: ValuationFilters = {}) => {
      // Get current valuation data
      const { data: valuationData, error } = await supabase.rpc('calculate_stock_valuation', {
        p_item_code: filters.item_code || null,
        p_valuation_method: filters.valuation_method || 'WEIGHTED_AVG'
      });

      if (error) throw error;

      // Create export operation record
      await supabase
        .from('valuation_bulk_operations')
        .insert({
          operation_type: 'PRICE_EXPORT',
          status: 'COMPLETED',
          total_records: valuationData?.length || 0,
          processed_records: valuationData?.length || 0,
          failed_records: 0,
          success_records: valuationData?.length || 0,
          operation_summary: { 
            filters: filters as any, 
            exported_at: new Date().toISOString() 
          } as any,
          started_by: (await supabase.auth.getUser()).data.user?.id
        });

      return valuationData;
    },
    onSuccess: (data) => {
      // Convert to CSV and download
      const csvContent = convertToCSV(data);
      downloadCSV(csvContent, `stock_valuation_${new Date().toISOString().split('T')[0]}.csv`);
      
      toast({
        title: "Export Complete",
        description: `Exported ${data?.length || 0} records to CSV`,
      });
    },
    onError: (error) => {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export pricing data",
        variant: "destructive",
      });
    },
  });

  return {
    getStockValuation,
    getValuationAnalytics,
    processBulkPriceUpdate,
    addItemPrice,
    getBulkOperations,
    exportPricingData,
  };
};

// Helper functions
function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}