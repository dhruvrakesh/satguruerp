
import { supabase } from "@/integrations/supabase/client";
import { ParsedRecord, UpsertProgress } from "@/types/itemMasterUpsert";
import { ItemCodeGenerator } from "./itemCodeGenerator";

export class ItemMasterProcessor {
  private itemCodeGenerator = new ItemCodeGenerator();

  async initialize(): Promise<void> {
    await this.itemCodeGenerator.initialize();
  }

  async processRecords(
    records: ParsedRecord[], 
    onProgress?: (progress: UpsertProgress) => void
  ): Promise<{ success: number; errors: Array<{ record: ParsedRecord; error: string }> }> {
    let successCount = 0;
    const errors: Array<{ record: ParsedRecord; error: string }> = [];
    const batchSize = 5; // Process in smaller batches for better error handling

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      for (const record of batch) {
        onProgress?.({
          current: i + batch.indexOf(record) + 1,
          total: records.length,
          stage: 'processing',
          currentRecord: record
        });

        try {
          if (record.action === 'UPDATE' && record.existing_item) {
            await this.updateExistingItem(record);
          } else if (record.action === 'INSERT') {
            await this.insertNewItem(record);
          }
          successCount++;
        } catch (error: any) {
          console.error(`Error processing row ${record.row_number}:`, error);
          errors.push({
            record,
            error: error.message || 'Unknown error occurred'
          });
        }

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    onProgress?.({
      current: records.length,
      total: records.length,
      stage: 'complete'
    });

    return { success: successCount, errors };
  }

  private async updateExistingItem(record: ParsedRecord): Promise<void> {
    const updateData = {
      item_name: record.item_name,
      category_id: record.category_id,
      qualifier: record.qualifier,
      gsm: record.gsm,
      size_mm: record.size_mm,
      uom: record.uom,
      usage_type: record.usage_type,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('item_master')
      .update(updateData)
      .eq('id', record.existing_item.id);

    if (error) {
      throw new Error(`Failed to update item: ${error.message}`);
    }
  }

  private async insertNewItem(record: ParsedRecord): Promise<void> {
    // Generate item code using the category name from the record
    const itemCode = this.itemCodeGenerator.generateUniqueCode(
      record, 
      record.category_name
    );

    const insertData = {
      item_code: itemCode,
      item_name: record.item_name,
      category_id: record.category_id,
      qualifier: record.qualifier,
      gsm: record.gsm,
      size_mm: record.size_mm,
      uom: record.uom,
      usage_type: record.usage_type,
      status: 'active',
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('item_master')
      .insert(insertData);

    if (error) {
      throw new Error(`Failed to insert item: ${error.message}`);
    }
  }
}
