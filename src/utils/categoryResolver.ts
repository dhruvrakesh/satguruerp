
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
      
      // Handle common variations for flexible packaging
      if (normalizedName.includes('cylinder')) {
        this.categoryMap['cylinders'] = cat.id;
        this.categoryMap['cylinder'] = cat.id;
        this.categoryMap['printing cylinder'] = cat.id;
        this.categoryMap['gravure cylinder'] = cat.id;
      }
      
      if (normalizedName.includes('raw material')) {
        this.categoryMap['raw materials'] = cat.id;
        this.categoryMap['raw material'] = cat.id;
      }
      
      if (normalizedName.includes('finished good')) {
        this.categoryMap['finished goods'] = cat.id;
        this.categoryMap['finished good'] = cat.id;
      }
      
      if (normalizedName.includes('consumable')) {
        this.categoryMap['consumables'] = cat.id;
        this.categoryMap['consumable'] = cat.id;
      }
      
      if (normalizedName.includes('spare')) {
        this.categoryMap['spares'] = cat.id;
        this.categoryMap['spare'] = cat.id;
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

    // Try fuzzy matching for flexible packaging terms
    const fuzzyMatches = Object.keys(this.categoryMap).filter(key => {
      const keyLower = key.toLowerCase();
      const categoryLower = lowerCase;
      return keyLower.includes(categoryLower) || categoryLower.includes(keyLower);
    });

    if (fuzzyMatches.length > 0) {
      const bestMatch = fuzzyMatches[0];
      console.log(`✅ Found fuzzy category match: "${trimmedCategory}" -> "${bestMatch}" -> ${this.categoryMap[bestMatch]}`);
      return this.categoryMap[bestMatch];
    }

    console.error(`❌ No category match found for: "${trimmedCategory}"`);
    console.log('Available categories:', Object.keys(this.categoryMap).filter(k => typeof this.categoryMap[k] === 'string').slice(0, 10));
    
    return null;
  }

  getAllMappings(): CategoryMapping {
    return { ...this.categoryMap };
  }

  getUnmappedCategories(categoryNames: string[]): string[] {
    return categoryNames.filter(name => !this.resolveCategoryId(name));
  }

  // Helper method to auto-create missing categories for flexible packaging
  async createMissingCategory(categoryName: string): Promise<string | null> {
    try {
      console.log(`📝 Auto-creating category: "${categoryName}"`);
      
      // Add description based on flexible packaging context
      let description = `Auto-created during bulk upload`;
      const lowerName = categoryName.toLowerCase();
      
      if (lowerName.includes('raw material')) {
        description = 'Raw materials for flexible packaging manufacturing';
      } else if (lowerName.includes('finished good')) {
        description = 'Finished wrapper and packaging products';
      } else if (lowerName.includes('cylinder')) {
        description = 'Printing cylinders and production tools';
      } else if (lowerName.includes('consumable')) {
        description = 'General consumables and supplies';
      } else if (lowerName.includes('spare')) {
        description = 'Machine spare parts and maintenance items';
      } else if (lowerName.includes('wip')) {
        description = 'Work in progress items';
      }
      
      const { data: newCategory, error } = await supabase
        .from('categories')
        .insert([{ 
          category_name: categoryName.trim(),
          description: description
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create category:', error);
        return null;
      }

      // Add to local mapping with variations
      this.categoryMap[categoryName] = newCategory.id;
      this.categoryMap[categoryName.toLowerCase()] = newCategory.id;
      this.categoryMap[categoryName.toUpperCase()] = newCategory.id;
      
      console.log(`✅ Created new category: "${categoryName}" -> ${newCategory.id}`);
      return newCategory.id;
    } catch (error) {
      console.error('❌ Error creating category:', error);
      return null;
    }
  }
}
