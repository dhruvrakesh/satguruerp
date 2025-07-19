
// Enhanced usage type resolution with category-aware logic
export class UsageTypeResolver {
  
  // Define valid usage types
  private static readonly VALID_USAGE_TYPES = [
    'RAW_MATERIAL',
    'FINISHED_GOOD', 
    'WIP',
    'PACKAGING',
    'CONSUMABLE',
    'EQUIPMENT',
    'CYLINDER'
  ];

  // Category-specific usage type mappings
  private static readonly CATEGORY_USAGE_TYPE_MAP: Record<string, string> = {
    // Cylinders should be EQUIPMENT or CYLINDER, not WRAPPER
    'cylinder': 'CYLINDER',
    'cylinders': 'CYLINDER',
    'printing cylinder': 'CYLINDER',
    'gravure cylinder': 'CYLINDER',
    
    // Raw materials
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
    
    // Packaging
    'packaging': 'PACKAGING',
    'boxes': 'PACKAGING',
    'box': 'PACKAGING',
    'carton': 'PACKAGING',
    'cartons': 'PACKAGING',
    
    // Films and wrappers
    'film': 'RAW_MATERIAL',
    'films': 'RAW_MATERIAL',
    'wrapper': 'PACKAGING', // Wrappers are packaging, not raw material
    'wrappers': 'PACKAGING',
    
    // Consumables
    'consumable': 'CONSUMABLE',
    'consumables': 'CONSUMABLE',
    'spares': 'CONSUMABLE',
    'spare': 'CONSUMABLE',
    'maintenance': 'CONSUMABLE',
    
    // Finished goods
    'finished goods': 'FINISHED_GOOD',
    'finished good': 'FINISHED_GOOD',
    'final product': 'FINISHED_GOOD',
    'final products': 'FINISHED_GOOD'
  };

  // Transform usage type with category awareness
  static transformUsageType(usageType: string, categoryName?: string): string {
    if (!usageType || typeof usageType !== 'string') {
      console.warn('⚠️ Invalid usage type provided:', usageType);
      return this.getDefaultUsageTypeForCategory(categoryName);
    }

    const normalizedUsageType = usageType.toLowerCase().trim();
    const normalizedCategory = categoryName?.toLowerCase().trim();

    // First, check if category determines usage type (override input if conflicting)
    if (normalizedCategory) {
      const categoryBasedUsageType = this.getCategoryBasedUsageType(normalizedCategory);
      if (categoryBasedUsageType) {
        if (categoryBasedUsageType !== this.mapUsageType(normalizedUsageType)) {
          console.log(`🔄 Correcting usage type for category "${categoryName}": "${usageType}" -> "${categoryBasedUsageType}"`);
          return categoryBasedUsageType;
        }
      }
    }

    // Map the provided usage type
    return this.mapUsageType(normalizedUsageType);
  }

  // Get category-based usage type
  private static getCategoryBasedUsageType(categoryName: string): string | null {
    for (const [key, value] of Object.entries(this.CATEGORY_USAGE_TYPE_MAP)) {
      if (categoryName.includes(key) || key.includes(categoryName)) {
        return value;
      }
    }
    return null;
  }

  // Map individual usage type
  private static mapUsageType(usageType: string): string {
    const typeMap: Record<string, string> = {
      // Wrapper/packaging mappings - these should be PACKAGING, not RAW_MATERIAL
      'wrapper': 'PACKAGING',
      'wrappers': 'PACKAGING',
      'packaging': 'PACKAGING',
      'package': 'PACKAGING',
      
      // Raw material mappings
      'raw material': 'RAW_MATERIAL',
      'raw_material': 'RAW_MATERIAL',
      'rawmaterial': 'RAW_MATERIAL',
      'lamination': 'RAW_MATERIAL', 
      'coating': 'RAW_MATERIAL',
      'adhesive': 'RAW_MATERIAL',
      'film': 'RAW_MATERIAL',
      'paper': 'RAW_MATERIAL',
      'ink': 'RAW_MATERIAL',
      'solvent': 'RAW_MATERIAL',
      'chemical': 'RAW_MATERIAL',
      'hot melt': 'RAW_MATERIAL',
      
      // Finished goods
      'finished': 'FINISHED_GOOD',
      'finished_good': 'FINISHED_GOOD',
      'finished good': 'FINISHED_GOOD',
      'final product': 'FINISHED_GOOD',
      
      // WIP
      'wip': 'WIP',
      'work in progress': 'WIP',
      
      // Consumables
      'consumable': 'CONSUMABLE',
      'consumables': 'CONSUMABLE',
      'general': 'CONSUMABLE',
      'maintenance': 'CONSUMABLE',
      'spares': 'CONSUMABLE',
      'spare': 'CONSUMABLE',
      'tooling': 'CONSUMABLE',
      
      // Equipment/Cylinders
      'equipment': 'EQUIPMENT',
      'machinery': 'EQUIPMENT',
      'machine': 'EQUIPMENT',
      'cylinder': 'CYLINDER',
      'cylinders': 'CYLINDER',
      'printing cylinder': 'CYLINDER',
      'gravure cylinder': 'CYLINDER',
      
      // Hot melt specific
      'hot melt': 'RAW_MATERIAL'
    };
    
    return typeMap[usageType] || 'RAW_MATERIAL';
  }

  // Get default usage type for category
  private static getDefaultUsageTypeForCategory(categoryName?: string): string {
    if (!categoryName) return 'RAW_MATERIAL';
    
    const normalizedCategory = categoryName.toLowerCase().trim();
    return this.getCategoryBasedUsageType(normalizedCategory) || 'RAW_MATERIAL';
  }

  // Validate usage type
  static validateUsageType(usageType: string): boolean {
    return this.VALID_USAGE_TYPES.includes(usageType);
  }

  // Get validation suggestion
  static getUsageTypeSuggestion(originalValue: string, categoryName?: string): string {
    const corrected = this.transformUsageType(originalValue, categoryName);
    if (corrected !== originalValue.toUpperCase()) {
      return ` Suggested: ${corrected}`;
    }
    return '';
  }

  // Check for logical conflicts
  static validateCategoryUsageTypeLogic(categoryName: string, usageType: string): string | null {
    const normalizedCategory = categoryName.toLowerCase().trim();
    const expectedUsageType = this.getCategoryBasedUsageType(normalizedCategory);
    
    if (expectedUsageType && expectedUsageType !== usageType) {
      return `Logical conflict: Category "${categoryName}" should typically have usage type "${expectedUsageType}", not "${usageType}"`;
    }
    
    return null;
  }
}
