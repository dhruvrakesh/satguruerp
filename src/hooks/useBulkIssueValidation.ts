
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

export interface CorrectedRecord {
  rowIndex: number;
  original_qty: number;
  corrected_qty: number;
  item_code: string;
  available_qty: number;
}

export function useBulkIssueValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [correctedRecords, setCorrectedRecords] = useState<CorrectedRecord[]>([]);

  const validateBulk = async (items: Array<{ item_code: string; qty_issued: number; row_num?: number }>): Promise<BulkValidationResult[]> => {
    setIsValidating(true);
    try {
      // Add row numbers if not provided
      const itemsWithRowNum = items.map((item, index) => ({
        ...item,
        row_num: item.row_num ?? index + 1
      }));

      console.log('🔍 Validating bulk issues:', itemsWithRowNum.length, 'items');

      const { data, error } = await supabase.rpc('validate_issue_batch', {
        p_items: itemsWithRowNum
      });

      if (error) {
        console.error('❌ Bulk validation error:', error);
        throw error;
      }

      const results = (data || []) as BulkValidationResult[];
      console.log('✅ Bulk validation complete:', results.length, 'results');
      
      return results;
    } finally {
      setIsValidating(false);
    }
  };

  const processBulk = async (validatedItems: BulkValidationResult[]): Promise<BulkProcessResult> => {
    setIsProcessing(true);
    try {
      console.log('🚀 Processing bulk issues:', validatedItems.length, 'items');
      
      const { data, error } = await supabase.rpc('process_issue_batch', {
        p_rows: validatedItems as any
      });

      if (error) {
        console.error('❌ Bulk processing error:', error);
        throw error;
      }
      
      const result = data as any;
      console.log('✅ Bulk processing complete:', result);
      
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

  const applyCorrectedQuantity = (rowIndex: number, item_code: string, originalQty: number, correctedQty: number, availableQty: number) => {
    const correction: CorrectedRecord = {
      rowIndex,
      item_code,
      original_qty: originalQty,
      corrected_qty: correctedQty,
      available_qty: availableQty
    };

    setCorrectedRecords(prev => {
      const existing = prev.filter(r => r.rowIndex !== rowIndex);
      return [...existing, correction];
    });
  };

  const removeCorrectedQuantity = (rowIndex: number) => {
    setCorrectedRecords(prev => prev.filter(r => r.rowIndex !== rowIndex));
  };

  const getCorrectedQuantity = (rowIndex: number): number | null => {
    const correction = correctedRecords.find(r => r.rowIndex === rowIndex);
    return correction?.corrected_qty || null;
  };

  return {
    validateBulk,
    processBulk,
    isValidating,
    isProcessing,
    correctedRecords,
    applyCorrectedQuantity,
    removeCorrectedQuantity,
    getCorrectedQuantity
  };
}
