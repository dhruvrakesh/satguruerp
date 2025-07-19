
import { supabase } from "@/integrations/supabase/client";
import { CategoryResolver } from "./categoryResolver";
import { UsageTypeResolver } from "./usageTypeResolver";
import type { ParsedRecord, UpsertProgress } from "@/types/itemMasterUpsert";

export class ItemMasterProcessor {
  private categoryResolver: CategoryResolver;

  constructor() {
    this.categoryResolver = new CategoryResolver();
  }

  async initialize() {
    await this.categoryResolver.initialize();
  }

  async processRecords(
    records: ParsedRecord[],
    onProgress: (progress: UpsertProgress) => void
  ): Promise<{ success: number; errors: string[] }> {
    const results = { success: 0, errors: [] as string[] };
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      onProgress({
        current: i + 1,
        total: records.length,
        stage: 'processing',
        currentRecord: record
      });

      try {
        // Enhanced category resolution with validation
        if (!record.category_id) {
          console.log(`🔍 Resolving category for record: ${record.item_name}, category: ${record.category_name}`);
          
          const resolvedCategoryId = this.categoryResolver.resolveCategoryId(record.category_name);
          
          if (!resolvedCategoryId) {
            // Try to create missing category
            const createdCategoryId = await this.categoryResolver.createMissingCategory(record.category_name);
            
            if (!createdCategoryId) {
              throw new Error(`Failed to resolve or create category: ${record.category_name}`);
            }
            
            record.category_id = createdCategoryId;
            console.log(`✅ Created and assigned category: ${record.category_name} → ${createdCategoryId}`);
          } else {
            record.category_id = resolvedCategoryId;
            console.log(`✅ Resolved category: ${record.category_name} → ${resolvedCategoryId}`);
          }
        }

        // Validate that we have a valid category_id before proceeding
        if (!record.category_id) {
          throw new Error(`Category ID is null after resolution for category: ${record.category_name}`);
        }

        // Enhanced usage type resolution with item name context
        const resolvedUsageType = UsageTypeResolver.transformUsageType(
          record.usage_type || 'RAW_MATERIAL',
          record.category_name,
          record.item_name
        );

        // Validate logical consistency for flexible packaging manufacturing
        const logicError = UsageTypeResolver.validateCategoryUsageTypeLogic(
          record.category_name,
          resolvedUsageType,
          record.item_name
        );

        if (logicError) {
          console.warn(`⚠️ Logic warning for ${record.item_name}: ${logicError}`);
        }

        if (record.action === 'INSERT') {
          await this.insertRecord({ ...record, usage_type: resolvedUsageType });
        } else if (record.action === 'UPDATE') {
          await this.updateRecord({ ...record, usage_type: resolvedUsageType });
        }
        
        results.success++;
      } catch (error: any) {
        console.error(`Failed to process ${record.item_name}:`, error);
        results.errors.push(`Row ${record.row_number}: ${error.message}`);
      }
    }

    return results;
  }

  private async insertRecord(record: ParsedRecord) {
    // Validate category_id before generating item code
    if (!record.category_id) {
      throw new Error(`Cannot insert record without valid category_id. Category: ${record.category_name}`);
    }

    // Generate item code
    const { data: itemCode, error: codeError } = await supabase
      .rpc('satguru_generate_item_code', {
        category_name: record.category_name,
        qualifier: record.qualifier || '',
        size_mm: record.size_mm || '',
        gsm: record.gsm
      });

    if (codeError) throw new Error(`Failed to generate item code: ${codeError.message}`);

    console.log(`📝 Inserting record with category_id: ${record.category_id}`);

    // Insert new record with validated category_id
    const { error } = await supabase
      .from('satguru_item_master')
      .insert([{
        item_code: itemCode,
        item_name: record.item_name,
        category_id: record.category_id, // This should never be null now
        qualifier: record.qualifier,
        gsm: record.gsm,
        size_mm: record.size_mm,
        uom: record.uom,
        usage_type: record.usage_type,
        specifications: record.specifications,
        status: 'active'
      }]);

    if (error) {
      if (error.code === '23503') {
        throw new Error(`Foreign key constraint violation. Invalid category_id: ${record.category_id} for category: ${record.category_name}`);
      }
      throw error;
    }

    console.log(`✅ Successfully inserted: ${itemCode}`);
  }

  private async updateRecord(record: ParsedRecord) {
    if (!record.existing_item) throw new Error('No existing item to update');
    if (!record.category_id) {
      throw new Error(`Cannot update record without valid category_id. Category: ${record.category_name}`);
    }

    console.log(`📝 Updating record with category_id: ${record.category_id}`);

    // Update existing record
    const { error } = await supabase
      .from('satguru_item_master')
      .update({
        item_name: record.item_name,
        category_id: record.category_id,
        qualifier: record.qualifier,
        gsm: record.gsm,
        size_mm: record.size_mm,
        uom: record.uom,
        usage_type: record.usage_type,
        specifications: record.specifications,
        updated_at: new Date().toISOString()
      })
      .eq('id', record.existing_item.id);

    if (error) {
      if (error.code === '23503') {
        throw new Error(`Foreign key constraint violation. Invalid category_id: ${record.category_id} for category: ${record.category_name}`);
      }
      throw error;
    }

    console.log(`✅ Successfully updated: ${record.existing_item.item_code}`);
  }
}
