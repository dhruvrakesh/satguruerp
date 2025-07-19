
import { supabase } from "@/integrations/supabase/client";

export interface CategoryMapping {
  [key: string]: string;
}

export interface CategoryInfo {
  id: string;
  category_name: string;
}

// Simplified interfaces to prevent deep type instantiation
interface CategoryMapEntry {
  key: string;
  value: string;
}

interface ResolverState {
  categoryMap: CategoryMapping;
  initialized: boolean;
  availableCategories: CategoryInfo[];
}

export class CategoryResolver {
  private state: ResolverState = {
    categoryMap: {},
    initialized: false,
    availableCategories: []
  };

  async initialize(): Promise<void> {
    if (this.state.initialized) return;

    // FIXED: Query satguru_categories instead of categories
    const { data: categories, error } = await supabase
      .from('satguru_categories')
      .select('id, category_name')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to load categories: ${error.message}`);
    }

    console.log('📂 Available categories from satguru_categories:', categories?.map(c => c.category_name));
    this.state.availableCategories = categories || [];

    // Clear and rebuild category map
    this.state.categoryMap = {};
    if (categories) {
      for (const cat of categories) {
        this.addCategoryToMap(cat.category_name, cat.id);
      }
    }

    this.state.initialized = true;
    console.log('✅ Category resolver initialized with', Object.keys(this.state.categoryMap).length, 'mappings');
  }

  private addCategoryToMap(categoryName: string, categoryId: string): void {
    const entries: CategoryMapEntry[] = [];
    
    // Store original category info
    const normalizedName: string = categoryName.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Exact matches (case variations)
    entries.push(
      { key: categoryName, value: categoryId },
      { key: categoryName.toLowerCase(), value: categoryId },
      { key: categoryName.toUpperCase(), value: categoryId },
      { key: normalizedName, value: categoryId }
    );
    
    // Enhanced singular/plural variations
    this.addSingularPluralVariations(categoryName, categoryId, entries);
    
    // Add specific business logic mappings
    this.addBusinessSpecificMappings(categoryName, categoryId, entries);
    
    // Apply all entries at once to prevent deep type inference
    for (const entry of entries) {
      this.state.categoryMap[entry.key] = entry.value;
    }
    
    console.log(`🔗 Mapped category: "${categoryName}" (ID: ${categoryId})`);
  }

  private addSingularPluralVariations(categoryName: string, categoryId: string, entries: CategoryMapEntry[]): void {
    const normalized: string = categoryName.toLowerCase().trim();
    
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

    for (const pattern of pluralPatterns) {
      if (normalized.includes(pattern.plural)) {
        entries.push(
          { key: pattern.singular, value: categoryId },
          { key: pattern.singular.toUpperCase(), value: categoryId },
          { key: this.capitalize(pattern.singular), value: categoryId }
        );
      }
      if (normalized.includes(pattern.singular)) {
        entries.push(
          { key: pattern.plural, value: categoryId },
          { key: pattern.plural.toUpperCase(), value: categoryId },
          { key: this.capitalize(pattern.plural), value: categoryId }
        );
      }
    }

    // Generic singular/plural handling
    if (normalized.endsWith('s') && normalized.length > 3) {
      const singular: string = normalized.slice(0, -1);
      entries.push(
        { key: singular, value: categoryId },
        { key: singular.toUpperCase(), value: categoryId },
        { key: this.capitalize(singular), value: categoryId }
      );
    } else {
      const plural: string = normalized + 's';
      entries.push(
        { key: plural, value: categoryId },
        { key: plural.toUpperCase(), value: categoryId },
        { key: this.capitalize(plural), value: categoryId }
      );
    }
  }

  private addBusinessSpecificMappings(categoryName: string, categoryId: string, entries: CategoryMapEntry[]): void {
    const normalized: string = categoryName.toLowerCase();
    
    // Flexible packaging specific mappings
    if (normalized.includes('cylinder')) {
      entries.push(
        { key: 'printing cylinder', value: categoryId },
        { key: 'gravure cylinder', value: categoryId },
        { key: 'cylinders', value: categoryId },
        { key: 'cylinder', value: categoryId }
      );
    }
    
    if (normalized.includes('consumable')) {
      entries.push(
        { key: 'consumable', value: categoryId },
        { key: 'CONSUMABLE', value: categoryId },
        { key: 'Consumable', value: categoryId }
      );
    }
    
    if (normalized.includes('raw material')) {
      entries.push(
        { key: 'raw material', value: categoryId },
        { key: 'RAW MATERIAL', value: categoryId },
        { key: 'Raw Material', value: categoryId }
      );
    }
    
    if (normalized.includes('finished good')) {
      entries.push(
        { key: 'finished good', value: categoryId },
        { key: 'FINISHED GOOD', value: categoryId },
        { key: 'Finished Good', value: categoryId }
      );
    }
  }

  private capitalize(str: string): string {
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }

  resolveCategoryId(categoryName: string): string | null {
    if (!this.state.initialized) {
      throw new Error('CategoryResolver not initialized. Call initialize() first.');
    }

    if (!categoryName || typeof categoryName !== 'string') {
      console.warn('⚠️ Invalid category name provided:', categoryName);
      return null;
    }

    const trimmedCategory: string = categoryName.trim();
    console.log(`🔍 Resolving category: "${trimmedCategory}"`);
    
    // Phase 1: Exact match (case-sensitive)
    if (this.state.categoryMap[trimmedCategory]) {
      const result: string = this.state.categoryMap[trimmedCategory];
      console.log(`✅ Exact match found: "${trimmedCategory}" → ${result}`);
      return result;
    }

    // Phase 2: Case-insensitive exact match
    const lowerCase: string = trimmedCategory.toLowerCase();
    if (this.state.categoryMap[lowerCase]) {
      const result: string = this.state.categoryMap[lowerCase];
      console.log(`✅ Case-insensitive match found: "${trimmedCategory}" → ${result}`);
      return result;
    }

    // Phase 3: Normalized match (remove extra spaces)
    const normalized: string = lowerCase.replace(/\s+/g, ' ');
    if (this.state.categoryMap[normalized]) {
      const result: string = this.state.categoryMap[normalized];
      console.log(`✅ Normalized match found: "${trimmedCategory}" → ${result}`);
      return result;
    }

    // Phase 4: Fuzzy matching with improved logic
    const fuzzyMatches: string[] = Object.keys(this.state.categoryMap).filter(key => {
      const keyLower: string = key.toLowerCase();
      const categoryLower: string = lowerCase;
      
      // Bidirectional substring matching
      return keyLower.includes(categoryLower) || 
             categoryLower.includes(keyLower) ||
             this.levenshteinDistance(keyLower, categoryLower) <= 2;
    });

    if (fuzzyMatches.length > 0) {
      // Sort by best match (shortest distance)
      const bestMatch: string = fuzzyMatches.sort((a, b) => {
        const distA: number = this.levenshteinDistance(a.toLowerCase(), lowerCase);
        const distB: number = this.levenshteinDistance(b.toLowerCase(), lowerCase);
        return distA - distB;
      })[0];
      
      const result: string = this.state.categoryMap[bestMatch];
      console.log(`✅ Fuzzy match found: "${trimmedCategory}" → "${bestMatch}" → ${result}`);
      return result;
    }

    // Phase 5: Failed to resolve - provide detailed error info
    console.error(`❌ No category match found for: "${trimmedCategory}"`);
    console.log('📋 Available category names:', this.state.availableCategories.map(c => c.category_name));
    console.log('🔧 Top suggestions:', this.getSuggestions(trimmedCategory));
    
    return null;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator: number = str1[i - 1] === str2[j - 1] ? 0 : 1;
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
    const suggestions: string[] = this.state.availableCategories
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
    return { ...this.state.categoryMap };
  }

  getUnmappedCategories(categoryNames: string[]): string[] {
    return categoryNames.filter(name => {
      const resolved: string | null = this.resolveCategoryId(name);
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
      const suggestions: string[] = this.getSuggestions(categoryName);
      if (suggestions.length > 0) {
        const bestSuggestion: string = suggestions[0];
        const distance: number = this.levenshteinDistance(categoryName.toLowerCase(), bestSuggestion.toLowerCase());
        
        if (distance <= 2) {
          console.log(`🔄 Mapping "${categoryName}" to existing "${bestSuggestion}" instead of creating new`);
          return this.resolveCategoryId(bestSuggestion);
        }
      }
      
      // Create new category with enhanced description
      let description: string = `Auto-created during bulk upload for flexible packaging`;
      const lowerName: string = categoryName.toLowerCase();
      
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
      const resolved: string | null = this.resolveCategoryId(categoryName);
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
