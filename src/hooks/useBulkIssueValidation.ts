
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

      console.log('🔍 Validating bulk issues - Total items:', itemsWithRowNum.length);

      // Use the new batch processing function that handles all records
      const { data, error } = await supabase.rpc('validate_issue_batch_all', {
        p_items: itemsWithRowNum
      });

      if (error) {
        console.error('❌ Bulk validation error:', error);
        throw error;
      }

      if (!Array.isArray(data)) {
        console.error('❌ Expected array but got:', typeof data, data);
        throw new Error('Invalid response format from validation service');
      }

      const results = data as unknown as BulkValidationResult[];
      console.log('✅ Bulk validation complete - Input items:', itemsWithRowNum.length, 'Validation results:', results.length);
      console.log('📊 Results breakdown:', {
        total: results.length,
        sufficient: results.filter(r => r.validation_status === 'sufficient').length,
        insufficient: results.filter(r => r.validation_status === 'insufficient_stock').length,
        notFound: results.filter(r => r.validation_status === 'not_found').length
      });
      
      // Ensure we have results for all input items
      if (results.length !== itemsWithRowNum.length) {
        console.warn('⚠️ Mismatch in validation results:', {
          inputItems: itemsWithRowNum.length,
          validationResults: results.length
        });
      }
      
      return results;
    } finally {
      setIsValidating(false);
    }
  };

  // Function to merge corrected records into validation results
  const applyCorrectionsToValidationResults = (validationResults: BulkValidationResult[]): BulkValidationResult[] => {
    console.log('🔧 Applying corrections to validation results:', {
      originalResults: validationResults.length,
      corrections: correctedRecords.length
    });

    return validationResults.map(result => {
      const correction = correctedRecords.find(c => c.rowIndex === result.row_num - 1);
      
      if (correction) {
        const updatedResult = {
          ...result,
          requested_qty: correction.corrected_qty,
          validation_status: correction.corrected_qty <= result.available_qty ? 'sufficient' : 'insufficient_stock',
          error_message: correction.corrected_qty <= result.available_qty 
            ? 'Stock sufficient (corrected)'
            : `Still insufficient after correction. Available: ${result.available_qty}, Requested: ${correction.corrected_qty}`
        };
        
        console.log('✏️ Applied correction to row', result.row_num, {
          original: result.requested_qty,
          corrected: correction.corrected_qty,
          newStatus: updatedResult.validation_status
        });
        
        return updatedResult;
      }
      
      return result;
    });
  };

  // Function to get processable records (sufficient + corrected to sufficient)
  const getProcessableRecords = (validationResults: BulkValidationResult[]): BulkValidationResult[] => {
    const correctedResults = applyCorrectionsToValidationResults(validationResults);
    const processableRecords = correctedResults.filter(r => r.validation_status === 'sufficient');
    
    console.log('📋 Processable records analysis:', {
      totalResults: correctedResults.length,
      processableRecords: processableRecords.length,
      correctedItems: correctedRecords.length,
      breakdown: {
        sufficient: correctedResults.filter(r => r.validation_status === 'sufficient').length,
        insufficient: correctedResults.filter(r => r.validation_status === 'insufficient_stock').length,
        notFound: correctedResults.filter(r => r.validation_status === 'not_found').length
      }
    });
    
    return processableRecords;
  };

  // Function to get corrected records count for UI
  const getCorrectedRecordsCount = (): number => {
    return correctedRecords.length;
  };

  // Function to get records with errors after corrections applied
  const getErrorRecordsAfterCorrections = (validationResults: BulkValidationResult[]): BulkValidationResult[] => {
    const correctedResults = applyCorrectionsToValidationResults(validationResults);
    return correctedResults.filter(r => r.validation_status !== 'sufficient');
  };

  const processBulk = async (validationResults: BulkValidationResult[]): Promise<BulkProcessResult> => {
    setIsProcessing(true);
    try {
      // Apply corrections and filter for processable records only
      const processableRecords = getProcessableRecords(validationResults);
      
      if (processableRecords.length === 0) {
        console.warn('⚠️ No processable records found');
        return {
          processed_count: 0,
          error_count: 0,
          total_count: validationResults.length,
          success: false
        };
      }

      console.log('🚀 Processing bulk issues - Processable records:', processableRecords.length);
      
      // Transform validation results to proper issue records format for backend
      const issueRecords = processableRecords.map(record => ({
        item_code: record.item_code || '',
        qty_issued: record.requested_qty || 0,
        requested_qty: record.requested_qty || 0, // For backend compatibility
        date: new Date().toISOString().split('T')[0], // Default to today
        purpose: 'Bulk upload',
        remarks: 'Processed via bulk upload'
      }));
      
      const { data, error } = await supabase.rpc('process_issue_batch', {
        p_rows: issueRecords
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
        total_count: processableRecords.length,
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
      const updated = [...existing, correction];
      console.log('💾 Applied correction for row', rowIndex + 1, {
        item_code,
        originalQty,
        correctedQty,
        totalCorrections: updated.length
      });
      return updated;
    });
  };

  const removeCorrectedQuantity = (rowIndex: number) => {
    setCorrectedRecords(prev => {
      const updated = prev.filter(r => r.rowIndex !== rowIndex);
      console.log('🗑️ Removed correction for row', rowIndex + 1, {
        remainingCorrections: updated.length
      });
      return updated;
    });
  };

  const getCorrectedQuantity = (rowIndex: number): number | null => {
    const correction = correctedRecords.find(r => r.rowIndex === rowIndex);
    return correction?.corrected_qty || null;
  };

  const resetCorrections = () => {
    setCorrectedRecords([]);
    console.log('🔄 Reset all corrections');
  };

  return {
    validateBulk,
    processBulk,
    isValidating,
    isProcessing,
    correctedRecords,
    applyCorrectedQuantity,
    removeCorrectedQuantity,
    getCorrectedQuantity,
    getCorrectedRecordsCount,
    applyCorrectionsToValidationResults,
    getProcessableRecords,
    getErrorRecordsAfterCorrections,
    resetCorrections
  };
}
