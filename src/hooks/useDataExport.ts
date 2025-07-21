
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { format } from "date-fns";
import { useExportProgress } from "./useExportProgress";

export interface ExportOptions {
  dateFrom?: string;
  dateTo?: string;
  supplier?: string;
  purpose?: string;
  search?: string;
}

export interface ExportData {
  filename: string;
  data: any[];
}

// Paginated export helper function
async function exportDataInChunks<T>(
  tableName: string,
  selectClause: string,
  filters: ExportOptions,
  transformData: (data: any[]) => T[],
  chunkSize: number = 1000,
  onProgress?: (current: number, total: number, recordsProcessed: number) => void
): Promise<T[]> {
  // First, get the total count
  let countQuery = supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  // Apply filters to count query
  if (filters.search) {
    if (tableName === 'satguru_grn_log') {
      countQuery = countQuery.or(`grn_number.ilike.%${filters.search}%,item_code.ilike.%${filters.search}%,vendor.ilike.%${filters.search}%`);
    } else if (tableName === 'satguru_issue_log') {
      countQuery = countQuery.or(`item_code.ilike.%${filters.search}%,purpose.ilike.%${filters.search}%`);
    }
  }
  
  if (filters.supplier && tableName === 'satguru_grn_log') {
    countQuery = countQuery.ilike('vendor', `%${filters.supplier}%`);
  }
  
  if (filters.purpose && tableName === 'satguru_issue_log') {
    countQuery = countQuery.ilike('purpose', `%${filters.purpose}%`);
  }
  
  if (filters.dateFrom) {
    countQuery = countQuery.gte('date', filters.dateFrom);
  }
  
  if (filters.dateTo) {
    countQuery = countQuery.lte('date', filters.dateTo);
  }

  // Exclude opening stock from GRN count
  if (tableName === 'satguru_grn_log') {
    countQuery = countQuery.not('transaction_type', 'eq', 'OPENING_STOCK');
  }

  const { count, error: countError } = await countQuery;
  
  if (countError) {
    console.error('Count query error:', countError);
    throw countError;
  }

  if (!count || count === 0) {
    return [];
  }

  console.log(`Total records to export: ${count}`);

  // Calculate number of chunks
  const totalChunks = Math.ceil(count / chunkSize);
  let allData: any[] = [];
  let recordsProcessed = 0;

  // Export data in chunks
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = start + chunkSize - 1;

    console.log(`Fetching chunk ${chunkIndex + 1}/${totalChunks} (records ${start}-${Math.min(end, count - 1)})`);

    let dataQuery = supabase
      .from(tableName)
      .select(selectClause)
      .range(start, end)
      .order('created_at', { ascending: false });

    // Apply same filters to data query
    if (filters.search) {
      if (tableName === 'satguru_grn_log') {
        dataQuery = dataQuery.or(`grn_number.ilike.%${filters.search}%,item_code.ilike.%${filters.search}%,vendor.ilike.%${filters.search}%`);
      } else if (tableName === 'satguru_issue_log') {
        dataQuery = dataQuery.or(`item_code.ilike.%${filters.search}%,purpose.ilike.%${filters.search}%`);
      }
    }
    
    if (filters.supplier && tableName === 'satguru_grn_log') {
      dataQuery = dataQuery.ilike('vendor', `%${filters.supplier}%`);
    }
    
    if (filters.purpose && tableName === 'satguru_issue_log') {
      dataQuery = dataQuery.ilike('purpose', `%${filters.purpose}%`);
    }
    
    if (filters.dateFrom) {
      dataQuery = dataQuery.gte('date', filters.dateFrom);
    }
    
    if (filters.dateTo) {
      dataQuery = dataQuery.lte('date', filters.dateTo);
    }

    // Exclude opening stock from GRN data
    if (tableName === 'satguru_grn_log') {
      dataQuery = dataQuery.not('transaction_type', 'eq', 'OPENING_STOCK');
    }

    const { data: chunkData, error: chunkError } = await dataQuery;
    
    if (chunkError) {
      console.error(`Chunk ${chunkIndex + 1} error:`, chunkError);
      throw chunkError;
    }

    if (chunkData && chunkData.length > 0) {
      allData = allData.concat(chunkData);
      recordsProcessed += chunkData.length;
    }

    // Update progress
    if (onProgress) {
      onProgress(chunkIndex + 1, totalChunks, recordsProcessed);
    }

    // Small delay to prevent overwhelming the database
    if (chunkIndex < totalChunks - 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  console.log(`Successfully fetched ${allData.length} records in ${totalChunks} chunks`);

  // Transform the data
  return transformData(allData);
}

// Export GRN data to Excel with pagination
export function useGRNExport() {
  const { progress, startExport, updateProgress, finishExport, resetProgress } = useExportProgress();

  const mutation = useMutation({
    mutationFn: async (options: ExportOptions = {}): Promise<ExportData> => {
      console.log('Starting paginated GRN export with options:', options);

      // Reset progress
      resetProgress();

      const transformData = (data: any[]) => {
        // Get categories for lookup
        return supabase
          .from('satguru_categories')
          .select('id, category_name')
          .then(({ data: categories }) => {
            const categoryMap = new Map(
              categories?.map(cat => [cat.id, cat.category_name]) || []
            );

            return data.map(grn => ({
              'GRN Number': grn.grn_number,
              'Date': format(new Date(grn.date), 'dd/MM/yyyy'),
              'Item Code': grn.item_code,
              'Item Name': grn.satguru_item_master?.item_name || '',
              'Quantity Received': grn.qty_received,
              'UOM': grn.satguru_item_master?.uom || '',
              'Vendor': grn.vendor || '',
              'Invoice Number': grn.invoice_number || '',
              'Amount (INR)': grn.amount_inr || '',
              'Remarks': grn.remarks || '',
              'Created Date': format(new Date(grn.created_at), 'dd/MM/yyyy HH:mm')
            }));
          });
      };

      // Count total records first
      let countQuery = supabase
        .from('satguru_grn_log')
        .select('*', { count: 'exact', head: true })
        .not('transaction_type', 'eq', 'OPENING_STOCK');

      if (options.search) {
        countQuery = countQuery.or(`grn_number.ilike.%${options.search}%,item_code.ilike.%${options.search}%,vendor.ilike.%${options.search}%`);
      }
      if (options.supplier) {
        countQuery = countQuery.ilike('vendor', `%${options.supplier}%`);
      }
      if (options.dateFrom) {
        countQuery = countQuery.gte('date', options.dateFrom);
      }
      if (options.dateTo) {
        countQuery = countQuery.lte('date', options.dateTo);
      }

      const { count } = await countQuery;
      
      if (!count || count === 0) {
        throw new Error("No GRN records found to export");
      }

      // Start progress tracking
      startExport(count, 1000);

      const exportData = await exportDataInChunks(
        'satguru_grn_log',
        `
          grn_number,
          date,
          item_code,
          qty_received,
          vendor,
          invoice_number,
          amount_inr,
          remarks,
          created_at,
          satguru_item_master (
            item_name,
            uom
          )
        `,
        options,
        async (data) => {
          // Get categories for lookup
          const { data: categories } = await supabase
            .from('satguru_categories')
            .select('id, category_name');

          const categoryMap = new Map(
            categories?.map(cat => [cat.id, cat.category_name]) || []
          );

          return data.map(grn => ({
            'GRN Number': grn.grn_number,
            'Date': format(new Date(grn.date), 'dd/MM/yyyy'),
            'Item Code': grn.item_code,
            'Item Name': grn.satguru_item_master?.item_name || '',
            'Quantity Received': grn.qty_received,
            'UOM': grn.satguru_item_master?.uom || '',
            'Vendor': grn.vendor || '',
            'Invoice Number': grn.invoice_number || '',
            'Amount (INR)': grn.amount_inr || '',
            'Remarks': grn.remarks || '',
            'Created Date': format(new Date(grn.created_at), 'dd/MM/yyyy HH:mm')
          }));
        },
        1000,
        (currentChunk, totalChunks, recordsProcessed) => {
          updateProgress(currentChunk, recordsProcessed);
        }
      );

      const dateRange = options.dateFrom || options.dateTo 
        ? `_${options.dateFrom || 'start'}_to_${options.dateTo || 'end'}`
        : '';
      
      const filename = `GRN_Export${dateRange}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      
      finishExport();
      
      return { filename, data: exportData };
    },
    onSuccess: ({ filename, data }) => {
      // Create and download Excel file
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'GRN Data');
      
      // Auto-fit column widths
      const colWidths = Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length))
      }));
      ws['!cols'] = colWidths;
      
      XLSX.writeFile(wb, filename);
      
      toast({
        title: "Export Successful",
        description: `GRN data exported to ${filename} (${data.length} records)`
      });
      
      resetProgress();
    },
    onError: (error: any) => {
      console.error('GRN export failed:', error);
      toast({
        title: "Export Failed", 
        description: error.message || "Failed to export GRN data",
        variant: "destructive"
      });
      resetProgress();
    }
  });

  return {
    ...mutation,
    progress,
    resetProgress
  };
}

// Export Stock Issues data to Excel with pagination
export function useStockIssueExport() {
  const { progress, startExport, updateProgress, finishExport, resetProgress } = useExportProgress();

  const mutation = useMutation({
    mutationFn: async (options: ExportOptions = {}): Promise<ExportData> => {
      console.log('Starting paginated stock issue export with options:', options);

      // Reset progress
      resetProgress();

      // Count total records first
      let countQuery = supabase
        .from('satguru_issue_log')
        .select('*', { count: 'exact', head: true });

      if (options.search) {
        countQuery = countQuery.or(`item_code.ilike.%${options.search}%,purpose.ilike.%${options.search}%`);
      }
      if (options.purpose) {
        countQuery = countQuery.ilike('purpose', `%${options.purpose}%`);
      }
      if (options.dateFrom) {
        countQuery = countQuery.gte('date', options.dateFrom);
      }
      if (options.dateTo) {
        countQuery = countQuery.lte('date', options.dateTo);
      }

      const { count } = await countQuery;
      
      if (!count || count === 0) {
        throw new Error("No stock issue records found to export");
      }

      // Start progress tracking
      startExport(count, 1000);

      const exportData = await exportDataInChunks(
        'satguru_issue_log',
        `
          date,
          item_code,
          qty_issued,
          purpose,
          total_issued_qty,
          remarks,
          created_at,
          satguru_item_master (
            item_name,
            uom
          )
        `,
        options,
        (data) => {
          return data.map(issue => ({
            'Date': format(new Date(issue.date), 'dd/MM/yyyy'),
            'Item Code': issue.item_code,
            'Item Name': issue.satguru_item_master?.item_name || '',
            'Quantity Issued': issue.qty_issued,
            'UOM': issue.satguru_item_master?.uom || '',
            'Purpose': issue.purpose || '',
            'Total Issued Qty': issue.total_issued_qty || '',
            'Remarks': issue.remarks || '',
            'Created Date': format(new Date(issue.created_at), 'dd/MM/yyyy HH:mm')
          }));
        },
        1000,
        (currentChunk, totalChunks, recordsProcessed) => {
          updateProgress(currentChunk, recordsProcessed);
        }
      );

      const dateRange = options.dateFrom || options.dateTo 
        ? `_${options.dateFrom || 'start'}_to_${options.dateTo || 'end'}`
        : '';
      
      const filename = `Stock_Issues_Export${dateRange}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      
      finishExport();
      
      return { filename, data: exportData };
    },
    onSuccess: ({ filename, data }) => {
      console.log(`Stock issues export successful: ${data.length} records exported to ${filename}`);
      
      // Create and download Excel file
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Issues');
      
      // Auto-fit column widths
      const colWidths = Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length))
      }));
      ws['!cols'] = colWidths;
      
      XLSX.writeFile(wb, filename);
      
      toast({
        title: "Export Successful",
        description: `Stock issues data exported to ${filename} (${data.length} records)`
      });
      
      resetProgress();
    },
    onError: (error: any) => {
      console.error('Stock issues export failed:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export stock issues data", 
        variant: "destructive"
      });
      resetProgress();
    }
  });

  return {
    ...mutation,
    progress,
    resetProgress
  };
}

// Export Stock Movement Summary Report with pagination
export function useStockMovementExport() {
  const { progress, startExport, updateProgress, finishExport, resetProgress } = useExportProgress();

  const mutation = useMutation({
    mutationFn: async (options: ExportOptions = {}): Promise<ExportData> => {
      console.log('Starting paginated stock movement export with options:', options);

      // Reset progress
      resetProgress();

      // Start with a small progress indication
      startExport(2, 1); // We'll have 2 main queries (GRN and Issues)

      // Get GRN data with pagination
      const grnData = await exportDataInChunks(
        'satguru_grn_log',
        'item_code, qty_received, date, satguru_item_master(item_name)',
        {
          dateFrom: options.dateFrom || '2024-01-01',
          dateTo: options.dateTo || format(new Date(), 'yyyy-MM-dd')
        },
        (data) => data,
        2000 // Larger chunks for aggregation
      );

      updateProgress(1, grnData.length);

      // Get Issues data with pagination
      const issueData = await exportDataInChunks(
        'satguru_issue_log',
        'item_code, qty_issued, date, satguru_item_master(item_name)',
        {
          dateFrom: options.dateFrom || '2024-01-01',
          dateTo: options.dateTo || format(new Date(), 'yyyy-MM-dd')
        },
        (data) => data,
        2000 // Larger chunks for aggregation
      );

      // Aggregate movement data by item
      const movementMap = new Map();
      
      grnData.forEach(grn => {
        const key = grn.item_code;
        if (!movementMap.has(key)) {
          movementMap.set(key, {
            item_code: grn.item_code,
            item_name: grn.satguru_item_master?.item_name || '',
            total_received: 0,
            total_issued: 0
          });
        }
        movementMap.get(key).total_received += grn.qty_received;
      });

      issueData.forEach(issue => {
        const key = issue.item_code;
        if (!movementMap.has(key)) {
          movementMap.set(key, {
            item_code: issue.item_code,
            item_name: issue.satguru_item_master?.item_name || '',
            total_received: 0,
            total_issued: 0
          });
        }
        movementMap.get(key).total_issued += issue.qty_issued;
      });
      
      const movements = Array.from(movementMap.values()).map(item => ({
        'Item Code': item.item_code,
        'Item Name': item.item_name,
        'Total Received': item.total_received || 0,
        'Total Issued': item.total_issued || 0,
        'Net Movement': (item.total_received || 0) - (item.total_issued || 0)
      }));
      
      const filename = `Stock_Movement_Summary_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      
      finishExport();
      
      return { filename, data: movements };
    },
    onSuccess: ({ filename, data }) => {
      // Create workbook with multiple sheets
      const wb = XLSX.utils.book_new();
      
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Movement Summary');
      
      // Auto-fit column widths
      const colWidths = Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length))
      }));
      ws['!cols'] = colWidths;
      
      XLSX.writeFile(wb, filename);
      
      toast({
        title: "Export Successful",
        description: `Stock movement summary exported to ${filename} (${data.length} items)`
      });
      
      resetProgress();
    },
    onError: (error: any) => {
      console.error('Stock movement export failed:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export stock movement summary",
        variant: "destructive"
      });
      resetProgress();
    }
  });

  return {
    ...mutation,
    progress,
    resetProgress
  };
}
