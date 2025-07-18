
import { supabase } from "@/integrations/supabase/client";
import { CsvItemData } from "@/schemas/itemMasterSchema";

export class ItemCodeGenerator {
  private existingCodes = new Set<string>();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const { data: items, error } = await supabase
      .from('item_master')
      .select('item_code');

    if (error) {
      throw new Error(`Failed to load existing item codes: ${error.message}`);
    }

    this.existingCodes = new Set(items?.map(item => item.item_code) || []);
    this.initialized = true;
  }

  generateUniqueCode(item: CsvItemData, categoryName: string, attempt: number = 0): string {
    if (!this.initialized) {
      throw new Error('ItemCodeGenerator not initialized. Call initialize() first.');
    }

    const categoryCode = categoryName.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    const suffix = attempt > 0 ? `-${attempt}` : '';
    
    const code = `${categoryCode}-${timestamp}${suffix}`;
    
    // Check if code already exists or was generated in this session
    if (this.existingCodes.has(code)) {
      return this.generateUniqueCode(item, categoryName, attempt + 1);
    }

    // Add to our tracking set
    this.existingCodes.add(code);
    return code;
  }

  isCodeUnique(code: string): boolean {
    return !this.existingCodes.has(code);
  }
}
