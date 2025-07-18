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

const transformUsageType = (type: string): string => {
  const typeMap: Record<string, string> = {
    'wrapper': 'RAW_MATERIAL',
    'lamination': 'RAW_MATERIAL', 
    'coating': 'RAW_MATERIAL',
    'adhesive': 'RAW_MATERIAL',
    'film': 'RAW_MATERIAL',
    'paper': 'RAW_MATERIAL',
    'ink': 'RAW_MATERIAL',
    'solvent': 'RAW_MATERIAL',
    'chemical': 'RAW_MATERIAL',
    'packaging': 'PACKAGING',
    'consumable': 'CONSUMABLE',
    'finished': 'FINISHED_GOOD',
    'wip': 'WIP',
    'raw material': 'RAW_MATERIAL',
    'raw_material': 'RAW_MATERIAL',
    'finished_good': 'FINISHED_GOOD',
    'finished good': 'FINISHED_GOOD',
    'hot melt': 'RAW_MATERIAL',
    'general': 'CONSUMABLE',
    'consumables': 'CONSUMABLE',
    'maintenance': 'CONSUMABLE',
    'spares': 'CONSUMABLE',
    'tooling': 'CONSUMABLE'
  };
  
  const normalizedType = type.toLowerCase().trim();
  return typeMap[normalizedType] || 'RAW_MATERIAL';
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

const validateUsageType = (type: string): boolean => {
  const validTypes = ['RAW_MATERIAL', 'FINISHED_GOOD', 'WIP', 'PACKAGING', 'CONSUMABLE'];
  return validTypes.includes(type);
};

const generateSuggestion = (originalValue: string, type: 'uom' | 'usage_type'): string => {
  if (type === 'uom') {
    const commonMappings = {
      'nos': 'PCS', 'boxes': 'BOX', 'metre': 'MTR', 'pieces': 'PCS'
    };
    const suggestion = commonMappings[originalValue.toLowerCase()];
    return suggestion ? ` Did you mean '${suggestion}'?` : '';
  } else {
    const commonMappings = {
      'hot melt': 'RAW_MATERIAL', 'general': 'CONSUMABLE', 'consumables': 'CONSUMABLE'
    };
    const suggestion = commonMappings[originalValue.toLowerCase()];
    return suggestion ? ` Mapped to: ${suggestion}` : '';
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

      // Get existing categories from the correct table
      const { data: categories } = await supabase
        .from('categories')
        .select('id, category_name');

      const categoryMap = new Map(
        categories?.map(c => [c.category_name.toLowerCase(), c.id]) || []
      );

      console.log('📂 Found categories:', categories?.length || 0);

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

          // Transform and validate usage type
          const transformedUsageType = transformUsageType(rowData.usage_type || 'raw material');
          if (!validateUsageType(transformedUsageType)) {
            const suggestion = generateSuggestion(rowData.usage_type || '', 'usage_type');
            throw new Error(`Invalid usage type: ${rowData.usage_type}.${suggestion}`);
          }

          // Parse GSM
          const parsedGSM = parseGSM(rowData.gsm);

          console.log('🔄 Transformed data:', {
            originalUOM: rowData.uom,
            transformedUOM,
            originalUsageType: rowData.usage_type,
            transformedUsageType,
            originalGSM: rowData.gsm,
            parsedGSM
          });

          // Find or create category
          let categoryId = categoryMap.get(rowData.category_name.toLowerCase());
          
          if (!categoryId) {
            console.log('➕ Creating new category:', rowData.category_name);
            // Auto-create category
            const { data: newCategory, error: categoryError } = await supabase
              .from('categories')
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
