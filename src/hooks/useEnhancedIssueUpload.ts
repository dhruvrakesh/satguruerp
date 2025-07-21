
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  // Check for potential duplicates before processing
  const checkForDuplicates = async (records: IssueRecord[]): Promise<DuplicateRecord[]> => {
    console.log('🔍 Checking for duplicates in', records.length, 'records...');
    
    try {
      const duplicateChecks = await Promise.all(
        records.map(async (record, index) => {
          const { data, error } = await supabase
            .from('satguru_issue_log')
            .select('id')
            .eq('item_code', record.item_code)
            .eq('date', record.date)
            .eq('qty_issued', record.qty_issued)
            .eq('purpose', record.purpose)
            .limit(1);

          if (error) {
            console.warn('Duplicate check error for row', index + 1, ':', error);
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
      console.error('❌ Duplicate check failed:', error);
      // Return no duplicates on error to allow processing to continue
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

  // Enhanced upload with duplicate handling
  const uploadWithDuplicateHandling = async (
    records: IssueRecord[], 
    options: {
      skipDuplicates?: boolean;
      showDuplicateWarning?: boolean;
    } = {}
  ): Promise<EnhancedUploadResult> => {
    setIsProcessing(true);
    setUploadProgress(0);

    try {
      console.log('🚀 Starting enhanced upload with duplicate handling...', {
        total_records: records.length,
        skip_duplicates: options.skipDuplicates,
        show_warnings: options.showDuplicateWarning
      });

      // Step 1: Check for duplicates (20% progress)
      setUploadProgress(20);
      const duplicateChecks = await checkForDuplicates(records);
      const duplicates = duplicateChecks.filter(check => check.is_duplicate);

      if (duplicates.length > 0 && options.showDuplicateWarning && !options.skipDuplicates) {
        // Return early with duplicate information for user decision
        return {
          total_processed: 0,
          successful_inserts: 0,
          duplicates_skipped: 0,
          validation_errors: 0,
          duplicates,
          errors: [],
          success: false
        };
      }

      // Step 2: Filter out duplicates if requested (40% progress)
      setUploadProgress(40);
      const recordsToProcess = options.skipDuplicates 
        ? records.filter((_, index) => !duplicateChecks[index].is_duplicate)
        : records;

      if (recordsToProcess.length === 0) {
        return {
          total_processed: records.length,
          successful_inserts: 0,
          duplicates_skipped: duplicates.length,
          validation_errors: 0,
          duplicates,
          errors: [],
          success: true
        };
      }

      // Step 3: Validate stock availability (60% progress) - USING SINGLE SOURCE OF TRUTH
      setUploadProgress(60);
      const stockValidationErrors: Array<{ row: number; message: string }> = [];
      
      for (let i = 0; i < recordsToProcess.length; i++) {
        const record = recordsToProcess[i];
        const originalIndex = records.findIndex(r => 
          r.item_code === record.item_code && 
          r.date === record.date && 
          r.qty_issued === record.qty_issued
        );

        try {
          // Use satguru_stock_summary_view as single source of truth
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

      // Step 4: Insert valid records (80% progress)
      setUploadProgress(80);
      const validRecords = recordsToProcess.filter((_, index) => {
        const originalIndex = records.findIndex(r => 
          r.item_code === recordsToProcess[index].item_code && 
          r.date === recordsToProcess[index].date && 
          r.qty_issued === recordsToProcess[index].qty_issued
        );
        return !stockValidationErrors.some(error => error.row === originalIndex + 1);
      });

      let successfulInserts = 0;
      const insertErrors: Array<{ row: number; message: string }> = [];

      if (validRecords.length > 0) {
        try {
          const { data, error } = await supabase
            .from('satguru_issue_log')
            .insert(validRecords.map(record => ({
              ...record,
              created_at: new Date().toISOString()
            })));

          if (error) {
            // Handle constraint violation (duplicates) gracefully
            if (error.code === '23505') {
              console.warn('⚠️ Duplicate constraint violation detected during insert');
              // Try inserting records one by one to identify which ones are duplicates
              for (let i = 0; i < validRecords.length; i++) {
                try {
                  await supabase
                    .from('satguru_issue_log')
                    .insert({
                      ...validRecords[i],
                      created_at: new Date().toISOString()
                    });
                  successfulInserts++;
                } catch (individualError: any) {
                  if (individualError.code === '23505') {
                    // This record is a duplicate
                    const originalIndex = records.findIndex(r => 
                      r.item_code === validRecords[i].item_code && 
                      r.date === validRecords[i].date && 
                      r.qty_issued === validRecords[i].qty_issued
                    );
                    duplicates.push({
                      row_num: originalIndex + 1,
                      item_code: validRecords[i].item_code,
                      date: validRecords[i].date,
                      qty_issued: validRecords[i].qty_issued,
                      purpose: validRecords[i].purpose,
                      is_duplicate: true
                    });
                  } else {
                    insertErrors.push({
                      row: i + 1,
                      message: `Insert failed: ${individualError.message}`
                    });
                  }
                }
              }
            } else {
              throw error;
            }
          } else {
            successfulInserts = validRecords.length;
          }
        } catch (error: any) {
          console.error('❌ Bulk insert failed:', error);
          insertErrors.push({
            row: 0,
            message: `Bulk insert failed: ${error.message}`
          });
        }
      }

      // Step 5: Complete (100% progress)
      setUploadProgress(100);

      const result: EnhancedUploadResult = {
        total_processed: records.length,
        successful_inserts: successfulInserts,
        duplicates_skipped: duplicates.length,
        validation_errors: stockValidationErrors.length,
        duplicates,
        errors: [...stockValidationErrors, ...insertErrors],
        success: successfulInserts > 0 || (duplicates.length > 0 && options.skipDuplicates)
      };

      console.log('✅ Enhanced upload complete:', result);

      // Show appropriate toast message
      if (result.successful_inserts > 0) {
        toast({
          title: "Upload Successful",
          description: `Successfully uploaded ${result.successful_inserts} records${result.duplicates_skipped > 0 ? ` (${result.duplicates_skipped} duplicates skipped)` : ''}`,
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
        success: false
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
