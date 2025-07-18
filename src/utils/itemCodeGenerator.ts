
import { supabase } from "@/integrations/supabase/client";
import { CsvItemData } from "@/schemas/itemMasterSchema";

export class ItemCodeGenerator {
  private existingCodes = new Set<string>();
  private itemNameToCodeMap = new Map<string, string>();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const { data: items, error } = await supabase
      .from('satguru_item_master')
      .select('item_code, item_name');

    if (error) {
      throw new Error(`Failed to load existing item codes: ${error.message}`);
    }

    // Build both sets for tracking
    items?.forEach(item => {
      this.existingCodes.add(item.item_code);
      this.itemNameToCodeMap.set(item.item_name, item.item_code);
    });

    this.initialized = true;
  }

  async getOrGenerateCodeForItem(item: CsvItemData, categoryName: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('ItemCodeGenerator not initialized. Call initialize() first.');
    }

    // Check if item_name already has an item_code - preserve existing codes to maintain foreign key relationships
    const existingCode = await this.lookupExistingCodeForName(item.item_name);
    if (existingCode) {
      return existingCode;
    }

    // Generate new code for new item_name
    return this.generateNewUniqueCode(item, categoryName);
  }

  private async lookupExistingCodeForName(itemName: string): Promise<string | null> {
    // First check our cache
    if (this.itemNameToCodeMap.has(itemName)) {
      return this.itemNameToCodeMap.get(itemName)!;
    }

    // If not in cache, query database directly
    const { data, error } = await supabase
      .from('satguru_item_master')
      .select('item_code')
      .eq('item_name', itemName)
      .maybeSingle();

    if (error) {
      console.warn(`Error looking up item code for name "${itemName}":`, error);
      return null;
    }

    if (data?.item_code) {
      // Cache the result for future use
      this.itemNameToCodeMap.set(itemName, data.item_code);
      this.existingCodes.add(data.item_code);
      return data.item_code;
    }

    return null;
  }

  private async generateNewUniqueCode(item: CsvItemData, categoryName: string): Promise<string> {
    // Use the enhanced database function for structured code generation
    const { data, error } = await supabase.rpc('satguru_generate_enhanced_item_code', {
      category_name: categoryName,
      usage_type: item.usage_type || 'RAW_MATERIAL',
      qualifier: item.qualifier || '',
      size_mm: item.size_mm || '',
      gsm: item.gsm || null
    });

    if (error) {
      throw new Error(`Failed to generate item code: ${error.message}`);
    }

    let newCode = data as string;
    
    // Ensure uniqueness by checking against existing codes
    let counter = 1;
    let baseCode = newCode;
    while (this.existingCodes.has(newCode)) {
      newCode = `${baseCode}_${counter.toString().padStart(2, '0')}`;
      counter++;
    }
    
    // Add to our tracking
    this.existingCodes.add(newCode);
    this.itemNameToCodeMap.set(item.item_name, newCode);
    
    return newCode;
  }

  isCodeUnique(code: string): boolean {
    return !this.existingCodes.has(code);
  }

  // Legacy method for compatibility - sync version that throws error
  generateUniqueCode(item: CsvItemData, categoryName: string, attempt: number = 0): string {
    throw new Error('Use getOrGenerateCodeForItem() instead of generateUniqueCode()');
  }
}
