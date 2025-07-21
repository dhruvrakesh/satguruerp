import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BulkValidationResult {
  row_num: number;
  item_code: string;
  item_name: string;
  available_qty: number;
  requested_qty: number;
  validation_status: string;
  error_message: string;
}

export interface BulkProcessResult {
  processed_count: number;
  error_count: number;
  total_count: number;
  success: boolean;
}

export function useBulkIssueValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const validateBulk = async (items: Array<{ item_code: string; qty_issued: number; row_num?: number }>): Promise<BulkValidationResult[]> => {
    setIsValidating(true);
    try {
      // Add row numbers if not provided
      const itemsWithRowNum = items.map((item, index) => ({
        ...item,
        row_num: item.row_num ?? index + 1
      }));

      const { data, error } = await supabase.rpc('validate_issue_batch', {
        p_items: itemsWithRowNum
      });

      if (error) throw error;
      return (data || []) as BulkValidationResult[];
    } finally {
      setIsValidating(false);
    }
  };

  const processBulk = async (validatedItems: BulkValidationResult[]): Promise<BulkProcessResult> => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.rpc('process_issue_batch', {
        p_rows: validatedItems as any
      });

      if (error) throw error;
      
      // Handle the response data properly
      const result = data as any;
      return {
        processed_count: result?.processed_count || 0,
        error_count: result?.error_count || 0,
        total_count: result?.total_count || 0,
        success: result?.success || false
      };
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    validateBulk,
    processBulk,
    isValidating,
    isProcessing
  };
}