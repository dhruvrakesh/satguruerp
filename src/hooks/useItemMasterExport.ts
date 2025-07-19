
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const useItemMasterExport = () => {
  const exportItemMasterToCSV = async (filters?: {
    category_id?: string;
    status?: string;
    usage_type?: string;
  }) => {
    try {
      console.log('Starting export with filters:', filters);
      
      // Build the base query for counting
      let countQuery = supabase
        .from('satguru_item_master')
        .select('*', { count: 'exact', head: true });

      // Apply filters to count query
      if (filters?.category_id && filters.category_id !== 'all') {
        countQuery = countQuery.eq('category_id', filters.category_id);
      }
      if (filters?.status && filters.status !== 'all') {
        countQuery = countQuery.eq('status', filters.status);
      }
      if (filters?.usage_type && filters.usage_type !== 'all') {
        countQuery = countQuery.eq('usage_type', filters.usage_type);
      }

      const { count, error: countError } = await countQuery;
      
      if (countError) {
        console.error('Count query error:', countError);
        throw countError;
      }
      
      console.log(`Total items to export: ${count}`);
      
      if (!count || count === 0) {
        toast({
          title: "No Data",
          description: "No items found to export with the current filters",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Export Started",
        description: `Preparing to export ${count} items...`,
      });

      // For better reliability, let's use a simpler approach with proper error handling
      let dataQuery = supabase
        .from('satguru_item_master')
        .select(`
          item_code,
          item_name,
          category_id,
          usage_type,
          uom,
          status,
          size_mm,
          gsm,
          specifications,
          created_at,
          updated_at
        `)
        .order('item_code');

      // Apply same filters to data query
      if (filters?.category_id && filters.category_id !== 'all') {
        dataQuery = dataQuery.eq('category_id', filters.category_id);
      }
      if (filters?.status && filters.status !== 'all') {
        dataQuery = dataQuery.eq('status', filters.status);
      }
      if (filters?.usage_type && filters.usage_type !== 'all') {
        dataQuery = dataQuery.eq('usage_type', filters.usage_type);
      }

      const { data: items, error: dataError } = await dataQuery;
      
      if (dataError) {
        console.error('Data query error:', dataError);
        throw dataError;
      }

      if (!items || items.length === 0) {
        toast({
          title: "No Data",
          description: "No items found to export",
          variant: "destructive"
        });
        return;
      }

      console.log(`Successfully fetched ${items.length} items`);

      // Get categories for lookup (separate query for better reliability)
      const { data: categories } = await supabase
        .from('satguru_categories')
        .select('id, category_name');

      const categoryMap = new Map(
        categories?.map(cat => [cat.id, cat.category_name]) || []
      );

      // Prepare CSV data with correct field mappings
      const csvData = items.map(item => ({
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        category: categoryMap.get(item.category_id) || '',
        usage_type: item.usage_type || '',
        dimensions: item.size_mm || '', // Map size_mm to dimensions for export
        gsm: item.gsm || '',
        uom: item.uom || '',
        status: item.status || '',
        specifications: item.specifications ? JSON.stringify(item.specifications) : '',
        created_at: item.created_at ? new Date(item.created_at).toLocaleDateString() : '',
        updated_at: item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ''
      }));

      // Generate CSV content with proper headers
      const headers = [
        'Item Code',
        'Item Name', 
        'Category',
        'Usage Type',
        'Dimensions',
        'GSM',
        'UOM',
        'Status',
        'Specifications',
        'Created Date',
        'Updated Date'
      ];

      const csvRows = csvData.map(row => 
        Object.values(row).map(value => {
          // Handle values that contain commas or quotes
          const stringValue = String(value || '');
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      );

      const csvContent = [headers.join(','), ...csvRows].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `satguru_item_master_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `${items.length} items exported to CSV successfully`,
      });

    } catch (error) {
      console.error('Export error details:', error);
      
      // Provide more specific error messages
      let errorMessage = "Failed to export item master data";
      if (error.message?.includes('permission')) {
        errorMessage = "Permission denied. Please check your access rights.";
      } else if (error.message?.includes('network')) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error.message?.includes('timeout')) {
        errorMessage = "Export timed out. Try reducing the data size with filters.";
      }
      
      toast({
        title: "Export Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return { exportItemMasterToCSV };
};
