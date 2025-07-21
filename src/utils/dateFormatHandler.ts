
/**
 * Comprehensive date format handler for CSV uploads
 * Handles multiple date formats and converts to PostgreSQL-compatible format
 */

export interface DateParseResult {
  success: boolean;
  date?: string;
  error?: string;
  originalValue: string;
}

export class DateFormatHandler {
  private static readonly DATE_FORMATS = [
    // DD-MM-YYYY formats
    { pattern: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, type: 'DD-MM-YYYY' },
    // MM-DD-YYYY formats  
    { pattern: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, type: 'MM-DD-YYYY' },
    // YYYY-MM-DD formats (already correct)
    { pattern: /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, type: 'YYYY-MM-DD' },
    // DD/MM/YY formats
    { pattern: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/, type: 'DD-MM-YY' }
  ];

  /**
   * Parse date string and convert to YYYY-MM-DD format
   */
  static parseDate(dateStr: string): DateParseResult {
    if (!dateStr || typeof dateStr !== 'string') {
      return {
        success: false,
        error: 'Date is required',
        originalValue: dateStr || ''
      };
    }

    const trimmedDate = dateStr.trim();
    
    // If already in YYYY-MM-DD format, validate and return
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      const date = new Date(trimmedDate);
      if (isNaN(date.getTime())) {
        return {
          success: false,
          error: 'Invalid date value',
          originalValue: dateStr
        };
      }
      return {
        success: true,
        date: trimmedDate,
        originalValue: dateStr
      };
    }

    // Try to parse various formats
    for (const format of this.DATE_FORMATS) {
      const match = trimmedDate.match(format.pattern);
      if (match) {
        try {
          const result = this.convertToPostgreSQLFormat(match, format.type);
          if (result.success) {
            return result;
          }
        } catch (error) {
          continue; // Try next format
        }
      }
    }

    return {
      success: false,
      error: `Unsupported date format: ${dateStr}. Expected formats: DD-MM-YYYY, MM-DD-YYYY, YYYY-MM-DD`,
      originalValue: dateStr
    };
  }

  /**
   * Convert matched date parts to PostgreSQL YYYY-MM-DD format
   */
  private static convertToPostgreSQLFormat(match: RegExpMatchArray, formatType: string): DateParseResult {
    let year: number, month: number, day: number;

    switch (formatType) {
      case 'DD-MM-YYYY':
        day = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
        break;
        
      case 'MM-DD-YYYY':
        month = parseInt(match[1], 10);
        day = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
        break;
        
      case 'YYYY-MM-DD':
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
        break;
        
      case 'DD-MM-YY':
        day = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
        // Convert 2-digit year to 4-digit (assume 20xx for years 00-50, 19xx for 51-99)
        year = year <= 50 ? 2000 + year : 1900 + year;
        break;
        
      default:
        return {
          success: false,
          error: 'Unknown date format',
          originalValue: match[0]
        };
    }

    // Validate date components
    if (month < 1 || month > 12) {
      return {
        success: false,
        error: `Invalid month: ${month}. Must be between 1-12`,
        originalValue: match[0]
      };
    }

    if (day < 1 || day > 31) {
      return {
        success: false,
        error: `Invalid day: ${day}. Must be between 1-31`,
        originalValue: match[0]
      };
    }

    // Create date object to validate the actual date
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return {
        success: false,
        error: `Invalid date: ${day}/${month}/${year}`,
        originalValue: match[0]
      };
    }

    // Format as YYYY-MM-DD
    const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    
    return {
      success: true,
      date: formattedDate,
      originalValue: match[0]
    };
  }

  /**
   * Batch process multiple dates
   */
  static batchParseDate(dates: string[]): { success: DateParseResult[], failed: DateParseResult[] } {
    const success: DateParseResult[] = [];
    const failed: DateParseResult[] = [];

    dates.forEach(dateStr => {
      const result = this.parseDate(dateStr);
      if (result.success) {
        success.push(result);
      } else {
        failed.push(result);
      }
    });

    return { success, failed };
  }
}
