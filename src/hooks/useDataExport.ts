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
  category?: string;
}

export interface ExportData {
  filename: string;
  data: any[];
}

// Export GRN data to Excel with pagination
export function useGRNExport() {
  const { progress, startExport, updateProgress, finishExport, resetProgress } = useExportProgress();

  const mutation = useMutation({
    mutationFn: async (options: ExportOptions = {}): Promise<ExportData> => {
      console.log('Starting paginated GRN export with options:', options);

      // Reset progress
      resetProgress();

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

      // Export data in chunks
      const chunkSize = 1000;
      const totalChunks = Math.ceil(count / chunkSize);
      let allData: any[] = [];
      let recordsProcessed = 0;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = start + chunkSize - 1;

        console.log(`Fetching chunk ${chunkIndex + 1}/${totalChunks} (records ${start}-${Math.min(end, count - 1)})`);

        let dataQuery = supabase
          .from('satguru_grn_log')
          .select(`
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
          `)
          .range(start, end)
          .order('created_at', { ascending: false })
          .not('transaction_type', 'eq', 'OPENING_STOCK');

        // Apply same filters to data query
        if (options.search) {
          dataQuery = dataQuery.or(`grn_number.ilike.%${options.search}%,item_code.ilike.%${options.search}%,vendor.ilike.%${options.search}%`);
        }
        if (options.supplier) {
          dataQuery = dataQuery.ilike('vendor', `%${options.supplier}%`);
        }
        if (options.dateFrom) {
          dataQuery = dataQuery.gte('date', options.dateFrom);
        }
        if (options.dateTo) {
          dataQuery = dataQuery.lte('date', options.dateTo);
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
        updateProgress(chunkIndex + 1, recordsProcessed);

        // Small delay to prevent overwhelming the database
        if (chunkIndex < totalChunks - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      console.log(`Successfully fetched ${allData.length} records in ${totalChunks} chunks`);

      // Transform the data
      const exportData = allData.map(grn => ({
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

      // Export data in chunks
      const chunkSize = 1000;
      const totalChunks = Math.ceil(count / chunkSize);
      let allData: any[] = [];
      let recordsProcessed = 0;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = start + chunkSize - 1;

        console.log(`Fetching chunk ${chunkIndex + 1}/${totalChunks} (records ${start}-${Math.min(end, count - 1)})`);

        let dataQuery = supabase
          .from('satguru_issue_log')
          .select(`
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
          `)
          .range(start, end)
          .order('created_at', { ascending: false });

        // Apply same filters to data query
        if (options.search) {
          dataQuery = dataQuery.or(`item_code.ilike.%${options.search}%,purpose.ilike.%${options.search}%`);
        }
        if (options.purpose) {
          dataQuery = dataQuery.ilike('purpose', `%${options.purpose}%`);
        }
        if (options.dateFrom) {
          dataQuery = dataQuery.gte('date', options.dateFrom);
        }
        if (options.dateTo) {
          dataQuery = dataQuery.lte('date', options.dateTo);
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
        updateProgress(chunkIndex + 1, recordsProcessed);

        // Small delay to prevent overwhelming the database
        if (chunkIndex < totalChunks - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      console.log(`Successfully fetched ${allData.length} records in ${totalChunks} chunks`);

      // Transform the data
      const exportData = allData.map(issue => ({
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

      // Get GRN data
      const { data: grnData, error: grnError } = await supabase
        .from('satguru_grn_log')
        .select('item_code, qty_received, date, satguru_item_master(item_name)')
        .gte('date', options.dateFrom || '2024-01-01')
        .lte('date', options.dateTo || format(new Date(), 'yyyy-MM-dd'))
        .not('transaction_type', 'eq', 'OPENING_STOCK');

      if (grnError) throw grnError;

      updateProgress(1, grnData?.length || 0);

      // Get Issues data
      const { data: issueData, error: issueError } = await supabase
        .from('satguru_issue_log')
        .select('item_code, qty_issued, date, satguru_item_master(item_name)')
        .gte('date', options.dateFrom || '2024-01-01')
        .lte('date', options.dateTo || format(new Date(), 'yyyy-MM-dd'));

      if (issueError) throw issueError;

      // Aggregate movement data by item
      const movementMap = new Map();
      
      (grnData || []).forEach(grn => {
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

      (issueData || []).forEach(issue => {
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

// Export Stock Valuation data to Excel with detailed pricing information
export function useStockValuationExport() {
  const { progress, startExport, updateProgress, finishExport, resetProgress } = useExportProgress();

  const mutation = useMutation({
    mutationFn: async (options: ExportOptions = {}): Promise<ExportData> => {
      console.log('Starting stock valuation export with options:', options);

      // Reset progress
      resetProgress();
      startExport(1, 1);

      try {
        // Get stock valuation data using the same source as the UI
        let query = supabase
          .from("satguru_stock_summary_view")
          .select("*");

        // Apply filters
        if (options.category) {
          query = query.eq("category_name", options.category);
        }

        const { data: stockData, error: stockError } = await query;
        if (stockError) throw stockError;

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
            .gte("date", "2024-01-01") // Filter out corrupt future dates
            .lte("date", "2025-12-31")
            .order("date", { ascending: false })
        ]);

        // Create pricing lookup map
        const pricingMap = new Map<string, { unitPrice: number; source: string; lastDate: string; isReasonable: boolean }>();
        
        // Prioritize pricing master data
        if (pricingMasterData.data) {
          pricingMasterData.data.forEach(price => {
            pricingMap.set(price.item_code, {
              unitPrice: price.current_price,
              source: 'Manual (Pricing Master)',
              lastDate: price.effective_date,
              isReasonable: price.current_price <= 10000 // Flag unreasonable prices
            });
          });
        }

        // Fill gaps with GRN data for items not in pricing master
        if (grnData.data) {
          grnData.data.forEach(grn => {
            if (!pricingMap.has(grn.item_code) && grn.qty_received > 0) {
              const unitPrice = (grn.amount_inr || 0) / grn.qty_received;
              if (unitPrice > 0) {
                pricingMap.set(grn.item_code, {
                  unitPrice,
                  source: 'GRN Calculated',
                  lastDate: grn.date,
                  isReasonable: unitPrice <= 10000
                });
              }
            }
          });
        }

        // Transform data to match the valuation table
        const exportData = (stockData || []).map(item => {
          const pricing = pricingMap.get(item.item_code);
          const unitPrice = pricing?.unitPrice || 0;
          const currentQty = Number(item.current_qty) || 0;
          const totalValue = currentQty * unitPrice;
          
          // Calculate stock age
          const stockAgeDays = pricing?.lastDate 
            ? Math.floor((new Date().getTime() - new Date(pricing.lastDate).getTime()) / (1000 * 60 * 60 * 24))
            : 999;

          return {
            'Item Code': item.item_code || '',
            'Item Name': item.item_name || '',
            'Category': item.category_name || '',
            'Current Quantity': currentQty,
            'UOM': item.uom || '',
            'Unit Price (INR)': unitPrice,
            'Price Source': pricing?.source || 'No Price Data',
            'Total Value (INR)': totalValue,
            'Stock Age (Days)': stockAgeDays,
            'Price Quality': pricing?.isReasonable === false ? 'HIGH PRICE ALERT' : 
                           unitPrice === 0 ? 'NO PRICE DATA' : 'NORMAL',
            'Last Price Date': pricing?.lastDate || 'N/A'
          };
        });

        // Sort by total value descending (same as UI)
        exportData.sort((a, b) => b['Total Value (INR)'] - a['Total Value (INR)']);

        // Calculate summary metrics
        const totalItems = exportData.length;
        const totalValue = exportData.reduce((sum, item) => sum + item['Total Value (INR)'], 0);
        const itemsWithoutPrices = exportData.filter(item => item['Unit Price (INR)'] === 0).length;
        const highPriceAlerts = exportData.filter(item => item['Price Quality'] === 'HIGH PRICE ALERT').length;

        const filename = `Stock_Valuation_Export_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
        
        finishExport();
        
        return { 
          filename, 
          data: exportData,
          summary: {
            totalItems,
            totalValue,
            itemsWithoutPrices,
            highPriceAlerts,
            exportTimestamp: new Date().toISOString(),
            filters: options
          }
        };
      } catch (error) {
        console.error('Stock valuation export error:', error);
        throw error;
      }
    },
    onSuccess: ({ filename, data, summary }) => {
      console.log(`Stock valuation export successful: ${data.length} records exported to ${filename}`);
      
      // Create workbook with main data and summary sheet
      const wb = XLSX.utils.book_new();
      
      // Main data sheet
      const ws = XLSX.utils.json_to_sheet(data);
      
      // Auto-fit column widths
      const colWidths = Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.slice(0, 100).map(row => String(row[key] || '').length))
      }));
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Valuation');
      
      // Summary sheet
      const summaryData = [
        { Metric: 'Total Items', Value: summary.totalItems },
        { Metric: 'Total Value (INR)', Value: summary.totalValue },
        { Metric: 'Items Without Prices', Value: summary.itemsWithoutPrices },
        { Metric: 'High Price Alerts', Value: summary.highPriceAlerts },
        { Metric: 'Export Timestamp', Value: summary.exportTimestamp },
        { Metric: 'Category Filter', Value: summary.filters.category || 'All Categories' }
      ];
      
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
      
      XLSX.writeFile(wb, filename);
      
      toast({
        title: "Export Successful",
        description: `Stock valuation exported to ${filename} (${data.length} items, Total Value: ₹${summary.totalValue.toLocaleString()})`
      });
      
      resetProgress();
    },
    onError: (error: any) => {
      console.error('Stock valuation export failed:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export stock valuation data",
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
