
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { FileUpload } from "@/components/ui/file-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Upload, AlertCircle, CheckCircle } from "lucide-react";
import { BulkUploadResult, BulkUploadError } from "@/types";
import { CSVParser } from "@/utils/csvParser";
import { BulkUploadValidator, ValidationRule } from "@/utils/bulkUploadValidation";

interface BulkGRNRow {
  grn_number: string;
  date: string;
  item_code: string;
  qty_received: number;
  uom?: string;
  vendor?: string;
  invoice_number?: string;
  amount_inr?: number;
  remarks?: string;
}

interface BulkUploadGRNProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkUploadGRN({ open, onOpenChange }: BulkUploadGRNProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkUploadResult | null>(null);
  const queryClient = useQueryClient();

  const downloadTemplate = () => {
    const headers = [
      'GRN Number',
      'Date',
      'Item Code',
      'Qty Received',
      'UOM',
      'Vendor',
      'Invoice Number',
      'Amount INR',
      'Remarks'
    ];

    const sampleData = [
      'SGRN202501170001,2025-01-17,RAW_001,100,KG,Supplier ABC,INV001,5000,Received in good condition',
      'SGRN202501170002,2025-01-17,FIN_002,50,PCS,Supplier XYZ,INV002,2500,Quality checked'
    ];

    const csvContent = [headers.join(','), ...sampleData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grn_bulk_upload_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getValidationRules = (): ValidationRule<BulkGRNRow>[] => [
    {
      field: 'grn_number',
      required: true,
      type: 'string',
      pattern: /^[A-Z0-9_-]+$/,
      customValidator: (value) => {
        if (value && value.length < 5) {
          return 'GRN number should be at least 5 characters';
        }
        return null;
      }
    },
    {
      field: 'date',
      required: true,
      type: 'date',
      customValidator: (value) => BulkUploadValidator.validateDate(value)
    },
    {
      field: 'item_code',
      required: true,
      type: 'string'
    },
    {
      field: 'qty_received',
      required: true,
      type: 'number',
      min: 0.001,
      max: 999999
    },
    {
      field: 'uom',
      required: false,
      type: 'string',
      defaultValue: 'PCS'
    },
    {
      field: 'vendor',
      required: false,
      type: 'string'
    },
    {
      field: 'invoice_number',
      required: false,
      type: 'string'
    },
    {
      field: 'amount_inr',
      required: false,
      type: 'number',
      min: 0
    },
    {
      field: 'remarks',
      required: false,
      type: 'string'
    }
  ];

  const processCSV = async (file: File): Promise<BulkUploadResult> => {
    setIsProcessing(true);
    setProgress(0);

    try {
      const text = await file.text();
      console.log('📄 Processing CSV file:', file.name, 'Size:', file.size);

      // Enhanced CSV parsing with flexible header mapping
      const headerMapping = {
        'grn_number': 'grn_number',
        'grnnumber': 'grn_number',
        'grn': 'grn_number',
        'date': 'date',
        'grn_date': 'date',
        'item_code': 'item_code',
        'itemcode': 'item_code',
        'item': 'item_code',
        'qty_received': 'qty_received',
        'qtyreceived': 'qty_received',
        'quantity': 'qty_received',
        'qty': 'qty_received',
        'uom': 'uom',
        'unit': 'uom',
        'vendor': 'vendor',
        'supplier': 'vendor',
        'invoice_number': 'invoice_number',
        'invoicenumber': 'invoice_number',
        'invoice': 'invoice_number',
        'amount_inr': 'amount_inr',
        'amountinr': 'amount_inr',
        'amount': 'amount_inr',
        'value': 'amount_inr',
        'remarks': 'remarks',
        'notes': 'remarks'
      };

      const parseResult = CSVParser.parseCSV(text, {
        requiredHeaders: ['grn_number', 'date', 'item_code', 'qty_received'],
        headerMapping,
        skipEmptyRows: true,
        trimValues: true
      });

      console.log('📊 CSV Parse Result:', {
        totalRows: parseResult.totalRows,
        validRows: parseResult.validRows,
        parseErrors: parseResult.errors.length,
        headers: parseResult.headers
      });

      if (parseResult.errors.length > 0) {
        console.error('❌ CSV Parse Errors:', parseResult.errors);
      }

      const results: BulkUploadResult = {
        successCount: 0,
        errorCount: 0,
        errors: []
      };

      // Add parse errors to results
      parseResult.errors.forEach(error => {
        results.errorCount++;
        results.errors.push({
          rowNumber: error.rowNumber,
          reason: error.error,
          data: { raw_data: error.rawData || '' }
        });
      });

      if (parseResult.data.length === 0) {
        throw new Error("No valid data rows found in CSV file");
      }

      // Get existing GRN numbers and item codes for validation
      setProgress(10);
      
      const grnNumbers = parseResult.data.map(row => row.grn_number).filter(Boolean);
      const itemCodes = parseResult.data.map(row => row.item_code).filter(Boolean);

      const [existingGRNs, validItems] = await Promise.all([
        supabase
          .from('satguru_grn_log')
          .select('grn_number')
          .in('grn_number', grnNumbers),
        supabase
          .from('satguru_item_master')
          .select('item_code')
          .in('item_code', itemCodes)
      ]);

      const existingGRNSet = new Set(existingGRNs.data?.map(g => g.grn_number) || []);
      const validItemSet = new Set(validItems.data?.map(i => i.item_code) || []);

      setProgress(20);

      // Validation rules
      const validationRules = getValidationRules();

      // Process each row with enhanced validation
      for (let i = 0; i < parseResult.data.length; i++) {
        const rowNumber = i + 1;
        const rowData = parseResult.data[i];
        
        setProgress(20 + (i / parseResult.data.length) * 70);
        
        console.log(`🔄 Processing row ${rowNumber}:`, rowData);

        try {
          // Validate row data
          const validation = BulkUploadValidator.validateRow(rowData, validationRules, rowNumber);
          
          if (!validation.isValid) {
            throw new Error(validation.errors.join('; '));
          }

          const validatedData = validation.transformedData as BulkGRNRow;

          // Business logic validations
          if (existingGRNSet.has(validatedData.grn_number)) {
            throw new Error(`GRN number ${validatedData.grn_number} already exists`);
          }

          if (!validItemSet.has(validatedData.item_code)) {
            throw new Error(`Item code ${validatedData.item_code} not found in master data`);
          }

          // Prepare GRN data for insertion
          const grnData = {
            grn_number: validatedData.grn_number,
            date: validatedData.date,
            item_code: validatedData.item_code,
            qty_received: validatedData.qty_received,
            vendor: validatedData.vendor || null,
            invoice_number: validatedData.invoice_number || null,
            amount_inr: validatedData.amount_inr || null,
            remarks: validatedData.remarks || null,
            uom: validatedData.uom || 'PCS'
          };

          console.log('💾 Inserting GRN:', grnData);

          // Insert GRN
          const { error: insertError } = await supabase
            .from('satguru_grn_log')
            .insert([grnData]);

          if (insertError) {
            console.error('❌ Insert error:', insertError);
            throw new Error(`Database error: ${insertError.message}`);
          }

          console.log('✅ Successfully inserted GRN:', validatedData.grn_number);
          results.successCount++;
          
          // Add to existing set to prevent duplicates within batch
          existingGRNSet.add(validatedData.grn_number);

        } catch (error) {
          console.error(`❌ Error processing row ${rowNumber}:`, error);
          results.errorCount++;
          results.errors.push({
            rowNumber: rowNumber + parseResult.errors.length, // Adjust for parse errors
            reason: error instanceof Error ? error.message : 'Unknown error',
            data: rowData
          });
        }
      }

      setProgress(100);
      console.log('🎉 Processing complete:', results);
      return results;

    } finally {
      setIsProcessing(false);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: processCSV,
    onSuccess: (results) => {
      setResults(results);
      queryClient.invalidateQueries({ queryKey: ['grn'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      
      toast({
        title: "GRN upload completed",
        description: `${results.successCount} GRNs uploaded successfully${results.errorCount > 0 ? `, ${results.errorCount} errors found` : ''}`
      });
    },
    onError: (error: Error) => {
      console.error('💥 Upload failed:', error);
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred during upload",
        variant: "destructive"
      });
    }
  });

  const handleFileUpload = (files: File[]) => {
    if (files.length === 0) return;
    
    const file = files[0];
    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV file",
        variant: "destructive"
      });
      return;
    }

    console.log('📁 Starting file upload:', file.name);
    setResults(null);
    uploadMutation.mutate(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Bulk Upload GRNs
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Button onClick={downloadTemplate} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Download Template
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Download the CSV template with sample data and required headers. 
              Headers are case-insensitive and flexible (e.g., "GRN Number" or "grn_number" both work).
            </p>
          </div>

          {!isProcessing && !results && (
            <FileUpload
              onFilesSelected={handleFileUpload}
              accept=".csv"
              multiple={false}
            />
          )}

          {isProcessing && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Processing GRN upload...</p>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                {progress.toFixed(0)}% complete
              </p>
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <Alert className={results.errorCount === 0 ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="font-medium">{results.successCount} GRNs uploaded successfully</span>
                    </div>
                    {results.errorCount > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-600" />
                        <span className="font-medium">{results.errorCount} errors found</span>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              {results.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Errors:</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {results.errors.map((error, index) => (
                      <div key={index} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                        <span className="font-medium">Row {error.rowNumber}:</span> {error.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    setResults(null);
                    setProgress(0);
                  }}
                  variant="outline"
                >
                  Upload Another File
                </Button>
                <Button onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
