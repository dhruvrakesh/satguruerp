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
      'grn_number',
      'date',
      'item_code',
      'qty_received',
      'uom',
      'vendor',
      'invoice_number',
      'amount_inr',
      'remarks'
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

      // Check for duplicate GRN numbers in the file
      const grnNumbers = new Set<string>();
      const duplicatesInFile = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const grnNumber = values[headers.indexOf('grn_number')];
        if (grnNumbers.has(grnNumber)) {
          duplicatesInFile.add(grnNumber);
        }
        grnNumbers.add(grnNumber);
      }

      // Check for existing GRN numbers in database
      const { data: existingGRNs } = await supabase
        .from('satguru_grn_log')
        .select('grn_number')
        .in('grn_number', Array.from(grnNumbers));

      const existingGRNSet = new Set(existingGRNs?.map(g => g.grn_number) || []);

      // Get all item codes for validation
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
          if (!rowData.grn_number) {
            throw new Error("GRN number is required");
          }
          if (!rowData.date) {
            throw new Error("Date is required");
          }
          if (!rowData.item_code) {
            throw new Error("Item code is required");
          }
          if (!rowData.qty_received || isNaN(parseFloat(rowData.qty_received))) {
            throw new Error("Valid quantity received is required");
          }

          // Check for duplicates
          if (duplicatesInFile.has(rowData.grn_number)) {
            throw new Error("Duplicate GRN number found in file");
          }
          if (existingGRNSet.has(rowData.grn_number)) {
            throw new Error("GRN number already exists in database");
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

          // Prepare GRN data
          const grnData = {
            grn_number: rowData.grn_number,
            date: rowData.date,
            item_code: rowData.item_code,
            qty_received: parseFloat(rowData.qty_received),
            vendor: rowData.vendor || null,
            invoice_number: rowData.invoice_number || null,
            amount_inr: rowData.amount_inr ? parseFloat(rowData.amount_inr) : null,
            remarks: rowData.remarks || null,
            uom: rowData.uom || 'PCS'
          };

          // Insert GRN
          const { error: insertError } = await supabase
            .from('satguru_grn_log')
            .insert([grnData]);

          if (insertError) {
            throw new Error(`Database error: ${insertError.message}`);
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
      queryClient.invalidateQueries({ queryKey: ['grn'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      
      toast({
        title: "GRN upload completed",
        description: `${results.successCount} GRNs uploaded successfully${results.errorCount > 0 ? `, ${results.errorCount} errors found` : ''}`
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