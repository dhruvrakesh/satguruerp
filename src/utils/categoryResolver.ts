
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

    console.log('📂 Available categories:', categories?.map(c => c.category_name));

    this.categoryMap = {};
    categories?.forEach(cat => {
      // Create multiple mappings for flexibility with better normalization
      const normalizedName = cat.category_name.toLowerCase().trim().replace(/\s+/g, ' ');
      
      // Exact matches
      this.categoryMap[cat.category_name] = cat.id;
      this.categoryMap[cat.category_name.toLowerCase()] = cat.id;
      this.categoryMap[cat.category_name.toUpperCase()] = cat.id;
      
      // Normalized matches
      this.categoryMap[normalizedName] = cat.id;
      
      // Handle plural/singular variations
      if (normalizedName.endsWith('s')) {
        this.categoryMap[normalizedName.slice(0, -1)] = cat.id; // Remove 's'
      } else {
        this.categoryMap[normalizedName + 's'] = cat.id; // Add 's'
      }
      
      // Handle common variations
      if (normalizedName.includes('cylinder')) {
        this.categoryMap['cylinders'] = cat.id;
        this.categoryMap['cylinder'] = cat.id;
      }
      
      console.log(`🔗 Mapped category: "${cat.category_name}" -> ${cat.id}`);
    });

    this.initialized = true;
    console.log('✅ Category resolver initialized with', Object.keys(this.categoryMap).length, 'mappings');
  }

  resolveCategoryId(categoryName: string): string | null {
    if (!this.initialized) {
      throw new Error('CategoryResolver not initialized. Call initialize() first.');
    }

    if (!categoryName || typeof categoryName !== 'string') {
      console.warn('⚠️ Invalid category name provided:', categoryName);
      return null;
    }

    const trimmedCategory = categoryName.trim();
    
    // Try exact match first
    if (this.categoryMap[trimmedCategory]) {
      console.log(`✅ Found exact category match: "${trimmedCategory}" -> ${this.categoryMap[trimmedCategory]}`);
      return this.categoryMap[trimmedCategory];
    }

    // Try case-insensitive match
    const lowerCase = trimmedCategory.toLowerCase();
    if (this.categoryMap[lowerCase]) {
      console.log(`✅ Found case-insensitive category match: "${trimmedCategory}" -> ${this.categoryMap[lowerCase]}`);
      return this.categoryMap[lowerCase];
    }

    // Try normalized match
    const normalized = lowerCase.replace(/\s+/g, ' ');
    if (this.categoryMap[normalized]) {
      console.log(`✅ Found normalized category match: "${trimmedCategory}" -> ${this.categoryMap[normalized]}`);
      return this.categoryMap[normalized];
    }

    console.error(`❌ No category match found for: "${trimmedCategory}"`);
    console.log('Available categories:', Object.keys(this.categoryMap).filter(k => typeof this.categoryMap[k] === 'string'));
    
    return null;
  }

  getAllMappings(): CategoryMapping {
    return { ...this.categoryMap };
  }

  getUnmappedCategories(categoryNames: string[]): string[] {
    return categoryNames.filter(name => !this.resolveCategoryId(name));
  }

  // Helper method to auto-create missing categories
  async createMissingCategory(categoryName: string): Promise<string | null> {
    try {
      console.log(`📝 Auto-creating category: "${categoryName}"`);
      
      const { data: newCategory, error } = await supabase
        .from('categories')
        .insert([{ 
          category_name: categoryName.trim(),
          description: `Auto-created during bulk upload`
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create category:', error);
        return null;
      }

      // Add to local mapping
      this.categoryMap[categoryName] = newCategory.id;
      this.categoryMap[categoryName.toLowerCase()] = newCategory.id;
      
      console.log(`✅ Created new category: "${categoryName}" -> ${newCategory.id}`);
      return newCategory.id;
    } catch (error) {
      console.error('❌ Error creating category:', error);
      return null;
    }
  }
}
