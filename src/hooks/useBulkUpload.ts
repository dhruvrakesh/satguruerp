import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CategoryResolver } from "@/utils/categoryResolver";
import { UsageTypeResolver } from "@/utils/usageTypeResolver";

interface BulkUploadRow {
  item_code?: string; // Manual item code
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

      // Initialize category resolver with enhanced logging
      const categoryResolver = new CategoryResolver();
      await categoryResolver.initialize();

      console.log('📂 Category resolver initialized');

      // Pre-validate all categories from CSV
      const csvCategories = [...new Set(
        lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const categoryIndex = headers.findIndex(h => h.toLowerCase().includes('category'));
          return categoryIndex >= 0 ? values[categoryIndex] : '';
        }).filter(Boolean)
      )];

      console.log('🔍 Categories found in CSV:', csvCategories);
      
      const categoryValidation = categoryResolver.validateCategoryMapping(csvCategories);
      console.log('✅ Valid categories:', categoryValidation.valid);
      console.log('❌ Invalid categories:', categoryValidation.invalid);

      if (categoryValidation.invalid.length > 0) {
        console.warn('⚠️ Some categories could not be resolved:');
        categoryValidation.invalid.forEach(cat => {
          console.warn(`  - "${cat.name}" (suggestions: ${cat.suggestions.join(', ')})`);
        });
      }

      // Get existing item codes for duplicate detection from satguru_item_master
      const { data: existingItems } = await supabase
        .from('satguru_item_master')
        .select('item_code, item_name');

      const existingItemCodes = new Set(existingItems?.map(item => item.item_code) || []);
      
      // Check if this is a manual item code upload (has Item_Code column)
      const hasItemCodeColumn = headers.some(h => h.toLowerCase().includes('item_code') || h === 'Item_Code');
      console.log('📋 Manual item code upload detected:', hasItemCodeColumn);

      // Process each row with enhanced error handling
      for (let i = 1; i < lines.length; i++) {
        setProgress((i / (lines.length - 1)) * 90);
        
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const rowData: any = {};
        
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        console.log(`🔄 Processing row ${i}:`, rowData);

        try {
          // Enhanced validation with better error messages
          const itemCode = rowData.Item_Code || rowData.item_code;
          const itemName = rowData.Item_Name || rowData.item_name;
          const categoryName = rowData.Category_Name || rowData.category_name;
          const uom = rowData.UOM || rowData.uom;
          const usageType = rowData.Usage_Type || rowData.usage_type;
          const qualifier = rowData.Qualifier || rowData.qualifier;
          const gsm = rowData.GSM || rowData.gsm;
          const sizeMm = rowData.Size_MM || rowData.size_mm;
          const specifications = rowData.Specifications || rowData.specifications;
          
          if (hasItemCodeColumn && !itemCode) {
            throw new Error("Item code is required when using manual item codes");
          }
          if (!itemName) {
            throw new Error("Item name is required");
          }
          if (!categoryName) {
            throw new Error("Category name is required");
          }
          if (!uom) {
            throw new Error("UOM is required");
          }

          // Transform and validate UOM with better error messages
          const transformedUOM = transformUOM(uom);
          if (!validateUOM(transformedUOM)) {
            const suggestion = generateSuggestion(uom, 'uom');
            throw new Error(`Invalid UOM: ${uom}. Expected one of: PCS, KG, MTR, SQM, LTR, BOX, ROLL.${suggestion}`);
          }

          // Enhanced usage type transformation
          const transformedUsageType = UsageTypeResolver.transformUsageType(
            usageType || 'RAW_MATERIAL', 
            categoryName,
            itemName
          );
          
          if (!UsageTypeResolver.validateUsageType(transformedUsageType)) {
            const suggestion = UsageTypeResolver.getUsageTypeSuggestion(
              usageType || '', 
              categoryName,
              itemName
            );
            throw new Error(`Invalid usage type: ${usageType}.${suggestion}`);
          }

          // Parse GSM with validation
          const parsedGSM = parseGSM(gsm);

          console.log('🔄 Transformed data:', {
            itemCode,
            originalUOM: uom,
            transformedUOM,
            originalUsageType: usageType,
            transformedUsageType,
            originalGSM: gsm,
            parsedGSM,
            itemName,
            categoryName
          });

          // Enhanced category resolution with detailed logging
          let categoryId = categoryResolver.resolveCategoryId(categoryName);
          
          if (!categoryId) {
            console.log(`❌ Category not found: "${categoryName}"`);
            console.log('💡 Available categories:', categoryResolver.getAllMappings());
            
            // Try to create missing category
            categoryId = await categoryResolver.createMissingCategory(categoryName);
            
            if (!categoryId) {
              const suggestions = categoryResolver.validateCategoryMapping([categoryName]);
              const suggestionText = suggestions.invalid.length > 0 
                ? ` Suggestions: ${suggestions.invalid[0].suggestions.join(', ')}`
                : '';
              throw new Error(`Failed to resolve or create category: "${categoryName}".${suggestionText}`);
            }
          }

          console.log(`✅ Category resolved: "${categoryName}" → ${categoryId}`);

          // Use manual item code or generate one
          let finalItemCode: string;
          
          if (hasItemCodeColumn && itemCode) {
            // Use the manual item code
            finalItemCode = itemCode.trim();
            console.log('🔑 Using manual item code:', finalItemCode);
            
            // Validate manual item code
            if (!finalItemCode || finalItemCode.length === 0) {
              throw new Error('Manual item code cannot be empty');
            }
          } else {
            // Generate item code using the correct function
            const { data: generatedCode, error: codeError } = await supabase
              .rpc('satguru_generate_item_code', {
                category_name: categoryName,
                qualifier: qualifier || '',
                size_mm: sizeMm || '',
                gsm: parsedGSM
              });

            if (codeError) throw new Error(`Failed to generate item code: ${codeError.message}`);
            
            finalItemCode = generatedCode;
            console.log('🔑 Generated item code:', finalItemCode);
          }

          // Enhanced duplicate detection
          if (existingItemCodes.has(finalItemCode)) {
            const { data: existingItem } = await supabase
              .from('satguru_item_master')
              .select('*')
              .eq('item_code', finalItemCode)
              .single();

            if (existingItem && existingItem.item_name === itemName) {
              console.log('⚠️ Skipping duplicate item:', finalItemCode);
              throw new Error(`Item code already exists: ${finalItemCode}. Use update functionality if you want to modify this item.`);
            }
          }

          // Prepare item data with validated category_id
          const itemData = {
            item_code: finalItemCode,
            item_name: itemName,
            category_id: categoryId, // This should now never be null
            qualifier: qualifier || null,
            gsm: parsedGSM,
            size_mm: sizeMm || null,
            uom: transformedUOM,
            usage_type: transformedUsageType,
            specifications: specifications || null,
            status: 'active'
          };

          console.log('💾 Inserting item data:', itemData);

          // Validate that category_id is not null before insert
          if (!itemData.category_id) {
            throw new Error(`Category ID is null for category: ${categoryName}. This should not happen after resolution.`);
          }

          // Insert item into satguru_item_master table
          const { error: insertError } = await supabase
            .from('satguru_item_master')
            .insert([itemData]);

          if (insertError) {
            if (insertError.code === '23505') { // Unique constraint violation
              throw new Error(`Item code already exists: ${finalItemCode}`);
            }
            if (insertError.code === '23503') { // Foreign key constraint violation
              throw new Error(`Invalid category reference. Category ID: ${itemData.category_id} for category: ${categoryName}`);
            }
            console.error('❌ Insert error:', insertError);
            throw new Error(`Database error: ${insertError.message}`);
          }

          console.log('✅ Successfully inserted item:', finalItemCode);
          results.successCount++;
          existingItemCodes.add(finalItemCode); // Add to set to prevent duplicates within same batch

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
