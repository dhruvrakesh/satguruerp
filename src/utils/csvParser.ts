
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

      if (lines.length === 0) {
        result.errors.push({
          rowNumber: 0,
          error: "CSV file is empty"
        });
        return result;
      }

      // Parse headers
      const headerLine = lines[0];
      const rawHeaders = this.parseCSVLine(headerLine);
      
      if (rawHeaders.length === 0) {
        result.errors.push({
          rowNumber: 1,
          error: "No headers found in CSV"
        });
        return result;
      }

      // Normalize headers and apply mapping
      const normalizedHeaders = rawHeaders.map(header => {
        const normalized = this.normalizeHeader(header);
        return headerMapping[normalized] || headerMapping[header] || normalized;
      });

      result.headers = normalizedHeaders;

      // Check for required headers
      const missingHeaders = requiredHeaders.filter(
        required => !normalizedHeaders.includes(required)
      );

      if (missingHeaders.length > 0) {
        result.errors.push({
          rowNumber: 1,
          error: `Missing required headers: ${missingHeaders.join(', ')}`
        });
        return result;
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
            continue;
          }

          // Ensure we have enough columns (pad with empty strings if needed)
          while (values.length < normalizedHeaders.length) {
            values.push('');
          }

          // Create row object
          const rowData: Record<string, string> = {};
          normalizedHeaders.forEach((header, index) => {
            let value = values[index] || '';
            if (trimValues) {
              value = value.trim();
            }
            // Remove surrounding quotes if present
            value = value.replace(/^["']|["']$/g, '');
            rowData[header] = value;
          });

          result.data.push(rowData as T);
          result.validRows++;

        } catch (error) {
          result.errors.push({
            rowNumber: lineNumber,
            error: `Failed to parse row: ${error instanceof Error ? error.message : 'Unknown error'}`,
            rawData: line
          });
        }
      }

    } catch (error) {
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
      } else if (inQuotes && char === quoteChar) {
        if (nextChar === quoteChar) {
          // Escaped quote
          current += char;
          i++; // Skip next quote
        } else {
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
    return values;
  }

  private static isEmptyRow(values: string[]): boolean {
    return values.every(value => !value || value.trim() === '');
  }
}
