
import { z } from "zod";

export const itemMasterSchema = z.object({
  item_code: z.string().min(1, "Item code is required"),
  item_name: z.string().min(2, "Item name must be at least 2 characters"),
  category_id: z.string().uuid("Invalid category"),
  qualifier: z.string().optional(),
  gsm: z.number().positive("GSM must be positive").max(500, "GSM seems too high").optional(),
  size_mm: z.string().optional(),
  uom: z.enum(["PCS", "KG", "MTR", "SQM", "LTR", "BOX", "ROLL"], {
    errorMap: () => ({ message: "Please select a valid unit of measure" })
  }),
  usage_type: z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "WIP", "PACKAGING", "CONSUMABLE"]).default("RAW_MATERIAL"),
  status: z.enum(["active", "inactive"]).default("active")
});

export const itemMasterUpdateSchema = itemMasterSchema.partial().omit({ item_code: true });

export type ItemMasterFormData = z.infer<typeof itemMasterSchema>;

// Enhanced CSV schema with comprehensive transformation support
export const csvItemSchema = z.object({
  item_name: z.string().min(1, "Item name is required"),
  category_name: z.string().min(1, "Category name is required"),
  qualifier: z.string().optional(),
  gsm: z.union([
    z.string().transform((val) => {
      if (!val || val.trim() === '') return undefined;
      // Extract numeric part from mixed alphanumeric strings
      const numericMatch = val.toString().match(/(\d+\.?\d*)/);
      return numericMatch ? parseFloat(numericMatch[1]) : undefined;
    }),
    z.number()
  ]).optional(),
  size_mm: z.union([
    z.string(),
    z.number().transform((val) => val.toString())
  ]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return undefined;
    return val.toString().trim();
  }),
  uom: z.string().transform((val) => {
    // Comprehensive UOM mapping with common variations
    const uomMap: Record<string, string> = {
      // Standard mappings
      'kg': 'KG',
      'pcs': 'PCS', 
      'mtr': 'MTR',
      'sqm': 'SQM',
      'ltr': 'LTR',
      'box': 'BOX',
      'roll': 'ROLL',
      
      // Plural forms
      'boxes': 'BOX',
      'rolls': 'ROLL',
      'pieces': 'PCS',
      'meters': 'MTR',
      'metres': 'MTR',
      'litres': 'LTR',
      'liters': 'LTR',
      
      // Common variations
      'meter': 'MTR',
      'metre': 'MTR',
      'piece': 'PCS',
      'litre': 'LTR',
      'liter': 'LTR',
      'square meter': 'SQM',
      'square metre': 'SQM',
      'sqmeter': 'SQM',
      'sqmetre': 'SQM',
      
      // Industry specific
      'nos': 'PCS',
      'no': 'PCS',
      'number': 'PCS',
      'numbers': 'PCS',
      'unit': 'PCS',
      'units': 'PCS',
      'each': 'PCS',
      'ea': 'PCS',
      
      // Weight variations
      'kilogram': 'KG',
      'kilograms': 'KG',
      'kilo': 'KG',
      'kilos': 'KG',
      
      // Length variations
      'm': 'MTR',
      'mt': 'MTR',
      'mts': 'MTR',
      
      // Volume variations
      'l': 'LTR',
      'lt': 'LTR',
      'lts': 'LTR'
    };
    
    const normalizedVal = val.toLowerCase().trim();
    const mappedValue = uomMap[normalizedVal];
    
    if (mappedValue) {
      return mappedValue;
    }
    
    // If no mapping found, try uppercase
    const upperVal = val.toUpperCase().trim();
    if (['PCS', 'KG', 'MTR', 'SQM', 'LTR', 'BOX', 'ROLL'].includes(upperVal)) {
      return upperVal;
    }
    
    // If still no match, provide helpful error
    throw new Error(`Invalid UOM: "${val}". Expected one of: PCS, KG, MTR, SQM, LTR, BOX, ROLL or their variations like boxes, nos, kg, etc.`);
  }).pipe(z.enum(["PCS", "KG", "MTR", "SQM", "LTR", "BOX", "ROLL"])),
  usage_type: z.string().optional().transform((val) => {
    if (!val) return 'RAW_MATERIAL';
    
    // Transform descriptive usage types to enum values
    const typeMap: Record<string, string> = {
      'wrapper': 'RAW_MATERIAL',
      'lamination': 'RAW_MATERIAL',
      'coating': 'RAW_MATERIAL', 
      'adhesive': 'RAW_MATERIAL',
      'film': 'RAW_MATERIAL',
      'paper': 'RAW_MATERIAL',
      'ink': 'RAW_MATERIAL',
      'solvent': 'RAW_MATERIAL',
      'chemical': 'RAW_MATERIAL',
      'packaging': 'PACKAGING',
      'consumable': 'CONSUMABLE',
      'finished': 'FINISHED_GOOD',
      'wip': 'WIP',
      'raw material': 'RAW_MATERIAL',
      'raw_material': 'RAW_MATERIAL',
      'finished_good': 'FINISHED_GOOD',
      'finished good': 'FINISHED_GOOD'
    };
    
    return typeMap[val.toLowerCase().trim()] || 'RAW_MATERIAL';
  }).pipe(z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "WIP", "PACKAGING", "CONSUMABLE"])),
  reorder_level: z.string().optional().transform((val) => val ? parseFloat(val) : undefined),
  specifications: z.string().optional()
});

export type CsvItemData = z.infer<typeof csvItemSchema>;

// Enhanced validation helpers with better error reporting
export const validateBulkUploadData = (data: any[]): { valid: any[], invalid: Array<{row: number, errors: string[]}> } => {
  const valid: any[] = [];
  const invalid: Array<{row: number, errors: string[]}> = [];
  
  data.forEach((row, index) => {
    try {
      const validatedRow = csvItemSchema.parse(row);
      valid.push(validatedRow);
    } catch (error: any) {
      const errors = error.errors?.map((e: any) => {
        const field = e.path.join('.');
        let message = e.message;
        
        // Provide more helpful error messages for common issues
        if (field === 'uom' && message.includes('Invalid enum value')) {
          message = `Invalid UOM: "${row.uom}". Supported values: PCS, KG, MTR, SQM, LTR, BOX, ROLL (or variations like boxes, nos, kg, etc.)`;
        } else if (field === 'size_mm' && message.includes('Expected string')) {
          message = `Size MM should be text format. Found: ${row.size_mm}`;
        }
        
        return `${field}: ${message}`;
      }) || ['Validation failed'];
      
      invalid.push({ row: index + 1, errors });
    }
  });
  
  return { valid, invalid };
};
