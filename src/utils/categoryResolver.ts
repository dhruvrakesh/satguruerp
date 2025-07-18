
import { supabase } from "@/integrations/supabase/client";
import { CategoryMapping } from "@/types/itemMasterUpsert";

export class CategoryResolver {
  private categoryMap: CategoryMapping = {};
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const { data: categories, error } = await supabase
      .from('categories')
      .select('id, category_name')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to load categories: ${error.message}`);
    }

    this.categoryMap = {};
    categories?.forEach(cat => {
      // Create multiple mappings for flexibility
      const normalizedName = cat.category_name.toLowerCase().trim();
      this.categoryMap[normalizedName] = cat.id;
      this.categoryMap[cat.category_name] = cat.id; // Exact match
      this.categoryMap[cat.category_name.toUpperCase()] = cat.id; // Uppercase
    });

    this.initialized = true;
  }

  resolveCategoryId(categoryName: string): string | null {
    if (!this.initialized) {
      throw new Error('CategoryResolver not initialized. Call initialize() first.');
    }

    // Try exact match first
    if (this.categoryMap[categoryName]) {
      return this.categoryMap[categoryName];
    }

    // Try normalized match
    const normalized = categoryName.toLowerCase().trim();
    return this.categoryMap[normalized] || null;
  }

  getAllMappings(): CategoryMapping {
    return { ...this.categoryMap };
  }

  getUnmappedCategories(categoryNames: string[]): string[] {
    return categoryNames.filter(name => !this.resolveCategoryId(name));
  }
}
