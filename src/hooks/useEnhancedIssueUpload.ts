
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DateFormatHandler } from '@/utils/dateFormatHandler';

export interface DuplicateRecord {
  row_num: number;
  item_code: string;
  date: string;
  qty_issued: number;
  purpose: string;
  is_duplicate: boolean;
  existing_record_id?: string;
}

export interface EnhancedUploadResult {
  total_processed: number;
  successful_inserts: number;
  duplicates_skipped: number;
  validation_errors: number;
  duplicates: DuplicateRecord[];
  errors: Array<{ row: number; message: string }>;
  success: boolean;
  date_format_errors?: number;
}

export interface IssueRecord {
  item_code: string;
  qty_issued: number;
  date: string;
  purpose: string;
  remarks?: string;
}

// Optimized batching configuration for query complexity management
const BATCH_CONFIG = {
  DUPLICATE_CHECK_BATCH_SIZE: 20, // Reduced from 50 to avoid query complexity
  SUB_QUERY_SIZE: 10, // Maximum records per sub-query
  INTER_BATCH_DELAY: 150, // Increased delay for better resource recovery
  MAX_RETRIES: 3,
  RETRY_DELAY: 500
};

export function useEnhancedIssueUpload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();

  // Enhanced record preprocessing with date format handling
  const preprocessRecords = (records: any[]): { validRecords: IssueRecord[], errors: Array<{ row: number; message: string }> } => {
    console.log('🔄 Preprocessing records with date format handling...');
    
    const validRecords: IssueRecord[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    records.forEach((record, index) => {
      const rowNum = index + 1;
      
      try {
        // Parse and validate date
        const dateParseResult = DateFormatHandler.parseDate(record.date);
        if (!dateParseResult.success) {
          errors.push({
            row: rowNum,
            message: `Date format error: ${dateParseResult.error}. Original: "${dateParseResult.originalValue}"`
          });
          return;
        }

        // Validate other required fields
        if (!record.item_code || !record.qty_issued) {
          errors.push({
            row: rowNum,
            message: 'Missing required fields: item_code and qty_issued are required'
          });
          return;
        }

        const qty = Number(record.qty_issued);
        if (isNaN(qty) || qty <= 0) {
          errors.push({
            row: rowNum,
            message: `Invalid quantity: ${record.qty_issued}. Must be a positive number`
          });
          return;
        }

        // Create valid record with parsed date
        validRecords.push({
          item_code: record.item_code.trim(),
          qty_issued: qty,
          date: dateParseResult.date!, // Use parsed and validated date
          purpose: record.purpose || 'General',
          remarks: record.remarks || ''
        });

      } catch (error) {
        errors.push({
          row: rowNum,
          message: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    });

    console.log('✅ Preprocessing complete:', {
      total_input: records.length,
      valid_records: validRecords.length,
      errors: errors.length
    });

    return { validRecords, errors };
  };

  // Utility function for batch delays and resource recovery
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Optimized duplicate checking with simplified query strategy
  const checkForDuplicatesBatched = async (records: IssueRecord[]): Promise<DuplicateRecord[]> => {
    console.log('🔍 Starting optimized duplicate check for', records.length, 'records...');
    
    const totalBatches = Math.ceil(records.length / BATCH_CONFIG.DUPLICATE_CHECK_BATCH_SIZE);
    const duplicateResults: DuplicateRecord[] = [];
    
    setBatchProgress({ current: 0, total: totalBatches });
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * BATCH_CONFIG.DUPLICATE_CHECK_BATCH_SIZE;
      const endIndex = Math.min(startIndex + BATCH_CONFIG.DUPLICATE_CHECK_BATCH_SIZE, records.length);
      const batch = records.slice(startIndex, endIndex);
      
      console.log(`🔄 Processing batch ${batchIndex + 1}/${totalBatches} (records ${startIndex + 1}-${endIndex})`);
      setBatchProgress({ current: batchIndex + 1, total: totalBatches });
      
      let retryCount = 0;
      let batchSuccess = false;
      
      while (!batchSuccess && retryCount < BATCH_CONFIG.MAX_RETRIES) {
        try {
          const batchResults = await checkBatchForDuplicatesOptimized(batch, startIndex);
          duplicateResults.push(...batchResults);
          batchSuccess = true;
          
          console.log(`✅ Batch ${batchIndex + 1} completed successfully`);
          
        } catch (error) {
          retryCount++;
          console.warn(`⚠️ Batch ${batchIndex + 1} failed, retry ${retryCount}/${BATCH_CONFIG.MAX_RETRIES}:`, error);
          
          if (retryCount < BATCH_CONFIG.MAX_RETRIES) {
            await delay(BATCH_CONFIG.RETRY_DELAY * retryCount); // Exponential backoff
          } else {
            console.error(`❌ Batch ${batchIndex + 1} failed after ${BATCH_CONFIG.MAX_RETRIES} retries`);
            // Fall back to individual record checking for failed batch
            const fallbackResults = await checkBatchIndividually(batch, startIndex);
            duplicateResults.push(...fallbackResults);
            batchSuccess = true;
          }
        }
      }
      
      // Inter-batch delay for resource recovery
      if (batchIndex < totalBatches - 1) {
        await delay(BATCH_CONFIG.INTER_BATCH_DELAY);
      }
    }
    
    const duplicates = duplicateResults.filter(result => result.is_duplicate);
    console.log('🔍 Optimized duplicate check complete:', {
      total_checked: records.length,
      duplicates_found: duplicates.length,
      batches_processed: totalBatches
    });
    
    setBatchProgress({ current: 0, total: 0 });
    return duplicateResults;
  };

  // Optimized batch duplicate check using grouped queries
  const checkBatchForDuplicatesOptimized = async (batch: IssueRecord[], startIndex: number): Promise<DuplicateRecord[]> => {
    if (batch.length === 0) return [];
    
    console.log(`🔍 Optimized duplicate check for batch of ${batch.length} records`);
    
    // Group records by item_code to reduce query complexity
    const itemCodeGroups = new Map<string, IssueRecord[]>();
    batch.forEach(record => {
      const existing = itemCodeGroups.get(record.item_code) || [];
      existing.push(record);
      itemCodeGroups.set(record.item_code, existing);
    });
    
    const existingRecordsMap = new Map<string, string>();
    
    // Process each item_code group with simplified queries
    for (const [itemCode, groupRecords] of itemCodeGroups) {
      try {
        // Split group into sub-queries if too large
        const subQuerySize = BATCH_CONFIG.SUB_QUERY_SIZE;
        const subQueries = [];
        
        for (let i = 0; i < groupRecords.length; i += subQuerySize) {
          const subGroup = groupRecords.slice(i, i + subQuerySize);
          subQueries.push(subGroup);
        }
        
        // Process each sub-query
        for (const subGroup of subQueries) {
          const dates = subGroup.map(r => r.date);
          const quantities = subGroup.map(r => r.qty_issued);
          const purposes = subGroup.map(r => r.purpose);
          
          // Use IN queries instead of complex OR conditions
          const { data, error } = await supabase
            .from('satguru_issue_log')
            .select('id, item_code, date, qty_issued, purpose')
            .eq('item_code', itemCode)
            .in('date', dates)
            .in('qty_issued', quantities)
            .in('purpose', purposes);
          
          if (error) {
            throw new Error(`Sub-query failed for item ${itemCode}: ${error.message}`);
          }
          
          // Map results to existing records
          data?.forEach(existing => {
            const key = `${existing.item_code}-${existing.date}-${existing.qty_issued}-${existing.purpose}`;
            existingRecordsMap.set(key, existing.id);
          });
        }
        
        // Small delay between item groups to prevent resource exhaustion
        await delay(50);
        
      } catch (error) {
        console.warn(`⚠️ Failed to check duplicates for item ${itemCode}:`, error);
        // Continue with other items rather than failing the entire batch
      }
    }
    
    // Map batch results
    return batch.map((record, index) => {
      const key = `${record.item_code}-${record.date}-${record.qty_issued}-${record.purpose}`;
      const existingRecordId = existingRecordsMap.get(key);
      
      return {
        row_num: startIndex + index + 1,
        item_code: record.item_code,
        date: record.date,
        qty_issued: record.qty_issued,
        purpose: record.purpose,
        is_duplicate: !!existingRecordId,
        existing_record_id: existingRecordId
      };
    });
  };

  // Fallback individual record checking for extreme cases
  const checkBatchIndividually = async (batch: IssueRecord[], startIndex: number): Promise<DuplicateRecord[]> => {
    console.log(`🔄 Fallback: Individual duplicate check for ${batch.length} records`);
    
    const results: DuplicateRecord[] = [];
    
    for (let i = 0; i < batch.length; i++) {
      const record = batch[i];
      
      try {
        const { data, error } = await supabase
          .from('satguru_issue_log')
          .select('id')
          .eq('item_code', record.item_code)
          .eq('date', record.date)
          .eq('qty_issued', record.qty_issued)
          .eq('purpose', record.purpose)
          .limit(1);
        
        if (error) {
          console.warn(`⚠️ Individual check failed for record ${i + 1}:`, error);
        }
        
        results.push({
          row_num: startIndex + i + 1,
          item_code: record.item_code,
          date: record.date,
          qty_issued: record.qty_issued,
          purpose: record.purpose,
          is_duplicate: !!(data && data.length > 0),
          existing_record_id: data && data.length > 0 ? data[0].id : undefined
        });
        
        // Small delay between individual checks
        await delay(10);
        
      } catch (error) {
        console.error(`❌ Individual record check failed:`, error);
        // Assume not duplicate to allow processing to continue
        results.push({
          row_num: startIndex + i + 1,
          item_code: record.item_code,
          date: record.date,
          qty_issued: record.qty_issued,
          purpose: record.purpose,
          is_duplicate: false
        });
      }
    }
    
    return results;
  };

  // Enhanced upload with comprehensive error handling and recovery
  const uploadWithDuplicateHandling = async (
    records: any[], // Raw CSV records
    options: {
      skipDuplicates?: boolean;
      showDuplicateWarning?: boolean;
    } = {}
  ): Promise<EnhancedUploadResult> => {
    setIsProcessing(true);
    setUploadProgress(0);

    try {
      console.log('🚀 Starting enhanced upload with optimized query management...', {
        total_records: records.length,
        skip_duplicates: options.skipDuplicates,
        show_warnings: options.showDuplicateWarning,
        batch_size: BATCH_CONFIG.DUPLICATE_CHECK_BATCH_SIZE,
        sub_query_size: BATCH_CONFIG.SUB_QUERY_SIZE
      });

      // Step 1: Preprocess records with date parsing (20% progress)
      setUploadProgress(20);
      const { validRecords, errors: preprocessingErrors } = preprocessRecords(records);
      
      if (preprocessingErrors.length > 0) {
        console.log('⚠️ Date format and validation errors found:', preprocessingErrors.length);
      }

      if (validRecords.length === 0) {
        return {
          total_processed: records.length,
          successful_inserts: 0,
          duplicates_skipped: 0,
          validation_errors: preprocessingErrors.length,
          duplicates: [],
          errors: preprocessingErrors,
          success: false,
          date_format_errors: preprocessingErrors.filter(e => e.message.includes('Date format')).length
        };
      }

      // Step 2: Optimized duplicate check (40% progress)
      setUploadProgress(40);
      const duplicateChecks = await checkForDuplicatesBatched(validRecords);
      const duplicates = duplicateChecks.filter(check => check.is_duplicate);

      if (duplicates.length > 0 && options.showDuplicateWarning && !options.skipDuplicates) {
        return {
          total_processed: records.length,
          successful_inserts: 0,
          duplicates_skipped: 0,
          validation_errors: preprocessingErrors.length,
          duplicates,
          errors: preprocessingErrors,
          success: false,
          date_format_errors: preprocessingErrors.filter(e => e.message.includes('Date format')).length
        };
      }

      // Step 3: Filter out duplicates if requested (60% progress)
      setUploadProgress(60);
      const recordsToProcess = options.skipDuplicates 
        ? validRecords.filter((_, index) => !duplicateChecks[index].is_duplicate)
        : validRecords;

      if (recordsToProcess.length === 0) {
        return {
          total_processed: records.length,
          successful_inserts: 0,
          duplicates_skipped: duplicates.length,
          validation_errors: preprocessingErrors.length,
          duplicates,
          errors: preprocessingErrors,
          success: true,
          date_format_errors: preprocessingErrors.filter(e => e.message.includes('Date format')).length
        };
      }

      // Step 4: Validate stock availability (80% progress)
      setUploadProgress(80);
      const stockValidationErrors: Array<{ row: number; message: string }> = [];
      
      for (let i = 0; i < recordsToProcess.length; i++) {
        const record = recordsToProcess[i];
        const originalIndex = validRecords.findIndex(r => 
          r.item_code === record.item_code && 
          r.date === record.date && 
          r.qty_issued === record.qty_issued
        );

        try {
          const { data: stockData } = await supabase
            .from('satguru_stock_summary_view')
            .select('current_qty')
            .eq('item_code', record.item_code)
            .single();

          if (!stockData || stockData.current_qty < record.qty_issued) {
            stockValidationErrors.push({
              row: originalIndex + 1,
              message: `Insufficient stock for ${record.item_code}. Available: ${stockData?.current_qty || 0}, Requested: ${record.qty_issued}`
            });
          }
        } catch (error) {
          stockValidationErrors.push({
            row: originalIndex + 1,
            message: `Stock validation failed for ${record.item_code}: ${error}`
          });
        }
      }

      // Step 5: Insert valid records (90% progress)
      setUploadProgress(90);
      const finalRecordsToInsert = recordsToProcess.filter((_, index) => {
        const originalIndex = validRecords.findIndex(r => 
          r.item_code === recordsToProcess[index].item_code && 
          r.date === recordsToProcess[index].date && 
          r.qty_issued === recordsToProcess[index].qty_issued
        );
        return !stockValidationErrors.some(error => error.row === originalIndex + 1);
      });

      let successfulInserts = 0;
      const insertErrors: Array<{ row: number; message: string }> = [];

      if (finalRecordsToInsert.length > 0) {
        try {
          const { data, error } = await supabase
            .from('satguru_issue_log')
            .insert(finalRecordsToInsert.map(record => ({
              ...record,
              created_at: new Date().toISOString()
            })));

          if (error) {
            console.error('❌ Insert error:', error);
            insertErrors.push({
              row: 0,
              message: `Insert failed: ${error.message}`
            });
          } else {
            successfulInserts = finalRecordsToInsert.length;
            console.log('✅ Successfully inserted', successfulInserts, 'records');
          }
        } catch (error: any) {
          console.error('❌ Insert failed:', error);
          insertErrors.push({
            row: 0,
            message: `Insert failed: ${error.message}`
          });
        }
      }

      // Step 6: Complete (100% progress)
      setUploadProgress(100);

      const allErrors = [...preprocessingErrors, ...stockValidationErrors, ...insertErrors];
      const result: EnhancedUploadResult = {
        total_processed: records.length,
        successful_inserts: successfulInserts,
        duplicates_skipped: duplicates.length,
        validation_errors: allErrors.length,
        duplicates,
        errors: allErrors,
        success: successfulInserts > 0 || (duplicates.length > 0 && options.skipDuplicates),
        date_format_errors: preprocessingErrors.filter(e => e.message.includes('Date format')).length
      };

      console.log('✅ Enhanced optimized upload complete:', result);

      // Show appropriate toast message
      if (result.successful_inserts > 0) {
        const message = `Successfully uploaded ${result.successful_inserts} records`;
        const details = [];
        if (result.duplicates_skipped > 0) details.push(`${result.duplicates_skipped} duplicates skipped`);
        if (result.date_format_errors > 0) details.push(`${result.date_format_errors} date format errors`);
        
        toast({
          title: "Upload Successful",
          description: details.length > 0 ? `${message} (${details.join(', ')})` : message,
        });
      } else if (result.date_format_errors > 0) {
        toast({
          title: "Date Format Errors",
          description: `${result.date_format_errors} records have date format issues. Please check the error details.`,
          variant: "destructive"
        });
      } else if (result.duplicates_skipped > 0) {
        toast({
          title: "All Records Were Duplicates",
          description: `${result.duplicates_skipped} duplicate records were skipped. No new data was added.`,
          variant: "destructive"
        });
      }

      return result;

    } catch (error: any) {
      console.error('❌ Enhanced upload failed:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "An unexpected error occurred during upload",
        variant: "destructive"
      });

      return {
        total_processed: 0,
        successful_inserts: 0,
        duplicates_skipped: 0,
        validation_errors: 0,
        duplicates: [],
        errors: [{ row: 0, message: error.message || "Unknown error" }],
        success: false,
        date_format_errors: 0
      };
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  return {
    uploadWithDuplicateHandling,
    checkForDuplicates: checkForDuplicatesBatched, // Export optimized version
    isProcessing,
    uploadProgress,
    batchProgress
  };
}
