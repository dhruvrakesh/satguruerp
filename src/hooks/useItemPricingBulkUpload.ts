import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { CSVParser } from '@/utils/csvParser';

export interface PricingUploadRecord {
  id?: string;
  row_number: number;
  item_code: string;
  proposed_price: number;
  current_price?: number;
  price_change_percentage?: number;
  effective_date?: string;
  cost_category?: string;
  supplier?: string;
  change_reason?: string;
  validation_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REQUIRES_REVIEW';
  validation_errors?: string[];
  validation_warnings?: string[];
  auto_approved: boolean;
}

export interface PricingUploadSession {
  id: string;
  filename: string;
  upload_date: string;
  total_records: number;
  processed_records: number;
  approved_records: number;
  rejected_records: number;
  pending_records: number;
  processing_status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  validation_summary?: any;
}

export interface UploadProgress {
  stage: 'VALIDATING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  percentage: number;
  currentRecord?: number;
  totalRecords?: number;
  message: string;
}

const REQUIRED_HEADERS = ['item_code', 'proposed_price'];
const HEADER_MAPPING = {
  'Item Code': 'item_code',
  'item_code': 'item_code',
  'Item': 'item_code',
  'Code': 'item_code',
  'Price': 'proposed_price',
  'proposed_price': 'proposed_price',
  'New Price': 'proposed_price',
  'Current Price': 'proposed_price',
  'Cost Category': 'cost_category',
  'cost_category': 'cost_category',
  'Category': 'cost_category',
  'Supplier': 'supplier',
  'supplier': 'supplier',
  'Vendor': 'supplier',
  'Effective Date': 'effective_date',
  'effective_date': 'effective_date',
  'Date': 'effective_date',
  'Reason': 'change_reason',
  'change_reason': 'change_reason',
  'Notes': 'change_reason',
  'Comments': 'change_reason'
};

export const useItemPricingBulkUpload = () => {
  const [uploadSession, setUploadSession] = useState<PricingUploadSession | null>(null);
  const [uploadRecords, setUploadRecords] = useState<PricingUploadRecord[]>([]);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Download CSV template
  const downloadTemplate = useCallback(() => {
    const templateData = [
      {
        'Item Code': 'SAMPLE001',
        'Proposed Price': '125.50',
        'Cost Category': 'RAW_MATERIAL',
        'Supplier': 'VENDOR001',
        'Effective Date': new Date().toISOString().split('T')[0],
        'Change Reason': 'Market price adjustment'
      },
      {
        'Item Code': 'SAMPLE002',
        'Proposed Price': '89.75',
        'Cost Category': 'PACKAGING',
        'Supplier': 'VENDOR002',
        'Effective Date': new Date().toISOString().split('T')[0],
        'Change Reason': 'Supplier price update'
      }
    ];

    const headers = Object.keys(templateData[0]);
    const csvContent = [
      headers.join(','),
      ...templateData.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `item_pricing_template_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Template Downloaded",
      description: "CSV template has been downloaded. Use this format for your bulk uploads.",
    });
  }, []);

  // Process CSV file
  const processCSVFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setProgress({
      stage: 'VALIDATING',
      percentage: 10,
      message: 'Reading CSV file...'
    });

    try {
      // Read file content
      const fileContent = await file.text();
      
      setProgress({
        stage: 'VALIDATING',
        percentage: 30,
        message: 'Parsing CSV data...'
      });

      // Parse CSV with validation
      const parseResult = CSVParser.parseCSV(fileContent, {
        requiredHeaders: REQUIRED_HEADERS,
        headerMapping: HEADER_MAPPING,
        skipEmptyRows: true,
        trimValues: true
      });

      if (parseResult.errors.length > 0 && parseResult.validRows === 0) {
        throw new Error(`CSV parsing failed: ${parseResult.errors[0].error}`);
      }

      setProgress({
        stage: 'VALIDATING',
        percentage: 50,
        message: 'Validating data format...'
      });

      // Transform parsed data to upload format
      const uploadData = parseResult.data.map((row, index) => ({
        row_number: index + 2, // +2 because we skip header and array is 0-indexed
        item_code: row.item_code || '',
        proposed_price: parseFloat(row.proposed_price || '0'),
        effective_date: row.effective_date || new Date().toISOString().split('T')[0],
        cost_category: row.cost_category || '',
        supplier: row.supplier || '',
        change_reason: row.change_reason || 'Bulk CSV upload'
      }));

      // Validate required fields
      const validationErrors: string[] = [];
      uploadData.forEach((record, index) => {
        if (!record.item_code?.trim()) {
          validationErrors.push(`Row ${record.row_number}: Item code is required`);
        }
        if (!record.proposed_price || record.proposed_price <= 0) {
          validationErrors.push(`Row ${record.row_number}: Valid price greater than 0 is required`);
        }
      });

      if (validationErrors.length > 0) {
        throw new Error(`Validation errors found:\n${validationErrors.slice(0, 5).join('\n')}${validationErrors.length > 5 ? `\n... and ${validationErrors.length - 5} more errors` : ''}`);
      }

      setProgress({
        stage: 'PROCESSING',
        percentage: 70,
        message: 'Creating upload session...'
      });

      // Create upload session in database
      const { data: sessionData, error: sessionError } = await supabase
        .from('item_pricing_csv_uploads')
        .insert({
          filename: file.name,
          total_records: uploadData.length,
          file_size_bytes: file.size,
          processing_status: 'PROCESSING'
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      setProgress({
        stage: 'PROCESSING',
        percentage: 80,
        message: 'Processing records...'
      });

      // Process records in chunks to avoid timeout
      const CHUNK_SIZE = 100;
      const chunks = [];
      for (let i = 0; i < uploadData.length; i += CHUNK_SIZE) {
        chunks.push(uploadData.slice(i, i + CHUNK_SIZE));
      }

      let processedCount = 0;
      const allProcessedRecords: PricingUploadRecord[] = [];

      for (const chunk of chunks) {
        const { data: processResult, error: processError } = await supabase.rpc(
          'process_pricing_upload_batch',
          {
            p_upload_id: sessionData.id,
            p_records: chunk,
            p_auto_approve_threshold: 50.0
          }
        );

        if (processError) throw processError;

        processedCount += chunk.length;
        setProgress({
          stage: 'PROCESSING',
          percentage: 80 + (processedCount / uploadData.length) * 15,
          currentRecord: processedCount,
          totalRecords: uploadData.length,
          message: `Processing records: ${processedCount}/${uploadData.length}`
        });
      }

      // Fetch final results
      const { data: finalSession, error: finalError } = await supabase
        .from('item_pricing_csv_uploads')
        .select('*')
        .eq('id', sessionData.id)
        .single();

      if (finalError) throw finalError;

      const { data: records, error: recordsError } = await supabase
        .from('item_pricing_upload_records')
        .select('*')
        .eq('upload_id', sessionData.id)
        .order('row_number');

      if (recordsError) throw recordsError;

      setUploadSession({
        ...finalSession,
        processing_status: finalSession.processing_status as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
      });
      setUploadRecords((records || []).map(record => ({
        ...record,
        validation_status: record.validation_status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'REQUIRES_REVIEW',
        validation_errors: Array.isArray(record.validation_errors) ? record.validation_errors.map(e => String(e)) : [],
        validation_warnings: Array.isArray(record.validation_warnings) ? record.validation_warnings.map(w => String(w)) : []
      })));

      setProgress({
        stage: 'COMPLETED',
        percentage: 100,
        message: `Upload complete! Processed ${finalSession.processed_records} records.`
      });

      toast({
        title: "Upload Successful",
        description: `Processed ${finalSession.processed_records} records. ${finalSession.approved_records} auto-approved, ${finalSession.pending_records} pending review, ${finalSession.rejected_records} rejected.`,
      });

    } catch (error) {
      console.error('CSV upload error:', error);
      setProgress({
        stage: 'ERROR',
        percentage: 0,
        message: error instanceof Error ? error.message : 'Upload failed'
      });

      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "An error occurred during upload",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Approve pending record
  const approveRecord = useCallback(async (recordId: string, reviewNotes?: string) => {
    try {
      const { error } = await supabase
        .from('item_pricing_upload_records')
        .update({
          validation_status: 'APPROVED',
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes
        })
        .eq('id', recordId);

      if (error) throw error;

      // Update local state
      setUploadRecords(prev => 
        prev.map(record => 
          record.id === recordId 
            ? { ...record, validation_status: 'APPROVED' as const }
            : record
        )
      );

      toast({
        title: "Record Approved",
        description: "Price update has been approved and applied.",
      });

    } catch (error) {
      toast({
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Failed to approve record",
        variant: "destructive"
      });
    }
  }, []);

  // Reject pending record
  const rejectRecord = useCallback(async (recordId: string, reviewNotes: string) => {
    try {
      const { error } = await supabase
        .from('item_pricing_upload_records')
        .update({
          validation_status: 'REJECTED',
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes
        })
        .eq('id', recordId);

      if (error) throw error;

      // Update local state
      setUploadRecords(prev => 
        prev.map(record => 
          record.id === recordId 
            ? { ...record, validation_status: 'REJECTED' as const }
            : record
        )
      );

      toast({
        title: "Record Rejected",
        description: "Price update has been rejected.",
      });

    } catch (error) {
      toast({
        title: "Rejection Failed",
        description: error instanceof Error ? error.message : "Failed to reject record",
        variant: "destructive"
      });
    }
  }, []);

  // Bulk approve all pending records
  const bulkApproveAll = useCallback(async () => {
    const pendingRecords = uploadRecords.filter(r => r.validation_status === 'REQUIRES_REVIEW');
    
    if (pendingRecords.length === 0) {
      toast({
        title: "No Records to Approve",
        description: "There are no pending records to approve.",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('item_pricing_upload_records')
        .update({
          validation_status: 'APPROVED',
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: 'Bulk approved'
        })
        .in('id', pendingRecords.map(r => r.id));

      if (error) throw error;

      setUploadRecords(prev => 
        prev.map(record => 
          record.validation_status === 'REQUIRES_REVIEW'
            ? { ...record, validation_status: 'APPROVED' as const }
            : record
        )
      );

      toast({
        title: "Bulk Approval Complete",
        description: `Approved ${pendingRecords.length} pending price updates.`,
      });

    } catch (error) {
      toast({
        title: "Bulk Approval Failed",
        description: error instanceof Error ? error.message : "Failed to approve records",
        variant: "destructive"
      });
    }
  }, [uploadRecords]);

  // Reset upload state
  const resetUpload = useCallback(() => {
    setUploadSession(null);
    setUploadRecords([]);
    setProgress(null);
    setIsUploading(false);
  }, []);

  return {
    uploadSession,
    uploadRecords,
    progress,
    isUploading,
    processCSVFile,
    downloadTemplate,
    approveRecord,
    rejectRecord,
    bulkApproveAll,
    resetUpload
  };
};