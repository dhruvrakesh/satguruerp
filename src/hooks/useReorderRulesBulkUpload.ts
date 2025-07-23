import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReorderRuleRow {
  Item_Code: string;
  Supplier_Name: string;
  Minimum_Stock_Level: string;
  Reorder_Quantity: string;
  Safety_Stock_Level?: string;
  Consumption_Rate_Per_Day?: string;
  Lead_Time_Days: string;
}

interface ValidationError {
  rowNumber: number;
  reason: string;
  category: string;
}

export function useReorderRulesBulkUpload() {
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();

  const validateRow = async (row: ReorderRuleRow, rowIndex: number): Promise<ValidationError | null> => {
    // Check required fields
    if (!row.Item_Code?.trim()) {
      return { rowNumber: rowIndex, reason: "Item Code is required", category: "missing_data" };
    }
    
    if (!row.Supplier_Name?.trim()) {
      return { rowNumber: rowIndex, reason: "Supplier Name is required", category: "missing_data" };
    }

    if (!row.Minimum_Stock_Level?.trim()) {
      return { rowNumber: rowIndex, reason: "Minimum Stock Level is required", category: "missing_data" };
    }

    if (!row.Reorder_Quantity?.trim()) {
      return { rowNumber: rowIndex, reason: "Reorder Quantity is required", category: "missing_data" };
    }

    if (!row.Lead_Time_Days?.trim()) {
      return { rowNumber: rowIndex, reason: "Lead Time Days is required", category: "missing_data" };
    }

    // Validate numeric fields
    const minStock = parseFloat(row.Minimum_Stock_Level);
    const reorderQty = parseFloat(row.Reorder_Quantity);
    const safetyStock = row.Safety_Stock_Level ? parseFloat(row.Safety_Stock_Level) : 0;
    const consumptionRate = row.Consumption_Rate_Per_Day ? parseFloat(row.Consumption_Rate_Per_Day) : 0;
    const leadTime = parseInt(row.Lead_Time_Days);

    if (isNaN(minStock) || minStock <= 0) {
      return { rowNumber: rowIndex, reason: "Minimum Stock Level must be a positive number", category: "validation" };
    }

    if (isNaN(reorderQty) || reorderQty <= 0) {
      return { rowNumber: rowIndex, reason: "Reorder Quantity must be a positive number", category: "validation" };
    }

    if (row.Safety_Stock_Level && (isNaN(safetyStock) || safetyStock < 0)) {
      return { rowNumber: rowIndex, reason: "Safety Stock Level must be a non-negative number", category: "validation" };
    }

    if (row.Consumption_Rate_Per_Day && (isNaN(consumptionRate) || consumptionRate < 0)) {
      return { rowNumber: rowIndex, reason: "Consumption Rate Per Day must be a non-negative number", category: "validation" };
    }

    if (isNaN(leadTime) || leadTime <= 0) {
      return { rowNumber: rowIndex, reason: "Lead Time Days must be a positive integer", category: "validation" };
    }

    // Check if item exists
    const { data: item } = await supabase
      .from('satguru_item_master')
      .select('item_code')
      .eq('item_code', row.Item_Code.trim())
      .single();

    if (!item) {
      return { rowNumber: rowIndex, reason: `Item Code '${row.Item_Code}' not found in item master`, category: "not_found" };
    }

    // Check if supplier exists
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('id, is_active')
      .eq('supplier_name', row.Supplier_Name.trim())
      .single();

    if (!supplier) {
      return { rowNumber: rowIndex, reason: `Supplier '${row.Supplier_Name}' not found`, category: "not_found" };
    }

    if (!supplier.is_active) {
      return { rowNumber: rowIndex, reason: `Supplier '${row.Supplier_Name}' is inactive`, category: "validation" };
    }

    return null;
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setProgress(0);

      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            try {
              const rows = results.data as ReorderRuleRow[];
              const errors: ValidationError[] = [];
              const validRules: any[] = [];

              setProgress(10);

              // Validate all rows
              for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const validationError = await validateRow(row, i + 2); // +2 for header and 1-based indexing

                if (validationError) {
                  errors.push(validationError);
                } else {
                  // Get supplier ID
                  const { data: supplier } = await supabase
                    .from('suppliers')
                    .select('id')
                    .eq('supplier_name', row.Supplier_Name.trim())
                    .single();

                  validRules.push({
                    item_code: row.Item_Code.trim(),
                    supplier_id: supplier?.id,
                    minimum_stock_level: parseFloat(row.Minimum_Stock_Level),
                    reorder_quantity: parseFloat(row.Reorder_Quantity),
                    safety_stock_level: row.Safety_Stock_Level ? parseFloat(row.Safety_Stock_Level) : 0,
                    consumption_rate_per_day: row.Consumption_Rate_Per_Day ? parseFloat(row.Consumption_Rate_Per_Day) : 0,
                    lead_time_days: parseInt(row.Lead_Time_Days),
                  });
                }

                setProgress(10 + (i / rows.length) * 60);
              }

              setProgress(70);

              // Insert valid rules
              let successCount = 0;
              if (validRules.length > 0) {
                const { data, error } = await supabase
                  .from('reorder_rules')
                  .upsert(validRules, { 
                    onConflict: 'item_code,supplier_id',
                    ignoreDuplicates: false 
                  })
                  .select();

                if (error) {
                  console.error('Database error:', error);
                  throw new Error(`Database error: ${error.message}`);
                }

                successCount = data?.length || 0;
              }

              setProgress(90);

              // Log the upload (will work once types are regenerated)
              try {
                await supabase.from('procurement_csv_uploads' as any).insert({
                  upload_type: 'reorder_rules',
                  file_name: file.name,
                  total_rows: rows.length,
                  successful_rows: successCount,
                  failed_rows: errors.length,
                  error_details: errors.length > 0 ? { errors } : null,
                  status: 'completed'
                });
              } catch (logError) {
                console.warn('Failed to log upload:', logError);
              }

              setProgress(100);

              resolve({
                successCount,
                errorCount: errors.length,
                errors: errors,
                totalRows: rows.length
              });

            } catch (error) {
              console.error('Processing error:', error);
              reject(error);
            }
          },
          error: (error) => {
            console.error('CSV parsing error:', error);
            reject(new Error('Failed to parse CSV file'));
          }
        });
      });
    },
    onSuccess: () => {
      toast.success("Reorder rules uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ['reorder-rules'] });
      setProgress(0);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error("Failed to upload reorder rules");
      setProgress(0);
    }
  });

  return {
    uploadMutation,
    isProcessing: uploadMutation.isPending,
    progress
  };
}