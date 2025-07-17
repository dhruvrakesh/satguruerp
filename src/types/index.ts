// Global type definitions
export interface AuthError {
  message: string;
  code?: string;
}

export interface AuthResponse {
  error?: AuthError | null;
}

export interface BulkUploadError {
  rowNumber: number;
  reason: string;
  data: Record<string, string>;
}

export interface BulkUploadResult {
  successCount: number;
  errorCount: number;
  errors: BulkUploadError[];
}

export interface CSVRowData {
  [key: string]: string;
}

export interface DatabaseError extends Error {
  code?: string;
  details?: string;
  hint?: string;
}