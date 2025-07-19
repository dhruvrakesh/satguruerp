
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CategoryResolver } from "@/utils/categoryResolver";
import { UsageTypeResolver } from "@/utils/usageTypeResolver";

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

// Enhanced data transformation utilities
const transformUOM = (uom: string): string => {
  const uomMap: Record<string, string> = {
    'kg': 'KG',
    'pcs': 'PCS',
    'mtr': 'MTR',
    'sqm': 'SQM',
    'ltr': 'LTR',
    'box': 'BOX',
    'roll': 'ROLL',
    'meter': 'MTR',
    'piece': 'PCS',
    'litre': 'LTR',
    'square meter': 'SQM',
    'nos': 'PCS',
    'boxes': 'BOX',
    'metre': 'MTR',
    'Nos': 'PCS',
    'NOS': 'PCS',
    'Boxes': 'BOX',
    'BOXES': 'BOX',
    'Metre': 'MTR',
    'METRE': 'MTR',
    'pieces': 'PCS',
    'Pieces': 'PCS',
    'PIECES': 'PCS'
  };
  
  const normalizedUom = uom.trim();
  return uomMap[normalizedUom] || normalizedUom.toUpperCase();
};

const parseGSM = (gsmValue: string): number | null => {
  if (!gsmValue || gsmValue.trim() === '') return null;
  
  // Extract numeric part from mixed alphanumeric strings
  const numericMatch = gsmValue.toString().match(/(\d+\.?\d*)/);
  if (numericMatch) {
    const parsed = parseFloat(numericMatch[1]);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
};

const validateUOM = (uom: string): boolean => {
  const validUOMs = ['PCS', 'KG', 'MTR', 'SQM', 'LTR', 'BOX', 'ROLL'];
  return validUOMs.includes(uom);
};

const generateSuggestion = (originalValue: string, type: 'uom' | 'usage_type', categoryName?: string): string => {
  if (type === 'uom') {
    const commonMappings = {
      'nos': 'PCS', 'boxes': 'BOX', 'metre': 'MTR', 'pieces': 'PCS'
    };
    const suggestion = commonMappings[originalValue.toLowerCase()];
    return suggestion ? ` Did you mean '${suggestion}'?` : '';
  } else {
    return UsageTypeResolver.getUsageTypeSuggestion(originalValue, categoryName);
  }
};

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

      console.log('📊 CSV Headers detected:', headers);
      console.log('📊 Total rows to process:', lines.length - 1);

      const results: BulkUploadResult = {
        successCount: 0,
        errorCount: 0,
        errors: []
      };

      // Initialize category resolver
      const categoryResolver = new CategoryResolver();
      await categoryResolver.initialize();

      console.log('📂 Category resolver initialized');

      // Get existing item codes for smarter duplicate detection from satguru_item_master
      const { data: existingItems } = await supabase
        .from('satguru_item_master')
        .select('item_code, item_name');

      const existingItemCodes = new Set(existingItems?.map(item => item.item_code) || []);

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        setProgress((i / (lines.length - 1)) * 90);
        
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const rowData: any = {};
        
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        console.log(`🔄 Processing row ${i}:`, rowData);

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

          // Transform and validate UOM
          const transformedUOM = transformUOM(rowData.uom);
          if (!validateUOM(transformedUOM)) {
            const suggestion = generateSuggestion(rowData.uom, 'uom');
            throw new Error(`Invalid UOM: ${rowData.uom}. Expected one of: PCS, KG, MTR, SQM, LTR, BOX, ROLL.${suggestion}`);
          }

          // Enhanced usage type transformation with item name context
          const transformedUsageType = UsageTypeResolver.transformUsageType(
            rowData.usage_type || 'raw material', 
            rowData.category_name,
            rowData.item_name
          );
          
          if (!UsageTypeResolver.validateUsageType(transformedUsageType)) {
            const suggestion = UsageTypeResolver.getUsageTypeSuggestion(
              rowData.usage_type || '', 
              rowData.category_name,
              rowData.item_name
            );
            throw new Error(`Invalid usage type: ${rowData.usage_type}.${suggestion}`);
          }

          // Enhanced logical validation with item name
          const logicError = UsageTypeResolver.validateCategoryUsageTypeLogic(
            rowData.category_name, 
            transformedUsageType,
            rowData.item_name
          );
          if (logicError) {
            console.warn(`⚠️ ${logicError}`);
          }

          // Parse GSM
          const parsedGSM = parseGSM(rowData.gsm);

          console.log('🔄 Transformed data:', {
            originalUOM: rowData.uom,
            transformedUOM,
            originalUsageType: rowData.usage_type,
            transformedUsageType,
            originalGSM: rowData.gsm,
            parsedGSM,
            itemName: rowData.item_name,
            categoryName: rowData.category_name
          });

          // Find or create category with improved resolution
          let categoryId = categoryResolver.resolveCategoryId(rowData.category_name);
          
          if (!categoryId) {
            console.log('❌ Category not found, attempting to create:', rowData.category_name);
            categoryId = await categoryResolver.createMissingCategory(rowData.category_name);
            
            if (!categoryId) {
              throw new Error(`Failed to resolve or create category: ${rowData.category_name}. Available categories: ${Object.keys(categoryResolver.getAllMappings()).slice(0, 5).join(', ')}...`);
            }
          }

          // Generate item code using the correct function
          const { data: generatedCode, error: codeError } = await supabase
            .rpc('satguru_generate_item_code', {
              category_name: rowData.category_name,
              qualifier: rowData.qualifier || '',
              size_mm: rowData.size_mm || '',
              gsm: parsedGSM
            });

          if (codeError) throw new Error(`Failed to generate item code: ${codeError.message}`);

          console.log('🔑 Generated item code:', generatedCode);

          // Enhanced duplicate detection - check if exact same item exists
          if (existingItemCodes.has(generatedCode)) {
            // Check if it's truly a duplicate or just needs updating
            const { data: existingItem } = await supabase
              .from('satguru_item_master')
              .select('*')
              .eq('item_code', generatedCode)
              .single();

            if (existingItem && existingItem.item_name === rowData.item_name) {
              console.log('⚠️ Skipping duplicate item:', generatedCode);
              throw new Error(`Item code already exists: ${generatedCode}. Use update functionality if you want to modify this item.`);
            }
          }

          // Prepare item data for the correct table
          const itemData = {
            item_code: generatedCode,
            item_name: rowData.item_name,
            category_id: categoryId,
            qualifier: rowData.qualifier || null,
            gsm: parsedGSM,
            size_mm: rowData.size_mm || null,
            uom: transformedUOM,
            usage_type: transformedUsageType,
            specifications: rowData.specifications || null,
            status: 'active'
          };

          console.log('💾 Inserting item data:', itemData);

          // Insert item into satguru_item_master table
          const { error: insertError } = await supabase
            .from('satguru_item_master')
            .insert([itemData]);

          if (insertError) {
            if (insertError.code === '23505') { // Unique constraint violation
              throw new Error(`Item code already exists: ${generatedCode}`);
            }
            console.error('❌ Insert error:', insertError);
            throw new Error(`Database error: ${insertError.message}`);
          }

          console.log('✅ Successfully inserted item:', generatedCode);
          results.successCount++;
          existingItemCodes.add(generatedCode); // Add to set to prevent duplicates within same batch

        } catch (error: any) {
          console.error(`❌ Error processing row ${i + 1}:`, error.message);
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
      console.log('🎉 Processing complete:', results);
      return results;

    } catch (error: any) {
      console.error('💥 Fatal error during CSV processing:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: processCSV,
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['itemMaster'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      
      console.log('🔄 Refreshing cache after successful upload');
      
      toast({
        title: "Upload completed",
        description: `${results.successCount} items uploaded successfully${results.errorCount > 0 ? `, ${results.errorCount} errors found` : ''}`
      });
    },
    onError: (error: any) => {
      console.error('💥 Upload mutation error:', error);
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
