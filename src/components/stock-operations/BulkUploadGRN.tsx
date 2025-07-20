
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Download, Upload, CheckCircle } from "lucide-react";
import { BulkUploadValidator, ValidationRule } from "@/utils/bulkUploadValidation";

interface BulkGRNRow {
  item_code: string;
  grn_number: string;
  qty_received: number;
  date: string;
  uom: string;
  vendor: string;
  amount_inr?: number;
  invoice_number?: string;
  remarks?: string;
}

interface BulkUploadResult {
  success: number;
  errors: Array<{ row: number; message: string }>;
}

interface BulkUploadGRNProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkUploadGRN({ open, onOpenChange }: BulkUploadGRNProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkUploadResult | null>(null);
  const queryClient = useQueryClient();

  const downloadTemplate = async () => {
    try {
      // Get sample item codes from satguru_item_master for reference
      const { data: sampleItems } = await supabase
        .from('satguru_item_master')
        .select('item_code')
        .limit(3);

      // Updated headers to match exact satguru_grn_log schema
      const headers = [
        'item_code',
        'grn_number', 
        'qty_received',
        'date',
        'uom',
        'vendor',
        'amount_inr',
        'invoice_number',
        'remarks'
      ];

      const sampleCodes = sampleItems && sampleItems.length > 0 
        ? sampleItems.map(item => item.item_code)
        : ['RAW_ADH_117', 'PAC_ADH_110', 'FIN_001'];

      // Updated sample data to match database schema exactly
      const sampleData = [
        `${sampleCodes[0] || 'RAW_ADH_117'},GRN-2025-001,1000,2025-01-15,KG,Supplier A,25500.00,INV-2025-001,Raw material receipt`,
        `${sampleCodes[1] || 'PAC_ADH_110'},GRN-2025-002,500,2025-01-15,KG,Supplier B,6000.00,INV-2025-002,Packaging material receipt`,
        `${sampleCodes[2] || 'FIN_001'},GRN-2025-003,200,2025-01-15,KG,Internal Transfer,0,,Internal stock transfer`
      ];

      const csvContent = [headers.join(','), ...sampleData].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'grn_upload_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating template:', error);
      toast({
        title: "Error",
        description: "Failed to generate template. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getValidationRules = (): ValidationRule<BulkGRNRow>[] => [
    {
      field: 'item_code',
      required: true,
      type: 'string'
    },
    {
      field: 'grn_number',
      required: true,
      type: 'string'
    },
    {
      field: 'qty_received',
      required: true,
      type: 'number',
      min: 0
    },
    {
      field: 'date',
      required: true,
      type: 'date'
    },
    {
      field: 'uom',
      required: true,
      type: 'string',
      defaultValue: 'KG'
    },
    {
      field: 'vendor',
      required: true,
      type: 'string'
    },
    {
      field: 'amount_inr',
      required: false,
      type: 'number',
      min: 0,
      defaultValue: 0
    },
    {
      field: 'invoice_number',
      required: false,
      type: 'string'
    },
    {
      field: 'remarks',
      required: false,
      type: 'string'
    }
  ];

  const parseCSV = (content: string) => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));
    const data: any[] = [];

    // Updated header mapping to match exact database schema
    const headerMap: Record<string, string[]> = {
      'item_code': ['item_code', 'itemcode', 'item', 'code'],
      'grn_number': ['grn_number', 'grnnumber', 'grn', 'receipt_number'],
      'qty_received': ['qty_received', 'qtyreceived', 'quantity', 'qty'],
      'date': ['date', 'received_date', 'receiveddate', 'receipt_date'],
      'uom': ['uom', 'unit', 'unit_of_measure'],
      'vendor': ['vendor', 'supplier_name', 'suppliername', 'supplier'],
      'amount_inr': ['amount_inr', 'amount', 'total_amount', 'value'],
      'invoice_number': ['invoice_number', 'invoicenumber', 'invoice', 'invoice_no'],
      'remarks': ['remarks', 'notes', 'comment', 'description']
    };

    // Find matching headers
    const mappedHeaders: Record<string, number> = {};
    Object.entries(headerMap).forEach(([field, alternatives]) => {
      const headerIndex = headers.findIndex(h => alternatives.includes(h));
      if (headerIndex !== -1) {
        mappedHeaders[field] = headerIndex;
      }
    });

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length === 1 && values[0] === '') continue;

      const row: any = {};
      Object.entries(mappedHeaders).forEach(([field, index]) => {
        if (values[index] !== undefined) {
          row[field] = values[index];
        }
      });

      if (row.item_code && row.grn_number) {
        data.push(row);
      }
    }

    return { data, headers: Object.keys(mappedHeaders) };
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a CSV file to upload",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setResults(null);

    try {
      const content = await file.text();
      const parseResult = parseCSV(content);

      if (!parseResult.data || parseResult.data.length === 0) {
        throw new Error("No valid data rows found in CSV file");
      }

      // Validate against item_master
      setProgress(10);
      
      const itemCodes = [...new Set(parseResult.data.map(row => row.item_code).filter(Boolean))];
      
      const { data: validItems } = await supabase
        .from('satguru_item_master')
        .select('item_code')
        .in('item_code', itemCodes);

      const validItemSet = new Set(validItems?.map(i => i.item_code) || []);

      const { data: exampleItems } = await supabase
        .from('satguru_item_master')
        .select('item_code')
        .limit(5);

      const exampleCodes = exampleItems?.map(i => i.item_code).join(', ') || 'No items found';

      setProgress(20);

      const validationRules = getValidationRules();
      const processedRows: any[] = [];
      const errors: Array<{ row: number; message: string }> = [];

      for (let i = 0; i < parseResult.data.length; i++) {
        const rowNum = i + 2;
        try {
          const validation = BulkUploadValidator.validateRow(
            parseResult.data[i],
            validationRules,
            rowNum
          );

          if (!validation.isValid) {
            errors.push({
              row: rowNum,
              message: validation.errors.join('; ')
            });
            continue;
          }

          const validatedData = validation.transformedData as BulkGRNRow;

          if (!validItemSet.has(validatedData.item_code)) {
            throw new Error(
              `Item code '${validatedData.item_code}' not found in item master. ` +
              `Please use valid item codes. Examples: ${exampleCodes}`
            );
          }

          // Structure data to match exact satguru_grn_log schema
          processedRows.push({
            item_code: validatedData.item_code,
            grn_number: validatedData.grn_number,
            qty_received: validatedData.qty_received,
            date: validatedData.date,
            uom: validatedData.uom || 'KG',
            vendor: validatedData.vendor,
            amount_inr: validatedData.amount_inr || 0,
            invoice_number: validatedData.invoice_number || null,
            remarks: validatedData.remarks || 'Bulk GRN upload',
            created_at: new Date().toISOString()
          });

        } catch (error: any) {
          errors.push({
            row: rowNum,
            message: error.message || 'Unknown validation error'
          });
        }
      }

      setProgress(60);

      // Insert into satguru_grn_log with exact schema match
      let successCount = 0;
      if (processedRows.length > 0) {
        const { data, error } = await supabase
          .from('satguru_grn_log')
          .insert(processedRows)
          .select();

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        successCount = processedRows.length;
      }

      setProgress(100);

      const result: BulkUploadResult = {
        success: successCount,
        errors: errors
      };

      setResults(result);

      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['grn'] });
        queryClient.invalidateQueries({ queryKey: ['stock'] });
        toast({
          title: "Success",
          description: `Successfully uploaded ${successCount} GRN entries`,
        });
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const resetForm = () => {
    setFile(null);
    setResults(null);
    setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Upload GRN</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Updated CSV Format:</strong> This template now matches the exact database schema. 
              Required fields: item_code, grn_number, qty_received, date, uom, vendor.
              Optional: amount_inr, invoice_number, remarks.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label className="text-base font-medium">Step 1: Download Updated Template</Label>
            <Button onClick={downloadTemplate} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download Updated Template
            </Button>
            <p className="text-sm text-muted-foreground">
              Download the updated CSV template with exact database field mapping.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">Step 2: Upload CSV File</Label>
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) {
                  setFile(selectedFile);
                  setResults(null);
                }
              }}
            />
            {file && (
              <p className="text-sm text-green-600">
                Selected: {file.name} ({Math.round(file.size / 1024)} KB)
              </p>
            )}
          </div>

          {isUploading && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground">
                Processing... {progress}%
              </p>
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Upload Complete:</strong> {results.success} GRN entries processed successfully
                  {results.errors.length > 0 && `, ${results.errors.length} errors`}
                </AlertDescription>
              </Alert>

              {results.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <strong>Errors found:</strong>
                      {results.errors.slice(0, 5).map((error, index) => (
                        <div key={index} className="text-xs">
                          Row {error.row}: {error.message}
                        </div>
                      ))}
                      {results.errors.length > 5 && (
                        <div className="text-xs">
                          ... and {results.errors.length - 5} more errors
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={resetForm}>
              Reset
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="min-w-[120px]"
            >
              {isUploading ? (
                <>Processing...</>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload GRN
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
