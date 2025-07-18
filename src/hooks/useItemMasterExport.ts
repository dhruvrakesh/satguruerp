
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
      
      // First, get the total count
      let countQuery = supabase
        .from('item_master')
        .select('*', { count: 'exact', head: true });

      // Apply same filters to count query
      if (filters?.category_id) {
        countQuery = countQuery.eq('category_id', filters.category_id);
      }
      if (filters?.status) {
        countQuery = countQuery.eq('status', filters.status);
      }
      if (filters?.usage_type) {
        countQuery = countQuery.eq('usage_type', filters.usage_type);
      }

      const { count, error: countError } = await countQuery;
      
      if (countError) throw countError;
      
      console.log(`Total items to export: ${count}`);
      
      if (!count || count === 0) {
        toast({
          title: "No Data",
          description: "No items found to export",
          variant: "destructive"
        });
        return;
      }

      // Fetch all data in batches to overcome the 1000 limit
      const batchSize = 1000;
      const totalBatches = Math.ceil(count / batchSize);
      let allItems: any[] = [];

      toast({
        title: "Export in Progress",
        description: `Fetching ${count} items in ${totalBatches} batch(es)...`,
      });

      for (let batch = 0; batch < totalBatches; batch++) {
        const from = batch * batchSize;
        const to = from + batchSize - 1;
        
        console.log(`Fetching batch ${batch + 1}/${totalBatches}: rows ${from}-${to}`);

        let batchQuery = supabase
          .from('item_master')
          .select(`
            *,
            categories (
              category_name
            )
          `)
          .range(from, to)
          .order('item_code');

        // Apply filters to each batch
        if (filters?.category_id) {
          batchQuery = batchQuery.eq('category_id', filters.category_id);
        }
        if (filters?.status) {
          batchQuery = batchQuery.eq('status', filters.status);
        }
        if (filters?.usage_type) {
          batchQuery = batchQuery.eq('usage_type', filters.usage_type);
        }

        const { data: batchData, error: batchError } = await batchQuery;
        
        if (batchError) {
          console.error(`Error in batch ${batch + 1}:`, batchError);
          throw batchError;
        }
        
        allItems = [...allItems, ...(batchData || [])];
        console.log(`Batch ${batch + 1} completed. Total items so far: ${allItems.length}`);
      }

      console.log(`Successfully fetched all ${allItems.length} items`);

      // Prepare CSV data with all relevant fields
      const csvData = allItems.map(item => ({
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        category: item.categories?.category_name || '',
        usage_type: item.usage_type || '',
        customer_name: item.customer_name || '',
        dimensions: item.dimensions || '',
        gsm: item.gsm || '',
        uom: item.uom || '',
        status: item.status || '',
        current_cost: (item as any).current_cost || '',
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
        description: `${allItems.length} items exported to CSV (fetched in ${totalBatches} batch(es))`,
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
