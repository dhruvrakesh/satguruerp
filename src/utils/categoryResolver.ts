
import { supabase } from "@/integrations/supabase/client";

export interface CategoryMapping {
  [key: string]: string;
}

export interface CategoryInfo {
  id: string;
  category_name: string;
}

export class CategoryResolver {
  private categoryMap: CategoryMapping = {};
  private initialized = false;
  private availableCategories: CategoryInfo[] = [];

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // FIXED: Query satguru_categories instead of categories
    const { data: categories, error } = await supabase
      .from('satguru_categories')
      .select('id, category_name')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to load categories: ${error.message}`);
    }

    console.log('📂 Available categories from satguru_categories:', categories?.map(c => c.category_name));
    this.availableCategories = categories || [];

    this.categoryMap = {};
    categories?.forEach(cat => {
      this.addCategoryToMap(cat.category_name, cat.id);
    });

    this.initialized = true;
    console.log('✅ Category resolver initialized with', Object.keys(this.categoryMap).length, 'mappings');
  }

  private addCategoryToMap(categoryName: string, categoryId: string): void {
    // Store original category info
    const normalizedName = categoryName.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Exact matches (case variations)
    this.categoryMap[categoryName] = categoryId;
    this.categoryMap[categoryName.toLowerCase()] = categoryId;
    this.categoryMap[categoryName.toUpperCase()] = categoryId;
    this.categoryMap[normalizedName] = categoryId;
    
    // Enhanced singular/plural variations
    this.addSingularPluralVariations(categoryName, categoryId);
    
    // Add specific business logic mappings
    this.addBusinessSpecificMappings(categoryName, categoryId);
    
    console.log(`🔗 Mapped category: "${categoryName}" (ID: ${categoryId})`);
  }

  private addSingularPluralVariations(categoryName: string, categoryId: string): void {
    const normalized = categoryName.toLowerCase().trim();
    
    // Handle common singular/plural patterns for flexible packaging
    const pluralPatterns = [
      { singular: 'consumable', plural: 'consumables' },
      { singular: 'spare', plural: 'spares' },
      { singular: 'raw material', plural: 'raw materials' },
      { singular: 'finished good', plural: 'finished goods' },
      { singular: 'cylinder', plural: 'cylinders' },
      { singular: 'chemical', plural: 'chemicals' },
      { singular: 'adhesive', plural: 'adhesives' }
    ];

    pluralPatterns.forEach(pattern => {
      if (normalized.includes(pattern.plural)) {
        this.categoryMap[pattern.singular] = categoryId;
        this.categoryMap[pattern.singular.toUpperCase()] = categoryId;
        this.categoryMap[this.capitalize(pattern.singular)] = categoryId;
      }
      if (normalized.includes(pattern.singular)) {
        this.categoryMap[pattern.plural] = categoryId;
        this.categoryMap[pattern.plural.toUpperCase()] = categoryId;
        this.categoryMap[this.capitalize(pattern.plural)] = categoryId;
      }
    });

    // Generic singular/plural handling
    if (normalized.endsWith('s') && normalized.length > 3) {
      const singular = normalized.slice(0, -1);
      this.categoryMap[singular] = categoryId;
      this.categoryMap[singular.toUpperCase()] = categoryId;
      this.categoryMap[this.capitalize(singular)] = categoryId;
    } else {
      const plural = normalized + 's';
      this.categoryMap[plural] = categoryId;
      this.categoryMap[plural.toUpperCase()] = categoryId;
      this.categoryMap[this.capitalize(plural)] = categoryId;
    }
  }

  private addBusinessSpecificMappings(categoryName: string, categoryId: string): void {
    const normalized = categoryName.toLowerCase();
    
    // Flexible packaging specific mappings
    if (normalized.includes('cylinder')) {
      this.categoryMap['printing cylinder'] = categoryId;
      this.categoryMap['gravure cylinder'] = categoryId;
      this.categoryMap['cylinders'] = categoryId;
      this.categoryMap['cylinder'] = categoryId;
    }
    
    if (normalized.includes('consumable')) {
      this.categoryMap['consumable'] = categoryId;
      this.categoryMap['CONSUMABLE'] = categoryId;
      this.categoryMap['Consumable'] = categoryId;
    }
    
    if (normalized.includes('raw material')) {
      this.categoryMap['raw material'] = categoryId;
      this.categoryMap['RAW MATERIAL'] = categoryId;
      this.categoryMap['Raw Material'] = categoryId;
    }
    
    if (normalized.includes('finished good')) {
      this.categoryMap['finished good'] = categoryId;
      this.categoryMap['FINISHED GOOD'] = categoryId;
      this.categoryMap['Finished Good'] = categoryId;
    }
  }

  private capitalize(str: string): string {
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
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
    console.log(`🔍 Resolving category: "${trimmedCategory}"`);
    
    // Phase 1: Exact match (case-sensitive)
    if (this.categoryMap[trimmedCategory]) {
      const result = this.categoryMap[trimmedCategory];
      console.log(`✅ Exact match found: "${trimmedCategory}" → ${result}`);
      return result;
    }

    // Phase 2: Case-insensitive exact match
    const lowerCase = trimmedCategory.toLowerCase();
    if (this.categoryMap[lowerCase]) {
      const result = this.categoryMap[lowerCase];
      console.log(`✅ Case-insensitive match found: "${trimmedCategory}" → ${result}`);
      return result;
    }

    // Phase 3: Normalized match (remove extra spaces)
    const normalized = lowerCase.replace(/\s+/g, ' ');
    if (this.categoryMap[normalized]) {
      const result = this.categoryMap[normalized];
      console.log(`✅ Normalized match found: "${trimmedCategory}" → ${result}`);
      return result;
    }

    // Phase 4: Fuzzy matching with improved logic
    const fuzzyMatches = Object.keys(this.categoryMap).filter(key => {
      const keyLower = key.toLowerCase();
      const categoryLower = lowerCase;
      
      // Bidirectional substring matching
      return keyLower.includes(categoryLower) || 
             categoryLower.includes(keyLower) ||
             this.levenshteinDistance(keyLower, categoryLower) <= 2;
    });

    if (fuzzyMatches.length > 0) {
      // Sort by best match (shortest distance)
      const bestMatch = fuzzyMatches.sort((a, b) => {
        const distA = this.levenshteinDistance(a.toLowerCase(), lowerCase);
        const distB = this.levenshteinDistance(b.toLowerCase(), lowerCase);
        return distA - distB;
      })[0];
      
      const result = this.categoryMap[bestMatch];
      console.log(`✅ Fuzzy match found: "${trimmedCategory}" → "${bestMatch}" → ${result}`);
      return result;
    }

    // Phase 5: Failed to resolve - provide detailed error info
    console.error(`❌ No category match found for: "${trimmedCategory}"`);
    console.log('📋 Available category names:', this.availableCategories.map(c => c.category_name));
    console.log('🔧 Top suggestions:', this.getSuggestions(trimmedCategory));
    
    return null;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private getSuggestions(categoryName: string): string[] {
    const suggestions = this.availableCategories
      .map(cat => ({
        name: cat.category_name,
        distance: this.levenshteinDistance(categoryName.toLowerCase(), cat.category_name.toLowerCase())
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map(s => s.name);
    
    return suggestions;
  }

  getAllMappings(): CategoryMapping {
    return { ...this.categoryMap };
  }

  getUnmappedCategories(categoryNames: string[]): string[] {
    return categoryNames.filter(name => {
      const resolved = this.resolveCategoryId(name);
      if (!resolved) {
        console.log(`❌ Unmapped category: "${name}"`);
      }
      return !resolved;
    });
  }

  // Enhanced auto-creation with better validation
  async createMissingCategory(categoryName: string): Promise<string | null> {
    try {
      console.log(`📝 Auto-creating category: "${categoryName}"`);
      
      // Check if we should map to existing category instead
      const suggestions = this.getSuggestions(categoryName);
      if (suggestions.length > 0) {
        const bestSuggestion = suggestions[0];
        const distance = this.levenshteinDistance(categoryName.toLowerCase(), bestSuggestion.toLowerCase());
        
        if (distance <= 2) {
          console.log(`🔄 Mapping "${categoryName}" to existing "${bestSuggestion}" instead of creating new`);
          return this.resolveCategoryId(bestSuggestion);
        }
      }
      
      // Create new category with enhanced description
      let description = `Auto-created during bulk upload for flexible packaging`;
      const lowerName = categoryName.toLowerCase();
      
      if (lowerName.includes('consumable')) {
        description = 'Consumable items and supplies for manufacturing operations';
      } else if (lowerName.includes('raw material')) {
        description = 'Raw materials for flexible packaging manufacturing';
      } else if (lowerName.includes('finished good')) {
        description = 'Finished wrapper and packaging products';
      } else if (lowerName.includes('cylinder')) {
        description = 'Printing cylinders and production tools';
      } else if (lowerName.includes('spare')) {
        description = 'Machine spare parts and maintenance items';
      } else if (lowerName.includes('chemical')) {
        description = 'Chemicals and solvents for manufacturing processes';
      }
      
      // FIXED: Insert into satguru_categories instead of categories
      const { data: newCategory, error } = await supabase
        .from('satguru_categories')
        .insert([{ 
          category_name: categoryName.trim(),
          description: description,
          is_active: true
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create category:', error);
        return null;
      }

      // Add to local mapping with all variations
      this.addCategoryToMap(newCategory.category_name, newCategory.id);
      
      console.log(`✅ Created new category: "${categoryName}" → ${newCategory.id}`);
      return newCategory.id;
    } catch (error) {
      console.error('❌ Error creating category:', error);
      return null;
    }
  }

  // Validation helper
  validateCategoryMapping(csvCategories: string[]): { 
    valid: Array<{name: string, id: string}>, 
    invalid: Array<{name: string, suggestions: string[]}> 
  } {
    const valid: Array<{name: string, id: string}> = [];
    const invalid: Array<{name: string, suggestions: string[]}> = [];

    csvCategories.forEach(categoryName => {
      const resolved = this.resolveCategoryId(categoryName);
      if (resolved) {
        valid.push({ name: categoryName, id: resolved });
      } else {
        invalid.push({ 
          name: categoryName, 
          suggestions: this.getSuggestions(categoryName) 
        });
      }
    });

    return { valid, invalid };
  }
}
