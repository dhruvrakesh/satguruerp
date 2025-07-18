import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface BOMUploadData {
  fg_item_code: string;
  rm_item_code: string;
  quantity_required: number;
  unit_of_measure: string;
  gsm_contribution: number;
  percentage_contribution: number;
  consumption_rate?: number;
  wastage_percentage?: number;
  customer_code?: string;
  notes?: string;
}

interface BOMUploadOptions {
  file: File;
  customerCode?: string;
  bomVersion?: number;
  notes?: string;
}

interface BOMUploadError {
  rowNumber: number;
  reason: string;
  data: any;
}

interface BOMUploadResult {
  successCount: number;
  errorCount: number;
  errors: BOMUploadError[];
}

export const useBOMBulkUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<BOMUploadResult | null>(null);
  const { toast } = useToast();

  const parseCsvFile = (file: File): Promise<BOMUploadData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          const headers = lines[0].split(',').map(h => h.trim());
          
          const data: BOMUploadData[] = [];
          
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row: any = {};
            
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            
            // Convert numeric fields
            row.quantity_required = parseFloat(row.quantity_required) || 0;
            row.gsm_contribution = parseFloat(row.gsm_contribution) || 0;
            row.percentage_contribution = parseFloat(row.percentage_contribution) || 0;
            row.consumption_rate = parseFloat(row.consumption_rate) || 1;
            row.wastage_percentage = parseFloat(row.wastage_percentage) || 0;
            
            data.push(row);
          }
          
          resolve(data);
        } catch (error) {
          reject(new Error('Failed to parse CSV file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const validateBOMData = async (data: BOMUploadData[]): Promise<{ valid: BOMUploadData[], errors: BOMUploadError[] }> => {
    const valid: BOMUploadData[] = [];
    const errors: BOMUploadError[] = [];

    // Get all existing item codes for validation
    const { data: fgItems } = await supabase
      .from('satguru_item_master')
      .select('item_code')
      .eq('usage_type', 'FINISHED_GOOD');

    const { data: rmItems } = await supabase
      .from('satguru_item_master')
      .select('item_code')
      .in('usage_type', ['RAW_MATERIAL', 'PACKAGING', 'CONSUMABLE']);

    const fgCodes = new Set(fgItems?.map(item => item.item_code) || []);
    const rmCodes = new Set(rmItems?.map(item => item.item_code) || []);

    data.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because index starts at 0 and we skip header
      
      // Validate required fields
      if (!row.fg_item_code) {
        errors.push({ rowNumber, reason: 'FG Item Code is required', data: row });
        return;
      }
      
      if (!row.rm_item_code) {
        errors.push({ rowNumber, reason: 'RM Item Code is required', data: row });
        return;
      }
      
      if (!row.unit_of_measure) {
        errors.push({ rowNumber, reason: 'Unit of Measure is required', data: row });
        return;
      }
      
      // Validate item codes exist
      if (!fgCodes.has(row.fg_item_code)) {
        errors.push({ rowNumber, reason: `FG Item Code '${row.fg_item_code}' not found in Item Master`, data: row });
        return;
      }
      
      if (!rmCodes.has(row.rm_item_code)) {
        errors.push({ rowNumber, reason: `RM Item Code '${row.rm_item_code}' not found in Item Master`, data: row });
        return;
      }
      
      // Validate numeric fields
      if (row.quantity_required <= 0) {
        errors.push({ rowNumber, reason: 'Quantity Required must be greater than 0', data: row });
        return;
      }
      
      if (row.gsm_contribution < 0) {
        errors.push({ rowNumber, reason: 'GSM Contribution cannot be negative', data: row });
        return;
      }
      
      if (row.percentage_contribution < 0 || row.percentage_contribution > 100) {
        errors.push({ rowNumber, reason: 'Percentage Contribution must be between 0 and 100', data: row });
        return;
      }
      
      valid.push(row);
    });

    return { valid, errors };
  };

  const uploadBOM = async (options: BOMUploadOptions) => {
    setIsUploading(true);
    setUploadResult(null);

    try {
      // Parse CSV file
      const csvData = await parseCsvFile(options.file);
      
      if (csvData.length === 0) {
        throw new Error('CSV file is empty or invalid');
      }

      // Validate data
      const { valid, errors } = await validateBOMData(csvData);

      // Prepare BOM entries for insertion
      const bomEntries = valid.map(row => ({
        fg_item_code: row.fg_item_code,
        rm_item_code: row.rm_item_code,
        quantity_required: row.quantity_required,
        unit_of_measure: row.unit_of_measure,
        gsm_contribution: row.gsm_contribution,
        percentage_contribution: row.percentage_contribution,
        consumption_rate: row.consumption_rate || 1,
        wastage_percentage: row.wastage_percentage || 0,
        customer_code: row.customer_code || options.customerCode || null,
        bom_version: options.bomVersion || 1,
        effective_date: new Date().toISOString().split('T')[0],
        notes: row.notes || options.notes || null,
        is_active: true
      }));

      let successCount = 0;
      const insertErrors: BOMUploadError[] = [];

      // Insert in batches to handle large uploads
      const batchSize = 100;
      for (let i = 0; i < bomEntries.length; i += batchSize) {
        const batch = bomEntries.slice(i, i + batchSize);
        
        const { data, error } = await supabase
          .from('bill_of_materials')
          .insert(batch)
          .select();

        if (error) {
          // Handle individual row errors
          batch.forEach((_, batchIndex) => {
            insertErrors.push({
              rowNumber: i + batchIndex + 2,
              reason: `Database error: ${error.message}`,
              data: batch[batchIndex]
            });
          });
        } else {
          successCount += data?.length || 0;
        }
      }

      const result: BOMUploadResult = {
        successCount,
        errorCount: errors.length + insertErrors.length,
        errors: [...errors, ...insertErrors]
      };

      setUploadResult(result);

      if (successCount > 0) {
        toast({
          title: "Upload Completed",
          description: `Successfully uploaded ${successCount} BOM entries${result.errorCount > 0 ? ` with ${result.errorCount} errors` : ''}`,
        });
      }

      return result;

    } catch (error) {
      console.error('BOM upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadBOM,
    isUploading,
    uploadResult
  };
};