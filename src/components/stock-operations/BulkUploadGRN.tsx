
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
import { AlertCircle, Download, Upload, CheckCircle, Info } from "lucide-react";
import { CSVParser } from "@/utils/csvParser";

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
  errors: Array<{ row: number; message: string; data?: any }>;
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
  const [previewData, setPreviewData] = useState<any>(null);
  const queryClient = useQueryClient();

  const downloadTemplate = async () => {
    try {
      // Get sample item codes from satguru_item_master for reference
      const { data: sampleItems } = await supabase
        .from('satguru_item_master')
        .select('item_code')
        .limit(3);

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

      const sampleData = [
        `${sampleCodes[0] || 'RAW_ADH_117'},GRN-2025-001,1000,15-01-2025,KG,Supplier A,25500.00,INV-2025-001,Raw material receipt`,
        `${sampleCodes[1] || 'PAC_ADH_110'},GRN-2025-002,500,15-01-2025,KG,Supplier B,6000.00,INV-2025-002,Packaging material receipt`,
        `${sampleCodes[2] || 'FIN_001'},GRN-2025-003,200,15-01-2025,KG,Internal Transfer,0,,Internal stock transfer`
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

  const validateRow = (row: any, rowNumber: number): { isValid: boolean; errors: string[]; data?: BulkGRNRow } => {
    const errors: string[] = [];
    
    console.log(`🔍 Validating row ${rowNumber}:`, row);

    // Check required fields
    if (!row.item_code || row.item_code.trim() === '') {
      errors.push('Item code is required');
    }
    
    if (!row.grn_number || row.grn_number.trim() === '') {
      errors.push('GRN number is required');
    }
    
    if (!row.qty_received || isNaN(Number(row.qty_received))) {
      errors.push('Valid quantity is required');
    } else if (Number(row.qty_received) <= 0) {
      errors.push('Quantity must be greater than 0');
    }

    if (!row.date || row.date.trim() === '') {
      errors.push('Date is required');
    }

    if (!row.vendor || row.vendor.trim() === '') {
      errors.push('Vendor is required');
    }

    // Parse and validate date
    let parsedDate = '';
    if (row.date) {
      try {
        // Support multiple date formats
        const dateStr = row.date.toString().trim();
        let dateObj: Date;
        
        if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
          // DD-MM-YYYY format
          const [day, month, year] = dateStr.split('-');
          dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // YYYY-MM-DD format
          dateObj = new Date(dateStr);
        } else if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          // DD/MM/YYYY format
          const [day, month, year] = dateStr.split('/');
          dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
          throw new Error('Invalid date format');
        }

        if (isNaN(dateObj.getTime())) {
          throw new Error('Invalid date');
        }

        parsedDate = dateObj.toISOString().split('T')[0];
      } catch (error) {
        errors.push(`Invalid date format: ${row.date}. Use DD-MM-YYYY, YYYY-MM-DD, or DD/MM/YYYY`);
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Create validated data object
    const validatedData: BulkGRNRow = {
      item_code: row.item_code.trim(),
      grn_number: row.grn_number.trim(),
      qty_received: Number(row.qty_received),
      date: parsedDate,
      uom: row.uom?.trim() || 'KG',
      vendor: row.vendor.trim(),
      amount_inr: row.amount_inr ? Number(row.amount_inr) : 0,
      invoice_number: row.invoice_number?.trim() || '',
      remarks: row.remarks?.trim() || 'Bulk GRN upload'
    };

    return { isValid: true, errors: [], data: validatedData };
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        toast({
          title: "Invalid File",
          description: "Please select a CSV file",
          variant: "destructive"
        });
        return;
      }

      setFile(selectedFile);
      setResults(null);
      
      // Preview first few rows
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvContent = e.target?.result as string;
        if (csvContent) {
          const parseResult = CSVParser.parseCSV(csvContent, {
            skipEmptyRows: true,
            trimValues: true,
            headerMapping: {
              'item_code': 'item_code',
              'grn_number': 'grn_number', 
              'qty_received': 'qty_received',
              'date': 'date',
              'uom': 'uom',
              'vendor': 'vendor',
              'amount_inr': 'amount_inr',
              'invoice_number': 'invoice_number',
              'remarks': 'remarks'
            }
          });
          
          console.log('📊 CSV Preview:', {
            headers: parseResult.headers,
            sampleData: parseResult.data.slice(0, 3),
            totalRows: parseResult.totalRows,
            validRows: parseResult.validRows,
            errors: parseResult.errors.slice(0, 3)
          });
          
          setPreviewData({
            headers: parseResult.headers,
            sampleRows: parseResult.data.slice(0, 3),
            totalRows: parseResult.totalRows,
            errors: parseResult.errors.slice(0, 5)
          });
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to upload",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setResults(null);

    try {
      const csvContent = await file.text();
      console.log('📄 Raw CSV content preview:', csvContent.substring(0, 500));
      
      setProgress(10);

      const parseResult = CSVParser.parseCSV(csvContent, {
        skipEmptyRows: true,
        trimValues: true,
        headerMapping: {
          'item_code': 'item_code',
          'grn_number': 'grn_number', 
          'qty_received': 'qty_received',
          'date': 'date',
          'uom': 'uom',
          'vendor': 'vendor',
          'amount_inr': 'amount_inr',
          'invoice_number': 'invoice_number',
          'remarks': 'remarks'
        }
      });

      console.log('📊 Parse result:', {
        totalRows: parseResult.totalRows,
        validRows: parseResult.validRows,
        headers: parseResult.headers,
        parseErrors: parseResult.errors,
        sampleData: parseResult.data.slice(0, 2)
      });

      if (parseResult.errors.length > 0) {
        console.error('🚨 CSV parsing errors:', parseResult.errors);
      }

      if (!parseResult.data || parseResult.data.length === 0) {
        throw new Error("No valid data rows found in CSV file. Please check your file format and ensure it has data rows after the header.");
      }

      setProgress(20);

      // Validate against item_master
      const itemCodes = [...new Set(parseResult.data.map(row => row.item_code).filter(Boolean))];
      
      const { data: validItems } = await supabase
        .from('satguru_item_master')
        .select('item_code')
        .in('item_code', itemCodes);

      const validItemSet = new Set(validItems?.map(i => i.item_code) || []);

      console.log('✅ Valid items found:', validItemSet.size, 'out of', itemCodes.length);

      setProgress(40);

      const processedRows: any[] = [];
      const errors: Array<{ row: number; message: string; data?: any }> = [];

      // Process each row
      for (let i = 0; i < parseResult.data.length; i++) {
        const rowNum = i + 2; // Account for header row
        const rowData = parseResult.data[i];
        
        try {
          const validation = validateRow(rowData, rowNum);
          
          if (!validation.isValid) {
            errors.push({
              row: rowNum,
              message: validation.errors.join('; '),
              data: rowData
            });
            continue;
          }

          const validatedData = validation.data!;

          // Check if item exists in master
          if (!validItemSet.has(validatedData.item_code)) {
            errors.push({
              row: rowNum,
              message: `Item code '${validatedData.item_code}' not found in item master`,
              data: rowData
            });
            continue;
          }

          // Structure data to match satguru_grn_log schema
          processedRows.push({
            item_code: validatedData.item_code,
            grn_number: validatedData.grn_number,
            qty_received: validatedData.qty_received,
            date: validatedData.date,
            uom: validatedData.uom,
            vendor: validatedData.vendor,
            amount_inr: validatedData.amount_inr,
            invoice_number: validatedData.invoice_number || null,
            remarks: validatedData.remarks,
            transaction_type: 'REGULAR_GRN',
            created_at: new Date().toISOString()
          });

        } catch (error: any) {
          console.error(`❌ Error processing row ${rowNum}:`, error);
          errors.push({
            row: rowNum,
            message: error.message || 'Unknown processing error',
            data: rowData
          });
        }
      }

      setProgress(80);

      console.log('📈 Processing summary:', {
        totalRows: parseResult.data.length,
        processedRows: processedRows.length,
        errors: errors.length
      });

      // Insert processed rows
      let successCount = 0;
      if (processedRows.length > 0) {
        const { data, error } = await supabase
          .from('satguru_grn_log')
          .insert(processedRows)
          .select();

        if (error) {
          console.error('💥 Database insert error:', error);
          throw new Error(`Database error: ${error.message}`);
        }

        successCount = processedRows.length;
        console.log('✅ Successfully inserted:', successCount, 'records');
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
          title: "Upload Successful",
          description: `Successfully uploaded ${successCount} GRN entries${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
        });
      } else if (errors.length > 0) {
        toast({
          title: "Upload Failed",
          description: `All ${errors.length} rows had validation errors. Please check the error details below.`,
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('💥 Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "An unexpected error occurred during upload",
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
    setPreviewData(null);
    setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload GRN</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Enhanced CSV Processing:</strong> Upload your GRN data with flexible date formats (DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY).
              The system will validate all data and show detailed error reports for any issues.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label className="text-base font-medium">Step 1: Download Template</Label>
            <Button onClick={downloadTemplate} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download GRN Template
            </Button>
            <p className="text-sm text-muted-foreground">
              Template includes sample data with correct format (DD-MM-YYYY dates).
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">Step 2: Upload Your CSV File</Label>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
            />
            
            {file && (
              <div className="p-3 bg-muted rounded text-sm">
                <p className="font-medium text-green-600">
                  ✅ Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                </p>
              </div>
            )}
          </div>

          {/* CSV Preview */}
          {previewData && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>CSV Preview:</strong> Found {previewData.totalRows} total rows with headers: {previewData.headers.join(', ')}
                </AlertDescription>
              </Alert>
              
              {previewData.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Parsing Issues Found:</strong>
                    <ul className="mt-2 space-y-1">
                      {previewData.errors.map((error: any, index: number) => (
                        <li key={index} className="text-xs">
                          Row {error.rowNumber}: {error.error}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground">
                Processing CSV data... {progress}%
              </p>
            </div>
          )}

          {/* Upload Results */}
          {results && (
            <div className="space-y-4">
              <Alert variant={results.success > 0 ? "default" : "destructive"}>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Upload Results:</strong> {results.success} records uploaded successfully
                  {results.errors.length > 0 && `, ${results.errors.length} errors found`}
                </AlertDescription>
              </Alert>

              {results.errors.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-3">
                  <h4 className="font-medium text-destructive">Validation Errors:</h4>
                  {results.errors.map((error, index) => (
                    <Alert key={index} variant="destructive" className="text-xs">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div>
                          <strong>Row {error.row}:</strong> {error.message}
                        </div>
                        {error.data && (
                          <div className="mt-1 text-muted-foreground">
                            Data: {JSON.stringify(error.data).substring(0, 100)}...
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
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
                  Upload GRN Data
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
