import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface BulkUploadRow {
  item_name: string;
  category_name: string;
  qualifier?: string;
  gsm?: number;
  size_mm?: string;
  uom: string;
  usage_type?: string;
  specifications?: string;
}

interface BulkUploadResult {
  successCount: number;
  errorCount: number;
  errors: Array<{
    rowNumber: number;
    reason: string;
    data: any;
  }>;
}

export function useBulkUpload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();

  const processCSV = async (file: File): Promise<BulkUploadResult> => {
    setIsProcessing(true);
    setProgress(0);

    try {
      // Read CSV file
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      if (lines.length <= 1) {
        throw new Error("CSV file is empty or has no data rows");
      }

      const results: BulkUploadResult = {
        successCount: 0,
        errorCount: 0,
        errors: []
      };

      // Get existing categories
      const { data: categories } = await supabase
        .from('satguru_categories')
        .select('id, category_name');

      const categoryMap = new Map(
        categories?.map(c => [c.category_name.toLowerCase(), c.id]) || []
      );

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        setProgress((i / (lines.length - 1)) * 90); // Leave 10% for final processing
        
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const rowData: any = {};
        
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        try {

          // Validate required fields
          if (!rowData.item_name) {
            throw new Error("Item name is required");
          }
          if (!rowData.category_name) {
            throw new Error("Category name is required");
          }
          if (!rowData.uom) {
            throw new Error("UOM is required");
          }

          // Find or create category
          let categoryId = categoryMap.get(rowData.category_name.toLowerCase());
          
          if (!categoryId) {
            // Auto-create category
            const { data: newCategory, error: categoryError } = await supabase
              .from('satguru_categories')
              .insert([{ 
                category_name: rowData.category_name,
                description: `Auto-created during bulk upload`
              }])
              .select()
              .single();

            if (categoryError) throw new Error(`Failed to create category: ${categoryError.message}`);
            
            categoryId = newCategory.id;
            categoryMap.set(rowData.category_name.toLowerCase(), categoryId);
          }

          // Generate item code
          const { data: generatedCode, error: codeError } = await supabase
            .rpc('satguru_generate_item_code', {
              category_name: rowData.category_name,
              qualifier: rowData.qualifier || '',
              size_mm: rowData.size_mm || '',
              gsm: rowData.gsm ? parseFloat(rowData.gsm) : null
            });

          if (codeError) throw new Error(`Failed to generate item code: ${codeError.message}`);

          // Prepare item data
          const itemData = {
            item_code: generatedCode,
            item_name: rowData.item_name,
            category_id: categoryId,
            qualifier: rowData.qualifier || null,
            gsm: rowData.gsm ? parseFloat(rowData.gsm) : null,
            size_mm: rowData.size_mm || null,
            uom: rowData.uom,
            usage_type: rowData.usage_type || null,
            specifications: rowData.specifications || null,
            status: 'active'
          };

          // Insert item
          const { error: insertError } = await supabase
            .from('satguru_item_master')
            .insert([itemData]);

          if (insertError) {
            if (insertError.code === '23505') { // Unique constraint violation
              throw new Error("Item code already exists");
            }
            throw new Error(`Database error: ${insertError.message}`);
          }

          results.successCount++;

        } catch (error: any) {
          results.errorCount++;
          results.errors.push({
            rowNumber: i + 1,
            reason: error.message,
            data: headers.reduce((obj: any, header, index) => {
              obj[header] = values[index] || '';
              return obj;
            }, {})
          });
        }
      }

      setProgress(100);
      return results;

    } finally {
      setIsProcessing(false);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: processCSV,
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['itemMaster'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      
      toast({
        title: "Upload completed",
        description: `${results.successCount} items uploaded successfully${results.errorCount > 0 ? `, ${results.errorCount} errors found` : ''}`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred during upload",
        variant: "destructive"
      });
    }
  });

  return {
    uploadMutation,
    isProcessing,
    progress
  };
}