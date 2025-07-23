
import { Json } from "@/integrations/supabase/types";

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors?: any[];
  [key: string]: Json | undefined;
}

export function isBulkOperationResult(data: Json): data is BulkOperationResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data) &&
    'success' in data &&
    'failed' in data &&
    typeof (data as any).success === 'number' &&
    typeof (data as any).failed === 'number'
  );
}

export function safeParseBulkOperationResult(data: Json): BulkOperationResult {
  if (isBulkOperationResult(data)) {
    return data;
  }
  
  // Fallback for unexpected formats
  console.warn('Unexpected bulk operation result format:', data);
  return {
    success: 0,
    failed: 1,
    errors: ['Unexpected result format from database']
  };
}
