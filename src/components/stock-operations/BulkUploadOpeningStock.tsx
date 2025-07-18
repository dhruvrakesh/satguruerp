
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
import { BulkUploadResult, BulkUploadError, CSVRowData } from "@/types";

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
      'item_code',
      'opening_qty',
      'date',
      'remarks'
    ];

    const sampleData = [
      'RAW_001,1000,2025-01-01,Initial stock for raw materials',
      'FIN_002,500,2025-01-01,Opening stock for finished goods'
    ];

    const csvContent = [headers.join(','), ...sampleData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'opening_stock_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const processCSV = async (file: File): Promise<BulkUploadResult> => {
    setIsProcessing(true);
    setProgress(0);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      if (lines.length <= 1) {
        throw new Error("CSV file is empty or has no data rows");
      }

      const results: BulkUploadResult = {
        successCount: 0,
        errorCount: 0,
        errors: []
      };

      // Get valid item codes from master
      const { data: items } = await supabase
        .from('satguru_item_master')
        .select('item_code');

      const validItemCodes = new Set(items?.map(i => i.item_code) || []);

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        setProgress((i / (lines.length - 1)) * 90);
        
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const rowData: CSVRowData = {};
        
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        try {
          // Validate required fields
          if (!rowData.item_code) {
            throw new Error("Item code is required");
          }
          if (!rowData.opening_qty || isNaN(parseFloat(rowData.opening_qty))) {
            throw new Error("Valid opening quantity is required");
          }

          const openingQty = parseFloat(rowData.opening_qty);
          if (openingQty < 0) {
            throw new Error("Opening quantity cannot be negative");
          }

          // Validate item code
          if (!validItemCodes.has(rowData.item_code)) {
            throw new Error("Item code does not exist in master data");
          }

          // Validate date format (optional)
          let stockDate = new Date().toISOString().split('T')[0]; // Default to today
          if (rowData.date) {
            const date = new Date(rowData.date);
            if (isNaN(date.getTime())) {
              throw new Error("Invalid date format (use YYYY-MM-DD)");
            }
            stockDate = rowData.date;
          }

          // Insert/Update stock record
          const { error: upsertError } = await supabase
            .from('satguru_stock')
            .upsert({
              item_code: rowData.item_code,
              current_qty: openingQty,
              last_updated: new Date().toISOString()
            }, {
              onConflict: 'item_code'
            });

          if (upsertError) {
            throw new Error(`Stock update error: ${upsertError.message}`);
          }

          // Create GRN record for audit trail
          const grnData = {
            grn_number: `OPENING-${Date.now()}-${i}`,
            date: stockDate,
            item_code: rowData.item_code,
            qty_received: openingQty,
            vendor: 'OPENING_STOCK',
            remarks: rowData.remarks || 'Opening stock entry',
            uom: 'PCS'
          };

          const { error: grnError } = await supabase
            .from('satguru_grn_log')
            .insert([grnData]);

          if (grnError) {
            throw new Error(`GRN creation error: ${grnError.message}`);
          }

          results.successCount++;

        } catch (error) {
          results.errorCount++;
          results.errors.push({
            rowNumber: i + 1,
            reason: error instanceof Error ? error.message : 'Unknown error',
            data: headers.reduce((obj: CSVRowData, header, index) => {
              obj[header] = values[index] || '';
              return obj;
            }, {})
          });
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
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['grn'] });
      
      toast({
        title: "Opening stock upload completed",
        description: `${results.successCount} items processed successfully${results.errorCount > 0 ? `, ${results.errorCount} errors found` : ''}`
      });
    },
    onError: (error: Error) => {
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
              Download the CSV template for opening stock upload
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
