
export interface ValidationRule<T = any> {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'date' | 'boolean';
  min?: number;
  max?: number;
  pattern?: RegExp;
  customValidator?: (value: any, row: T) => string | null;
  defaultValue?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  transformedData: Record<string, any>;
}

export class BulkUploadValidator {
  static validateRow<T>(
    data: Record<string, string>,
    rules: ValidationRule<T>[],
    rowNumber: number
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      transformedData: { ...data }
    };

    for (const rule of rules) {
      const value = data[rule.field];
      const isEmpty = !value || value.trim() === '';

      // Check required fields
      if (rule.required && isEmpty) {
        result.errors.push(`${rule.field} is required`);
        result.isValid = false;
        continue;
      }

      // Apply default value if empty and not required
      if (isEmpty && rule.defaultValue !== undefined) {
        result.transformedData[rule.field] = rule.defaultValue;
        continue;
      }

      // Skip validation for empty optional fields
      if (isEmpty && !rule.required) {
        continue;
      }

      // Type validation and conversion
      try {
        switch (rule.type) {
          case 'number':
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
              result.errors.push(`${rule.field} must be a valid number`);
              result.isValid = false;
            } else {
              if (rule.min !== undefined && numValue < rule.min) {
                result.errors.push(`${rule.field} must be at least ${rule.min}`);
                result.isValid = false;
              }
              if (rule.max !== undefined && numValue > rule.max) {
                result.errors.push(`${rule.field} must be at most ${rule.max}`);
                result.isValid = false;
              }
              result.transformedData[rule.field] = numValue;
            }
            break;

          case 'date':
            const dateValue = new Date(value);
            if (isNaN(dateValue.getTime())) {
              result.errors.push(`${rule.field} must be a valid date (YYYY-MM-DD)`);
              result.isValid = false;
            } else {
              result.transformedData[rule.field] = dateValue.toISOString().split('T')[0];
            }
            break;

          case 'boolean':
            const boolValue = ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
            result.transformedData[rule.field] = boolValue;
            break;

          default:
            // String validation
            if (rule.pattern && !rule.pattern.test(value)) {
              result.errors.push(`${rule.field} format is invalid`);
              result.isValid = false;
            }
            result.transformedData[rule.field] = value;
        }
      } catch (error) {
        result.errors.push(`${rule.field} validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.isValid = false;
      }

      // Custom validation
      if (rule.customValidator) {
        const customError = rule.customValidator(result.transformedData[rule.field], result.transformedData as T);
        if (customError) {
          result.errors.push(customError);
          result.isValid = false;
        }
      }
    }

    return result;
  }

  static async validateItemCode(itemCode: string): Promise<string | null> {
    // This would typically check against your item master
    if (!itemCode || itemCode.trim() === '') {
      return 'Item code is required';
    }
    return null;
  }

  static validateDate(dateString: string): string | null {
    if (!dateString || dateString.trim() === '') {
      return 'Date is required';
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid date format. Use YYYY-MM-DD';
    }

    if (date > new Date()) {
      return 'Date cannot be in the future';
    }

    return null;
  }

  static validateQuantity(qty: string): string | null {
    if (!qty || qty.trim() === '') {
      return 'Quantity is required';
    }

    const numQty = parseFloat(qty);
    if (isNaN(numQty)) {
      return 'Quantity must be a valid number';
    }

    if (numQty <= 0) {
      return 'Quantity must be greater than zero';
    }

    if (numQty > 1000000) {
      return 'Quantity seems unusually large. Please verify.';
    }

    return null;
  }
}
