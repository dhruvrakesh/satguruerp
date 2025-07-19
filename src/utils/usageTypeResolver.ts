
// Enhanced usage type resolution with category-aware logic for flexible packaging manufacturing
export class UsageTypeResolver {
  
  // Define valid usage types matching the database schema
  private static readonly VALID_USAGE_TYPES = [
    'RAW_MATERIAL',
    'FINISHED_GOOD', 
    'WIP',
    'PACKAGING',
    'CONSUMABLE'
  ] as const;

  // Valid usage type type
  type ValidUsageType = typeof UsageTypeResolver.VALID_USAGE_TYPES[number];

  // Category-specific usage type mappings for flexible packaging manufacturing
  private static readonly CATEGORY_USAGE_TYPE_MAP: Record<string, ValidUsageType> = {
    // Cylinders are production tools/equipment - classify as CONSUMABLE
    'cylinder': 'CONSUMABLE',
    'cylinders': 'CONSUMABLE',
    'printing cylinder': 'CONSUMABLE',
    'gravure cylinder': 'CONSUMABLE',
    
    // Raw materials for flexible packaging manufacturing
    'raw materials': 'RAW_MATERIAL',
    'raw material': 'RAW_MATERIAL',
    'chemicals': 'RAW_MATERIAL',
    'chemical': 'RAW_MATERIAL',
    'ink': 'RAW_MATERIAL',
    'inks': 'RAW_MATERIAL',
    'solvent': 'RAW_MATERIAL',
    'solvents': 'RAW_MATERIAL',
    'adhesive': 'RAW_MATERIAL',
    'adhesives': 'RAW_MATERIAL',
    'hot melt': 'RAW_MATERIAL',
    'hotmelt': 'RAW_MATERIAL',
    
    // Film materials for wrapper production
    'film': 'RAW_MATERIAL',
    'films': 'RAW_MATERIAL',
    'bopp': 'RAW_MATERIAL',
    'ldpe': 'RAW_MATERIAL',
    'pet': 'RAW_MATERIAL',
    'cpp': 'RAW_MATERIAL',
    'laminate': 'RAW_MATERIAL',
    'laminates': 'RAW_MATERIAL',
    'stiffener': 'RAW_MATERIAL',
    'stiffeners': 'RAW_MATERIAL',
    'lamination': 'RAW_MATERIAL',
    
    // Finished goods - wrapper products
    'wrapper': 'FINISHED_GOOD', // Context-dependent - will be refined below
    'wrappers': 'FINISHED_GOOD',
    'soap wrapper': 'FINISHED_GOOD',
    'flowrap': 'FINISHED_GOOD',
    'flow wrap': 'FINISHED_GOOD',
    'finished goods': 'FINISHED_GOOD',
    'finished good': 'FINISHED_GOOD',
    'final product': 'FINISHED_GOOD',
    'final products': 'FINISHED_GOOD',
    
    // Packaging materials
    'packaging': 'PACKAGING',
    'boxes': 'PACKAGING',
    'box': 'PACKAGING',
    'carton': 'PACKAGING',
    'cartons': 'PACKAGING',
    
    // Consumables and spares (both map to CONSUMABLE)
    'consumable': 'CONSUMABLE',
    'consumables': 'CONSUMABLE',
    'spares': 'CONSUMABLE',
    'spare': 'CONSUMABLE',
    'maintenance': 'CONSUMABLE',
    
    // Work in progress
    'wip': 'WIP',
    'work in progress': 'WIP'
  };

  // Pattern-based recognition for flexible packaging manufacturing
  private static readonly ITEM_PATTERNS = {
    // Raw material patterns
    raw_material: [
      /^(BOPP|LDPE|PET|CPP|BOPET)_/i,
      /_film$/i,
      /_laminate$/i,
      /^(ink|solvent|adhesive|chemical)_/i,
      /hotmelt/i,
      /stiffener/i,
      /lamination/i
    ],
    // Finished goods patterns
    finished_good: [
      /wrapper$/i,
      /^(soap|food|snack)_wrapper/i,
      /flowrap/i,
      /^finished_/i,
      /^final_/i
    ],
    // Consumable patterns (including cylinders)
    consumable: [
      /^cylinder_/i,
      /(printing|gravure)_cylinder/i,
      /^spare_/i,
      /maintenance/i
    ]
  };

  // Transform usage type with enhanced flexible packaging logic
  static transformUsageType(usageType: string, categoryName?: string, itemName?: string): ValidUsageType {
    if (!usageType || typeof usageType !== 'string') {
      console.warn('⚠️ Invalid usage type provided:', usageType);
      return this.getDefaultUsageTypeForCategory(categoryName, itemName);
    }

    const normalizedUsageType = usageType.toLowerCase().trim();
    const normalizedCategory = categoryName?.toLowerCase().trim();
    const normalizedItemName = itemName?.toLowerCase().trim();

    // First, check category-based determination
    if (normalizedCategory) {
      const categoryBasedUsageType = this.getCategoryBasedUsageType(normalizedCategory);
      if (categoryBasedUsageType) {
        console.log(`🏭 Category-based mapping: "${categoryName}" -> "${categoryBasedUsageType}"`);
        return categoryBasedUsageType;
      }
    }

    // Then check item name patterns for flexible packaging manufacturing
    if (normalizedItemName) {
      const patternBasedUsageType = this.getPatternBasedUsageType(normalizedItemName);
      if (patternBasedUsageType) {
        console.log(`📋 Pattern-based mapping: "${itemName}" -> "${patternBasedUsageType}"`);
        return patternBasedUsageType;
      }
    }

    // Finally, map the provided usage type with flexible packaging context
    const mappedUsageType = this.mapUsageTypeForFlexiblePackaging(normalizedUsageType, normalizedCategory, normalizedItemName);
    
    if (mappedUsageType !== normalizedUsageType.toUpperCase()) {
      console.log(`🔄 Usage type corrected: "${usageType}" -> "${mappedUsageType}"`);
    }
    
    return mappedUsageType;
  }

  // Get category-based usage type
  private static getCategoryBasedUsageType(categoryName: string): ValidUsageType | null {
    for (const [key, value] of Object.entries(this.CATEGORY_USAGE_TYPE_MAP)) {
      if (categoryName.includes(key) || key.includes(categoryName)) {
        return value;
      }
    }
    return null;
  }

  // Get pattern-based usage type for flexible packaging manufacturing
  private static getPatternBasedUsageType(itemName: string): ValidUsageType | null {
    // Check raw material patterns
    for (const pattern of this.ITEM_PATTERNS.raw_material) {
      if (pattern.test(itemName)) {
        return 'RAW_MATERIAL';
      }
    }

    // Check finished goods patterns
    for (const pattern of this.ITEM_PATTERNS.finished_good) {
      if (pattern.test(itemName)) {
        return 'FINISHED_GOOD';
      }
    }

    // Check consumable patterns (including cylinders)
    for (const pattern of this.ITEM_PATTERNS.consumable) {
      if (pattern.test(itemName)) {
        return 'CONSUMABLE';
      }
    }

    return null;
  }

  // Enhanced usage type mapping for flexible packaging manufacturing
  private static mapUsageTypeForFlexiblePackaging(usageType: string, categoryName?: string, itemName?: string): ValidUsageType {
    const typeMap: Record<string, ValidUsageType> = {
      // Flexible packaging specific mappings
      'wrapper': this.determineWrapperUsageType(categoryName, itemName),
      'wrappers': this.determineWrapperUsageType(categoryName, itemName),
      'lamination': 'RAW_MATERIAL',
      'coating': 'RAW_MATERIAL',
      'flowrap': 'FINISHED_GOOD',
      'flow wrap': 'FINISHED_GOOD',
      'soap wrapper': 'FINISHED_GOOD',
      'stiffener': 'RAW_MATERIAL',
      
      // Raw material mappings
      'raw material': 'RAW_MATERIAL',
      'raw_material': 'RAW_MATERIAL',
      'rawmaterial': 'RAW_MATERIAL',
      'adhesive': 'RAW_MATERIAL',
      'film': 'RAW_MATERIAL',
      'films': 'RAW_MATERIAL',
      'paper': 'RAW_MATERIAL',
      'ink': 'RAW_MATERIAL',
      'inks': 'RAW_MATERIAL',
      'solvent': 'RAW_MATERIAL',
      'solvents': 'RAW_MATERIAL',
      'chemical': 'RAW_MATERIAL',
      'chemicals': 'RAW_MATERIAL',
      'hotmelt': 'RAW_MATERIAL',
      
      // Finished goods
      'finished': 'FINISHED_GOOD',
      'finished_good': 'FINISHED_GOOD',
      'finished good': 'FINISHED_GOOD',
      'final product': 'FINISHED_GOOD',
      
      // WIP
      'wip': 'WIP',
      'work in progress': 'WIP',
      
      // Packaging
      'packaging': 'PACKAGING',
      'package': 'PACKAGING',
      'box': 'PACKAGING',
      'boxes': 'PACKAGING',
      'carton': 'PACKAGING',
      'cartons': 'PACKAGING',
      
      // Consumables (including cylinders and spares)
      'consumable': 'CONSUMABLE',
      'consumables': 'CONSUMABLE',
      'general': 'CONSUMABLE',
      'maintenance': 'CONSUMABLE',
      'spares': 'CONSUMABLE',
      'spare': 'CONSUMABLE',
      'tooling': 'CONSUMABLE',
      'equipment': 'CONSUMABLE',
      'machinery': 'CONSUMABLE',
      'machine': 'CONSUMABLE',
      'cylinder': 'CONSUMABLE',
      'cylinders': 'CONSUMABLE',
      'printing cylinder': 'CONSUMABLE',
      'gravure cylinder': 'CONSUMABLE'
    };
    
    return typeMap[usageType] || 'RAW_MATERIAL';
  }

  // Determine wrapper usage type based on context for flexible packaging
  private static determineWrapperUsageType(categoryName?: string, itemName?: string): ValidUsageType {
    if (!categoryName && !itemName) return 'FINISHED_GOOD'; // Default for wrapper
    
    const category = categoryName?.toLowerCase() || '';
    const item = itemName?.toLowerCase() || '';
    
    // If category or item suggests raw material film
    if (category.includes('raw') || category.includes('film') || 
        item.includes('bopp') || item.includes('ldpe') || item.includes('film') ||
        item.includes('laminate') || item.includes('stiffener')) {
      return 'RAW_MATERIAL';
    }
    
    // If category or item suggests finished product
    if (category.includes('finished') || category.includes('final') ||
        item.includes('soap') || item.includes('flowrap') || item.includes('ready')) {
      return 'FINISHED_GOOD';
    }
    
    // Default to finished good for wrapper manufacturing
    return 'FINISHED_GOOD';
  }

  // Get default usage type for category with flexible packaging context
  private static getDefaultUsageTypeForCategory(categoryName?: string, itemName?: string): ValidUsageType {
    if (!categoryName && !itemName) return 'RAW_MATERIAL';
    
    const normalizedCategory = categoryName?.toLowerCase().trim();
    const normalizedItemName = itemName?.toLowerCase().trim();
    
    // Check category first
    if (normalizedCategory) {
      const categoryBased = this.getCategoryBasedUsageType(normalizedCategory);
      if (categoryBased) return categoryBased;
    }
    
    // Check item patterns
    if (normalizedItemName) {
      const patternBased = this.getPatternBasedUsageType(normalizedItemName);
      if (patternBased) return patternBased;
    }
    
    return 'RAW_MATERIAL';
  }

  // Validate usage type
  static validateUsageType(usageType: string): boolean {
    return this.VALID_USAGE_TYPES.includes(usageType as ValidUsageType);
  }

  // Get validation suggestion with flexible packaging context
  static getUsageTypeSuggestion(originalValue: string, categoryName?: string, itemName?: string): string {
    const corrected = this.transformUsageType(originalValue, categoryName, itemName);
    if (corrected !== originalValue.toUpperCase()) {
      return ` Suggested: ${corrected}`;
    }
    return '';
  }

  // Enhanced logical validation for flexible packaging manufacturing
  static validateCategoryUsageTypeLogic(categoryName: string, usageType: string, itemName?: string): string | null {
    const normalizedCategory = categoryName.toLowerCase().trim();
    const normalizedItem = itemName?.toLowerCase().trim() || '';
    
    // Flexible packaging specific validations
    if (normalizedCategory.includes('cylinder') && usageType !== 'CONSUMABLE') {
      return `Logical conflict: Cylinder items should have usage type "CONSUMABLE" (production tools), not "${usageType}"`;
    }
    
    if (normalizedCategory.includes('raw') && usageType === 'FINISHED_GOOD' && !normalizedItem.includes('ready')) {
      return `Logical conflict: Raw material category "${categoryName}" should typically be "RAW_MATERIAL", not "${usageType}"`;
    }
    
    if (normalizedCategory.includes('finished') && usageType === 'RAW_MATERIAL') {
      return `Logical conflict: Finished goods category "${categoryName}" should typically be "FINISHED_GOOD", not "${usageType}"`;
    }
    
    if ((normalizedItem.includes('bopp') || normalizedItem.includes('ldpe') || normalizedItem.includes('film')) && 
        usageType === 'FINISHED_GOOD' && !normalizedItem.includes('wrapper')) {
      return `Logical conflict: Film materials should typically be "RAW_MATERIAL", not "${usageType}"`;
    }
    
    if (normalizedCategory.includes('spare') && usageType !== 'CONSUMABLE') {
      return `Logical conflict: Spare parts should be "CONSUMABLE", not "${usageType}"`;
    }
    
    return null;
  }

  // Get all valid usage types for reference
  static getValidUsageTypes(): string[] {
    return [...this.VALID_USAGE_TYPES];
  }

  // Get flexible packaging manufacturing guidance
  static getFlexiblePackagingGuidance(): Record<string, string> {
    return {
      'Raw Materials': 'Films (BOPP, LDPE, PET), Inks, Solvents, Adhesives, Hot Melts, Stiffeners, Lamination materials',
      'Finished Goods': 'Soap Wrappers, Flow Wraps, Finished Wrapper Products',
      'Consumables': 'Printing Cylinders, Gravure Cylinders, Spare Parts, Maintenance Items, General Consumables',
      'WIP': 'Semi-finished wrapper products in production',
      'Packaging': 'Boxes, Cartons for shipping finished wrappers'
    };
  }
}
