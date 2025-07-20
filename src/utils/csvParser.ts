
export interface CSVParseResult<T = Record<string, string>> {
  data: T[];
  errors: Array<{
    rowNumber: number;
    error: string;
    rawData?: string;
  }>;
  headers: string[];
  totalRows: number;
  validRows: number;
}

export interface CSVParserOptions {
  requiredHeaders?: string[];
  headerMapping?: Record<string, string>;
  skipEmptyRows?: boolean;
  trimValues?: boolean;
}

export class CSVParser {
  private static normalizeHeader(header: string): string {
    return header
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  static parseCSV<T = Record<string, string>>(
    csvContent: string,
    options: CSVParserOptions = {}
  ): CSVParseResult<T> {
    const {
      requiredHeaders = [],
      headerMapping = {},
      skipEmptyRows = true,
      trimValues = true
    } = options;

    const result: CSVParseResult<T> = {
      data: [],
      errors: [],
      headers: [],
      totalRows: 0,
      validRows: 0
    };

    try {
      // Split into lines and filter out completely empty lines
      const lines = csvContent
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

      console.log('📄 CSV Lines found:', lines.length);

      if (lines.length === 0) {
        result.errors.push({
          rowNumber: 0,
          error: "CSV file is empty"
        });
        return result;
      }

      // Parse headers
      const headerLine = lines[0];
      console.log('📋 Header line:', headerLine);
      
      const rawHeaders = this.parseCSVLine(headerLine);
      console.log('📋 Raw headers:', rawHeaders);
      
      if (rawHeaders.length === 0) {
        result.errors.push({
          rowNumber: 1,
          error: "No headers found in CSV"
        });
        return result;
      }

      // Apply header mapping directly without normalization for exact matches
      const processedHeaders = rawHeaders.map(header => {
        const trimmedHeader = header.trim();
        // Try exact match first
        if (headerMapping[trimmedHeader]) {
          return headerMapping[trimmedHeader];
        }
        // Try normalized match
        const normalized = this.normalizeHeader(trimmedHeader);
        if (headerMapping[normalized]) {
          return headerMapping[normalized];
        }
        // Return original if no mapping found
        return trimmedHeader;
      });

      result.headers = processedHeaders;
      console.log('📋 Processed headers:', processedHeaders);

      // Check for required headers
      const missingHeaders = requiredHeaders.filter(
        required => !processedHeaders.includes(required)
      );

      if (missingHeaders.length > 0) {
        result.errors.push({
          rowNumber: 1,
          error: `Missing required headers: ${missingHeaders.join(', ')}`
        });
      }

      // Process data rows
      for (let i = 1; i < lines.length; i++) {
        const lineNumber = i + 1;
        const line = lines[i];
        
        result.totalRows++;

        try {
          const values = this.parseCSVLine(line);
          
          // Skip empty rows if option is set
          if (skipEmptyRows && this.isEmptyRow(values)) {
            console.log(`⏭️ Skipping empty row ${lineNumber}`);
            continue;
          }

          // Ensure we have enough columns (pad with empty strings if needed)
          while (values.length < processedHeaders.length) {
            values.push('');
          }

          // Create row object
          const rowData: Record<string, string> = {};
          processedHeaders.forEach((header, index) => {
            let value = values[index] || '';
            if (trimValues) {
              value = value.trim();
            }
            // Remove surrounding quotes if present (but be careful with nested quotes)
            if (value.length >= 2 && 
                ((value.startsWith('"') && value.endsWith('"')) ||
                 (value.startsWith("'") && value.endsWith("'")))) {
              value = value.slice(1, -1);
            }
            rowData[header] = value;
          });

          console.log(`✅ Parsed row ${lineNumber}:`, rowData);
          result.data.push(rowData as T);
          result.validRows++;

        } catch (error) {
          console.error(`❌ Error parsing row ${lineNumber}:`, error);
          result.errors.push({
            rowNumber: lineNumber,
            error: `Failed to parse row: ${error instanceof Error ? error.message : 'Unknown error'}`,
            rawData: line.substring(0, 100) // Truncate for display
          });
        }
      }

      console.log('📊 CSV parsing complete:', {
        totalRows: result.totalRows,
        validRows: result.validRows,
        errors: result.errors.length,
        headers: result.headers
      });

    } catch (error) {
      console.error('💥 Fatal CSV parsing error:', error);
      result.errors.push({
        rowNumber: 0,
        error: `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return result;
  }

  private static parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        current += char; // Keep the quote as part of the value for later removal
      } else if (inQuotes && char === quoteChar) {
        if (nextChar === quoteChar) {
          // Escaped quote - add one quote to current value
          current += char;
          i++; // Skip next quote
        } else {
          // End of quoted section
          current += char; // Keep the closing quote
          inQuotes = false;
          quoteChar = '';
        }
      } else if (!inQuotes && char === ',') {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    
    console.log(`🔍 Parsed line into ${values.length} values:`, values);
    return values;
  }

  private static isEmptyRow(values: string[]): boolean {
    return values.every(value => !value || value.trim() === '');
  }
}
