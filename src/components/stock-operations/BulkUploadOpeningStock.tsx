
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

interface BulkOpeningStockRow {
  item_code: string;
  opening_qty: number;
  date?: string;
  remarks?: string;
}

interface BulkUploadOpeningStockProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkUploadOpeningStock({ open, onOpenChange }: BulkUploadOpeningStockProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkUploadResult | null>(null);
  const queryClient = useQueryClient();

  const downloadTemplate = () => {
    const headers = [
      'Item Code',
      'Opening Qty',
      'Date',
      'Remarks'
    ];

    const sampleData = [
      'RAW_001,1000,2025-01-01,Initial stock for raw materials',
      'FIN_002,500,2025-01-01,Opening stock for finished goods'
    ];

    const csvContent = [headers.join(','), ...sampleData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(url);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'opening_stock_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getValidationRules = (): ValidationRule<BulkOpeningStockRow>[] => [
    {
      field: 'item_code',
      required: true,
      type: 'string'
    },
    {
      field: 'opening_qty',
      required: true,
      type: 'number',
      min: 0,
      max: 999999,
      customValidator: (value) => {
        if (value < 0) {
          return 'Opening quantity cannot be negative';
        }
        return null;
      }
    },
    {
      field: 'date',
      required: false,
      type: 'date',
      defaultValue: new Date().toISOString().split('T')[0]
    },
    {
      field: 'remarks',
      required: false,
      type: 'string',
      defaultValue: 'Opening stock entry'
    }
  ];

  const processCSV = async (file: File): Promise<BulkUploadResult> => {
    setIsProcessing(true);
    setProgress(0);

    try {
      const text = await file.text();
      console.log('📄 Processing Opening Stock CSV file:', file.name, 'Size:', file.size);

      // Enhanced CSV parsing with flexible header mapping
      const headerMapping = {
        'item_code': 'item_code',
        'itemcode': 'item_code',
        'item': 'item_code',
        'opening_qty': 'opening_qty',
        'openingqty': 'opening_qty',
        'opening_quantity': 'opening_qty',
        'quantity': 'opening_qty',
        'qty': 'opening_qty',
        'date': 'date',
        'stock_date': 'date',
        'opening_date': 'date',
        'remarks': 'remarks',
        'notes': 'remarks',
        'comment': 'remarks'
      };

      const parseResult = CSVParser.parseCSV(text, {
        requiredHeaders: ['item_code', 'opening_qty'],
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

      // Get valid item codes
      setProgress(10);
      
      const itemCodes = [...new Set(parseResult.data.map(row => row.item_code).filter(Boolean))];

      const { data: validItems } = await supabase
        .from('satguru_item_master')
        .select('item_code')
        .in('item_code', itemCodes);

      const validItemSet = new Set(validItems?.map(i => i.item_code) || []);

      setProgress(20);

      const validationRules = getValidationRules();

      // Process each row
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

          const validatedData = validation.transformedData as BulkOpeningStockRow;

          // Item code validation
          if (!validItemSet.has(validatedData.item_code)) {
            throw new Error(`Item code ${validatedData.item_code} not found in master data`);
          }

          const stockDate = validatedData.date || new Date().toISOString().split('T')[0];

          // Insert/Update stock record
          const { error: upsertError } = await supabase
            .from('satguru_stock')
            .upsert({
              item_code: validatedData.item_code,
              current_qty: validatedData.opening_qty,
              last_updated: new Date().toISOString()
            }, {
              onConflict: 'item_code'
            });

          if (upsertError) {
            console.error('❌ Stock upsert error:', upsertError);
            throw new Error(`Stock update error: ${upsertError.message}`);
          }

          // Create GRN record for audit trail
          const grnData = {
            grn_number: `OPENING-${Date.now()}-${i + 1}`,
            date: stockDate,
            item_code: validatedData.item_code,
            qty_received: validatedData.opening_qty,
            vendor: 'OPENING_STOCK',
            remarks: validatedData.remarks || 'Opening stock entry',
            uom: 'PCS'
          };

          const { error: grnError } = await supabase
            .from('satguru_grn_log')
            .insert([grnData]);

          if (grnError) {
            console.error('❌ GRN error:', grnError);
            // Don't fail the whole operation for GRN audit trail issues
            console.warn('GRN audit trail creation failed, but stock was updated');
          }

          console.log('✅ Successfully processed opening stock for:', validatedData.item_code);
          results.successCount++;

        } catch (error) {
          console.error(`❌ Error processing row ${rowNumber}:`, error);
          results.errorCount++;
          results.errors.push({
            rowNumber: rowNumber + parseResult.errors.length,
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
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['grn'] });
      
      toast({
        title: "Opening stock upload completed",
        description: `${results.successCount} items processed successfully${results.errorCount > 0 ? `, ${results.errorCount} errors found` : ''}`
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

    console.log('📁 Starting opening stock file upload:', file.name);
    setResults(null);
    uploadMutation.mutate(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Bulk Upload Opening Stock
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Button onClick={downloadTemplate} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Download Template
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Download the CSV template for opening stock upload.
              Headers are case-insensitive and flexible (e.g., "Item Code" or "item_code" both work).
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
                <p className="text-sm text-muted-foreground">Processing opening stock upload...</p>
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
                      <span className="font-medium">{results.successCount} items processed successfully</span>
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
