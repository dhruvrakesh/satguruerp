import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Papa from 'papaparse';
import { useToast } from '@/hooks/use-toast';

interface VendorPriceListBulkRow {
  supplier_name: string;
  supplier_code: string;
  item_code: string;
  unit_price: string;
  currency?: string;
  effective_from?: string;
  effective_to?: string;
  minimum_order_quantity?: string;
  lead_time_days?: string;
  discount_percentage?: string;
  payment_terms?: string;
  validity_days?: string;
}

interface BulkUploadResult {
  successCount: number;
  errorCount: number;
  errors: Array<{
    rowNumber: number;
    error: string;
    data: VendorPriceListBulkRow;
  }>;
  uploadId: string;
}

export function useVendorPriceListBulkUpload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const downloadTemplate = () => {
    const headers = [
      'supplier_name',
      'supplier_code', 
      'item_code',
      'unit_price',
      'currency',
      'effective_from',
      'effective_to',
      'minimum_order_quantity',
      'lead_time_days',
      'discount_percentage',
      'payment_terms',
      'validity_days'
    ];

    const sampleData = [
      {
        supplier_name: 'ABC Chemicals Pvt Ltd',
        supplier_code: 'ABC001',
        item_code: 'CHM_ADHESIVE_100_50',
        unit_price: '125.50',
        currency: 'INR',
        effective_from: '2024-01-01',
        effective_to: '2024-12-31',
        minimum_order_quantity: '100',
        lead_time_days: '7',
        discount_percentage: '5.0',
        payment_terms: 'Net 30',
        validity_days: '90'
      }
    ];

    const csv = Papa.unparse({
      fields: headers,
      data: sampleData
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'vendor_price_list_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processCSV = async (file: File): Promise<BulkUploadResult> => {
    setIsProcessing(true);
    setProgress(0);

    // Log upload start
    const { data: uploadLog } = await supabase
      .from('procurement_csv_uploads')
      .insert({
        upload_type: 'vendor_prices',
        file_name: file.name,
        file_size_bytes: file.size,
        status: 'processing'
      })
      .select()
      .single();

    const uploadId = uploadLog?.id || '';

    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const data = results.data as VendorPriceListBulkRow[];
          const errors: BulkUploadResult['errors'] = [];
          let successCount = 0;
          const totalRows = data.length;

          setProgress(10);

          // Get all suppliers for validation
          const { data: suppliers } = await supabase
            .from('suppliers')
            .select('id, supplier_name, supplier_code');

          const supplierMap = new Map();
          suppliers?.forEach(supplier => {
            supplierMap.set(supplier.supplier_name?.toLowerCase(), supplier.id);
            supplierMap.set(supplier.supplier_code?.toLowerCase(), supplier.id);
          });

          setProgress(20);

          // Process in batches
          const batchSize = 50;
          for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const validatedBatch = [];

            for (const [index, row] of batch.entries()) {
              const rowNumber = i + index + 1;
              
              try {
                // Find supplier ID
                const supplierId = supplierMap.get(row.supplier_name?.toLowerCase()) || 
                                  supplierMap.get(row.supplier_code?.toLowerCase());

                if (!supplierId) {
                  errors.push({
                    rowNumber,
                    error: `Supplier not found: ${row.supplier_name || row.supplier_code}`,
                    data: row
                  });
                  continue;
                }

                // Validate required fields
                if (!row.item_code?.trim()) {
                  errors.push({
                    rowNumber,
                    error: 'Item code is required',
                    data: row
                  });
                  continue;
                }

                if (!row.unit_price || isNaN(parseFloat(row.unit_price))) {
                  errors.push({
                    rowNumber,
                    error: 'Valid unit price is required',
                    data: row
                  });
                  continue;
                }

                // Parse dates
                let effectiveFrom = new Date();
                let effectiveTo = null;

                if (row.effective_from) {
                  effectiveFrom = new Date(row.effective_from);
                  if (isNaN(effectiveFrom.getTime())) {
                    errors.push({
                      rowNumber,
                      error: 'Invalid effective_from date format',
                      data: row
                    });
                    continue;
                  }
                }

                if (row.effective_to) {
                  effectiveTo = new Date(row.effective_to);
                  if (isNaN(effectiveTo.getTime())) {
                    errors.push({
                      rowNumber,
                      error: 'Invalid effective_to date format',
                      data: row
                    });
                    continue;
                  }
                }

                const priceRecord = {
                  supplier_id: supplierId,
                  item_code: row.item_code.trim(),
                  unit_price: parseFloat(row.unit_price),
                  currency: row.currency || 'INR',
                  effective_from: effectiveFrom.toISOString().split('T')[0],
                  effective_to: effectiveTo ? effectiveTo.toISOString().split('T')[0] : null,
                  minimum_order_quantity: row.minimum_order_quantity ? parseFloat(row.minimum_order_quantity) : 1,
                  lead_time_days: row.lead_time_days ? parseInt(row.lead_time_days) : 7,
                  discount_percentage: row.discount_percentage ? parseFloat(row.discount_percentage) : 0,
                  payment_terms: row.payment_terms || null,
                  validity_days: row.validity_days ? parseInt(row.validity_days) : 30
                };

                validatedBatch.push(priceRecord);
              } catch (error) {
                errors.push({
                  rowNumber,
                  error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  data: row
                });
              }
            }

            // Insert valid records
            if (validatedBatch.length > 0) {
              const { error: insertError } = await supabase
                .from('vendor_price_lists')
                .upsert(validatedBatch, {
                  onConflict: 'supplier_id,item_code,effective_from'
                });

              if (insertError) {
                // Add all batch items to errors if insert fails
                validatedBatch.forEach((_, batchIndex) => {
                  errors.push({
                    rowNumber: i + batchIndex + 1,
                    error: `Database error: ${insertError.message}`,
                    data: batch[batchIndex]
                  });
                });
              } else {
                successCount += validatedBatch.length;
              }
            }

            // Update progress
            const progressPercent = Math.round(((i + batchSize) / totalRows) * 80) + 20;
            setProgress(Math.min(progressPercent, 90));
          }

          // Update upload log
          await supabase
            .from('procurement_csv_uploads')
            .update({
              total_rows: totalRows,
              successful_rows: successCount,
              failed_rows: errors.length,
              error_details: errors.length > 0 ? { errors: errors.map(e => ({ ...e, data: JSON.stringify(e.data) })) } : null,
              status: errors.length === totalRows ? 'failed' : 'completed'
            })
            .eq('id', uploadId);

          setProgress(100);
          setIsProcessing(false);

          resolve({
            successCount,
            errorCount: errors.length,
            errors,
            uploadId
          });
        },
        error: (error) => {
          console.error('CSV parsing error:', error);
          setIsProcessing(false);
          resolve({
            successCount: 0,
            errorCount: 1,
            errors: [{ rowNumber: 0, error: `CSV parsing error: ${error.message}`, data: {} as VendorPriceListBulkRow }],
            uploadId
          });
        }
      });
    });
  };

  const uploadMutation = useMutation({
    mutationFn: processCSV,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-price-lists'] });
      
      if (result.successCount > 0) {
        toast({
          title: "Upload Successful",
          description: `${result.successCount} vendor price records uploaded successfully${result.errorCount > 0 ? ` with ${result.errorCount} errors` : ''}`,
        });
      } else {
        toast({
          title: "Upload Failed",
          description: `All ${result.errorCount} rows failed to upload. Please check the errors and try again.`,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      setIsProcessing(false);
      toast({
        title: "Upload Failed",
        description: `Failed to process vendor price list: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  });

  return {
    uploadMutation,
    isProcessing,
    progress,
    downloadTemplate
  };
}