
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
      // Fetch all item master data with related information
      let query = supabase
        .from('item_master')
        .select(`
          *,
          categories (
            category_name
          )
        `);

      // Apply filters if provided
      if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.usage_type) {
        query = query.eq('usage_type', filters.usage_type);
      }

      const { data: itemMasterData, error } = await query.order('item_code');

      if (error) throw error;

      if (!itemMasterData || itemMasterData.length === 0) {
        toast({
          title: "No Data",
          description: "No items found to export",
          variant: "destructive"
        });
        return;
      }

      // Prepare CSV data with all relevant fields
      const csvData = itemMasterData.map(item => ({
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        category: item.categories?.category_name || '',
        usage_type: item.usage_type || '',
        customer_name: item.customer_name || '',
        dimensions: item.dimensions || '',
        gsm: item.gsm || '',
        uom: item.uom || '',
        status: item.status || '',
        current_cost: item.current_cost || '',
        specifications: item.specifications ? JSON.stringify(item.specifications) : '',
        file_id: item.file_id || '',
        file_hyperlink: item.file_hyperlink || '',
        created_at: item.created_at ? new Date(item.created_at).toLocaleDateString() : '',
        updated_at: item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ''
      }));

      // Generate CSV content
      const headers = [
        'Item Code',
        'Item Name', 
        'Category',
        'Usage Type',
        'Customer Name',
        'Dimensions',
        'GSM',
        'UOM',
        'Status',
        'Current Cost',
        'Specifications',
        'File ID',
        'File Hyperlink',
        'Created Date',
        'Updated Date'
      ];

      const csvRows = csvData.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value
        ).join(',')
      );

      const csvContent = [headers.join(','), ...csvRows].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `item_master_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `${itemMasterData.length} items exported to CSV`,
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export item master data",
        variant: "destructive",
      });
    }
  };

  return { exportItemMasterToCSV };
};
