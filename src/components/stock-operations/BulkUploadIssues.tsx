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

interface BulkIssueRow {
  date: string;
  item_code: string;
  qty_issued: number;
  purpose?: string;
  remarks?: string;
}

interface BulkIssueResult {
  successCount: number;
  errorCount: number;
  errors: Array<{
    rowNumber: number;
    reason: string;
    data: any;
  }>;
}

interface BulkUploadIssuesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkUploadIssues({ open, onOpenChange }: BulkUploadIssuesProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkIssueResult | null>(null);
  const queryClient = useQueryClient();

  const downloadTemplate = () => {
    const headers = [
      'date',
      'item_code', 
      'qty_issued',
      'purpose',
      'remarks'
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

  const processCSV = async (file: File): Promise<BulkIssueResult> => {
    setIsProcessing(true);
    setProgress(0);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      if (lines.length <= 1) {
        throw new Error("CSV file is empty or has no data rows");
      }

      const results: BulkIssueResult = {
        successCount: 0,
        errorCount: 0,
        errors: []
      };

      // Get all item codes and current stock levels
      const { data: stockData } = await supabase
        .from('satguru_stock')
        .select('item_code, current_qty');

      const stockMap = new Map(stockData?.map(s => [s.item_code, s.current_qty]) || []);

      // Get valid item codes from master
      const { data: items } = await supabase
        .from('satguru_item_master')
        .select('item_code');

      const validItemCodes = new Set(items?.map(i => i.item_code) || []);

      // Track cumulative issues in this batch to validate total availability
      const batchIssues = new Map<string, number>();

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        setProgress((i / (lines.length - 1)) * 90);
        
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const rowData: any = {};
        
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        try {
          // Validate required fields
          if (!rowData.date) {
            throw new Error("Date is required");
          }
          if (!rowData.item_code) {
            throw new Error("Item code is required");
          }
          if (!rowData.qty_issued || isNaN(parseFloat(rowData.qty_issued))) {
            throw new Error("Valid quantity issued is required");
          }

          const qtyIssued = parseFloat(rowData.qty_issued);
          if (qtyIssued <= 0) {
            throw new Error("Quantity issued must be greater than zero");
          }

          // Validate item code
          if (!validItemCodes.has(rowData.item_code)) {
            throw new Error("Item code does not exist in master data");
          }

          // Validate date format
          const date = new Date(rowData.date);
          if (isNaN(date.getTime())) {
            throw new Error("Invalid date format (use YYYY-MM-DD)");
          }

          // Stock availability validation
          const currentStock = stockMap.get(rowData.item_code) || 0;
          const previousBatchIssues = batchIssues.get(rowData.item_code) || 0;
          const totalRequiredQty = previousBatchIssues + qtyIssued;

          if (totalRequiredQty > currentStock) {
            throw new Error(`Insufficient stock. Available: ${currentStock}, Required: ${totalRequiredQty} (including previous rows in this batch)`);
          }

          // Update batch tracking
          batchIssues.set(rowData.item_code, totalRequiredQty);

          // Prepare issue data
          const issueData = {
            date: rowData.date,
            item_code: rowData.item_code,
            qty_issued: qtyIssued,
            purpose: rowData.purpose || 'General',
            remarks: rowData.remarks || null
          };

          // Validate stock before insert (server-side validation)
          const { error: validationError } = await supabase
            .rpc('satguru_validate_stock_transaction', {
              p_item_code: issueData.item_code,
              p_transaction_type: 'ISSUE',
              p_quantity: issueData.qty_issued
            });

          if (validationError) {
            throw new Error(`Stock validation failed: ${validationError.message}`);
          }

          // Insert issue
          const { error: insertError } = await supabase
            .from('satguru_issue_log')
            .insert([issueData]);

          if (insertError) {
            throw new Error(`Database error: ${insertError.message}`);
          }

          // Update local stock tracking for next validations
          const newStock = currentStock - qtyIssued;
          stockMap.set(rowData.item_code, newStock);

          results.successCount++;

        } catch (error: any) {
          results.errorCount++;
          results.errors.push({
            rowNumber: i + 1,
            reason: error.message,
            data: headers.reduce((obj: any, header, index) => {
              obj[header] = values[index] || '';
              return obj;
            }, {})
          });

          // If there's an error, don't update the batch tracking to maintain accuracy
          // for subsequent rows
        }
      }

      setProgress(100);
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
    onError: (error: any) => {
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
              Download the CSV template with sample data and required headers
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