
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

interface BulkIssueRow {
  date: string;
  item_code: string;
  qty_issued: number;
  purpose?: string;
  remarks?: string;
}

interface BulkUploadIssuesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkUploadIssues({ open, onOpenChange }: BulkUploadIssuesProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkUploadResult | null>(null);
  const queryClient = useQueryClient();

  const downloadTemplate = () => {
    const headers = [
      'Date',
      'Item Code', 
      'Qty Issued',
      'Purpose',
      'Remarks'
    ];

    const sampleData = [
      '2025-01-17,RAW_001,50,Manufacturing,Used in production batch B001',
      '2025-01-17,FIN_002,10,Sampling,Quality testing samples'
    ];

    const csvContent = [headers.join(','), ...sampleData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'issues_bulk_upload_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getValidationRules = (): ValidationRule<BulkIssueRow>[] => [
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
      field: 'qty_issued',
      required: true,
      type: 'number',
      min: 0.001,
      max: 999999,
      customValidator: (value) => BulkUploadValidator.validateQuantity(value.toString())
    },
    {
      field: 'purpose',
      required: false,
      type: 'string',
      defaultValue: 'General'
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
      console.log('📄 Processing Issues CSV file:', file.name, 'Size:', file.size);

      // Enhanced CSV parsing with flexible header mapping
      const headerMapping = {
        'date': 'date',
        'issue_date': 'date',
        'issuedate': 'date',
        'item_code': 'item_code',
        'itemcode': 'item_code',
        'item': 'item_code',
        'qty_issued': 'qty_issued',
        'qtyissued': 'qty_issued',
        'quantity_issued': 'qty_issued',
        'quantity': 'qty_issued',
        'qty': 'qty_issued',
        'purpose': 'purpose',
        'reason': 'purpose',
        'remarks': 'remarks',
        'notes': 'remarks',
        'comment': 'remarks'
      };

      const parseResult = CSVParser.parseCSV(text, {
        requiredHeaders: ['date', 'item_code', 'qty_issued'],
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

      // Get stock data and item validation
      setProgress(10);
      
      const itemCodes = [...new Set(parseResult.data.map(row => row.item_code).filter(Boolean))];

      const [stockData, validItems] = await Promise.all([
        supabase
          .from('satguru_stock')
          .select('item_code, current_qty')
          .in('item_code', itemCodes),
        supabase
          .from('satguru_item_master')
          .select('item_code')
          .in('item_code', itemCodes)
      ]);

      const stockMap = new Map(stockData.data?.map(s => [s.item_code, s.current_qty]) || []);
      const validItemSet = new Set(validItems.data?.map(i => i.item_code) || []);

      setProgress(20);

      // Track batch issues for stock validation
      const batchIssues = new Map<string, number>();
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

          const validatedData = validation.transformedData as BulkIssueRow;

          // Item code validation
          if (!validItemSet.has(validatedData.item_code)) {
            throw new Error(`Item code ${validatedData.item_code} not found in master data`);
          }

          // Stock availability validation
          const currentStock = stockMap.get(validatedData.item_code) || 0;
          const previousBatchIssues = batchIssues.get(validatedData.item_code) || 0;
          const totalRequiredQty = previousBatchIssues + validatedData.qty_issued;

          if (totalRequiredQty > currentStock) {
            throw new Error(`Insufficient stock. Available: ${currentStock}, Required: ${totalRequiredQty} (including previous rows in this batch)`);
          }

          // Update batch tracking
          batchIssues.set(validatedData.item_code, totalRequiredQty);

          // Prepare issue data
          const issueData = {
            date: validatedData.date,
            item_code: validatedData.item_code,
            qty_issued: validatedData.qty_issued,
            purpose: validatedData.purpose || 'General',
            remarks: validatedData.remarks || null
          };

          console.log('💾 Inserting issue:', issueData);

          // Insert issue
          const { error: insertError } = await supabase
            .from('satguru_issue_log')
            .insert([issueData]);

          if (insertError) {
            console.error('❌ Insert error:', insertError);
            throw new Error(`Database error: ${insertError.message}`);
          }

          // Update local stock tracking for next validations
          const newStock = currentStock - validatedData.qty_issued;
          stockMap.set(validatedData.item_code, newStock);

          console.log('✅ Successfully inserted issue for:', validatedData.item_code);
          results.successCount++;

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
      queryClient.invalidateQueries({ queryKey: ['stock-issues'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      
      toast({
        title: "Issues upload completed",
        description: `${results.successCount} issues uploaded successfully${results.errorCount > 0 ? `, ${results.errorCount} errors found` : ''}`
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

    console.log('📁 Starting issues file upload:', file.name);
    setResults(null);
    uploadMutation.mutate(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Bulk Upload Stock Issues
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
                <p className="text-sm text-muted-foreground">Processing issues upload...</p>
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
                      <span className="font-medium">{results.successCount} issues uploaded successfully</span>
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
