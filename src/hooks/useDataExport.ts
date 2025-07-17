import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { format } from "date-fns";

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

// Export GRN data to Excel
export function useGRNExport() {
  return useMutation({
    mutationFn: async (options: ExportOptions = {}): Promise<ExportData> => {
      let query = supabase
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
        `);

      // Apply filters
      if (options.search) {
        query = query.or(`grn_number.ilike.%${options.search}%,item_code.ilike.%${options.search}%,vendor.ilike.%${options.search}%`);
      }
      
      if (options.supplier) {
        query = query.ilike('vendor', `%${options.supplier}%`);
      }
      
      if (options.dateFrom) {
        query = query.gte('date', options.dateFrom);
      }
      
      if (options.dateTo) {
        query = query.lte('date', options.dateTo);
      }

      query = query.order('date', { ascending: false });

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Transform data for export
      const exportData = data?.map(grn => ({
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
      })) || [];

      const dateRange = options.dateFrom || options.dateTo 
        ? `_${options.dateFrom || 'start'}_to_${options.dateTo || 'end'}`
        : '';
      
      const filename = `GRN_Export${dateRange}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      
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
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed", 
        description: error.message || "Failed to export GRN data",
        variant: "destructive"
      });
    }
  });
}

// Export Stock Issues data to Excel  
export function useStockIssueExport() {
  return useMutation({
    mutationFn: async (options: ExportOptions = {}): Promise<ExportData> => {
      let query = supabase
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
        `);

      // Apply filters
      if (options.search) {
        query = query.or(`item_code.ilike.%${options.search}%,purpose.ilike.%${options.search}%`);
      }
      
      if (options.purpose) {
        query = query.ilike('purpose', `%${options.purpose}%`);
      }
      
      if (options.dateFrom) {
        query = query.gte('date', options.dateFrom);
      }
      
      if (options.dateTo) {
        query = query.lte('date', options.dateTo);
      }

      query = query.order('date', { ascending: false });

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Transform data for export
      const exportData = data?.map(issue => ({
        'Date': format(new Date(issue.date), 'dd/MM/yyyy'),
        'Item Code': issue.item_code,
        'Item Name': issue.satguru_item_master?.item_name || '',
        'Quantity Issued': issue.qty_issued,
        'UOM': issue.satguru_item_master?.uom || '',
        'Purpose': issue.purpose || '',
        'Total Issued Qty': issue.total_issued_qty || '',
        'Remarks': issue.remarks || '',
        'Created Date': format(new Date(issue.created_at), 'dd/MM/yyyy HH:mm')
      })) || [];

      const dateRange = options.dateFrom || options.dateTo 
        ? `_${options.dateFrom || 'start'}_to_${options.dateTo || 'end'}`
        : '';
      
      const filename = `Stock_Issues_Export${dateRange}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      
      return { filename, data: exportData };
    },
    onSuccess: ({ filename, data }) => {
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
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export stock issues data", 
        variant: "destructive"
      });
    }
  });
}

// Export Stock Movement Summary Report
export function useStockMovementExport() {
  return useMutation({
    mutationFn: async (options: ExportOptions = {}): Promise<ExportData> => {
      // For now, create a summary from existing GRN and Issue data
      const { data: grnData, error: grnError } = await supabase
        .from('satguru_grn_log')
        .select('item_code, qty_received, date, satguru_item_master(item_name)')
        .gte('date', options.dateFrom || '2024-01-01')
        .lte('date', options.dateTo || format(new Date(), 'yyyy-MM-dd'));

      const { data: issueData, error: issueError } = await supabase
        .from('satguru_issue_log')
        .select('item_code, qty_issued, date, satguru_item_master(item_name)')
        .gte('date', options.dateFrom || '2024-01-01')
        .lte('date', options.dateTo || format(new Date(), 'yyyy-MM-dd'));
      
      if (grnError || issueError) throw grnError || issueError;
      
      // Aggregate movement data by item
      const movementMap = new Map();
      
      grnData?.forEach(grn => {
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

      issueData?.forEach(issue => {
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
      
      const movements = Array.from(movementMap.values());
      const filename = `Stock_Movement_Summary_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      
      return { filename, data: movements };
    },
    onSuccess: ({ filename, data }) => {
      // Create workbook with multiple sheets
      const wb = XLSX.utils.book_new();
      
      // Summary sheet
      const summaryData = data.map(item => ({
        'Item Code': item.item_code,
        'Item Name': item.item_name,
        'Total Received': item.total_received || 0,
        'Total Issued': item.total_issued || 0,
        'Net Movement': (item.total_received || 0) - (item.total_issued || 0)
      }));
      
      const ws = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Movement Summary');
      
      // Auto-fit column widths
      const colWidths = Object.keys(summaryData[0] || {}).map(key => ({
        wch: Math.max(key.length, ...summaryData.map(row => String(row[key] || '').length))
      }));
      ws['!cols'] = colWidths;
      
      XLSX.writeFile(wb, filename);
      
      toast({
        title: "Export Successful",
        description: `Stock movement summary exported to ${filename} (${data.length} items)`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export stock movement summary",
        variant: "destructive"
      });
    }
  });
}