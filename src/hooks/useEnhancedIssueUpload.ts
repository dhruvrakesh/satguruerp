
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

export function useEnhancedIssueUpload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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

  // Enhanced duplicate check with better error handling
  const checkForDuplicates = async (records: IssueRecord[]): Promise<DuplicateRecord[]> => {
    console.log('🔍 Checking for duplicates in', records.length, 'records...');
    
    try {
      const duplicateChecks = await Promise.all(
        records.map(async (record, index) => {
          try {
            const { data, error } = await supabase
              .from('satguru_issue_log')
              .select('id')
              .eq('item_code', record.item_code)
              .eq('date', record.date) // Now using properly formatted date
              .eq('qty_issued', record.qty_issued)
              .eq('purpose', record.purpose)
              .limit(1);

            if (error) {
              console.warn('⚠️ Duplicate check error for row', index + 1, ':', error);
              // Don't fail the entire process, just mark as non-duplicate
              return {
                row_num: index + 1,
                item_code: record.item_code,
                date: record.date,
                qty_issued: record.qty_issued,
                purpose: record.purpose,
                is_duplicate: false
              };
            }

            return {
              row_num: index + 1,
              item_code: record.item_code,
              date: record.date,
              qty_issued: record.qty_issued,
              purpose: record.purpose,
              is_duplicate: data && data.length > 0,
              existing_record_id: data && data.length > 0 ? data[0].id : undefined
            };

          } catch (recordError) {
            console.error('❌ Error checking duplicate for record', index + 1, ':', recordError);
            // Return non-duplicate to allow processing to continue
            return {
              row_num: index + 1,
              item_code: record.item_code,
              date: record.date,
              qty_issued: record.qty_issued,
              purpose: record.purpose,
              is_duplicate: false
            };
          }
        })
      );

      const duplicates = duplicateChecks.filter(check => check.is_duplicate);
      console.log('🔍 Duplicate check complete:', {
        total_checked: records.length,
        duplicates_found: duplicates.length,
        duplicate_rows: duplicates.map(d => d.row_num)
      });

      return duplicateChecks;
    } catch (error) {
      console.error('❌ Duplicate check failed completely:', error);
      // Return no duplicates on complete failure to allow processing to continue
      return records.map((record, index) => ({
        row_num: index + 1,
        item_code: record.item_code,
        date: record.date,
        qty_issued: record.qty_issued,
        purpose: record.purpose,
        is_duplicate: false
      }));
    }
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
      console.log('🚀 Starting enhanced upload with date format handling...', {
        total_records: records.length,
        skip_duplicates: options.skipDuplicates,
        show_warnings: options.showDuplicateWarning
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

      // Step 2: Check for duplicates (40% progress)
      setUploadProgress(40);
      const duplicateChecks = await checkForDuplicates(validRecords);
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

      console.log('✅ Enhanced upload complete:', result);

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
    }
  };

  return {
    uploadWithDuplicateHandling,
    checkForDuplicates,
    isProcessing,
    uploadProgress
  };
}
