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
import { AlertCircle, Download, Upload, CheckCircle, Info, Eye, FileText } from "lucide-react";
import { CSVParser } from "@/utils/csvParser";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface DuplicateAnalysis {
  existingRecords: any[];
  duplicateRows: number[];
  newRows: number[];
  duplicateDetails: Array<{
    rowIndex: number;
    duplicateKey: string;
    existingRecord: any;
    csvRow: any;
  }>;
}

interface BulkUploadResult {
  success: number;
  skipped: number;
  errors: Array<{ row: number; message: string; data?: any }>;
  duplicateDetails?: DuplicateAnalysis;
}

interface BulkUploadGRNProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkUploadGRN({ open, onOpenChange }: BulkUploadGRNProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkUploadResult | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [duplicateAnalysis, setDuplicateAnalysis] = useState<DuplicateAnalysis | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [showDuplicatePreview, setShowDuplicatePreview] = useState(false);
  const queryClient = useQueryClient();

  const downloadTemplate = async () => {
    try {
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

    let parsedDate = '';
    if (row.date) {
      try {
        const dateStr = row.date.toString().trim();
        let dateObj: Date;
        
        if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
          const [day, month, year] = dateStr.split('-');
          dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dateObj = new Date(dateStr);
        } else if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
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

  const analyzeDuplicates = async (validatedRows: BulkGRNRow[]): Promise<DuplicateAnalysis> => {
    console.log('🔍 Starting duplicate analysis for', validatedRows.length, 'rows');
    
    // Get all existing GRN records for comparison
    const { data: existingGRNs, error } = await supabase
      .from('satguru_grn_log')
      .select('*');

    if (error) {
      console.error('Error fetching existing GRNs:', error);
      throw new Error('Failed to fetch existing GRN records');
    }

    const existingRecords = existingGRNs || [];
    console.log('📊 Found', existingRecords.length, 'existing GRN records');

    // Create lookup maps for faster duplicate detection
    const grnItemMap = new Map<string, any>();
    const itemDateVendorMap = new Map<string, any>();

    existingRecords.forEach(record => {
      // Primary key: grn_number + item_code
      const primaryKey = `${record.grn_number}_${record.item_code}`;
      grnItemMap.set(primaryKey, record);

      // Secondary key: item_code + date + vendor + qty_received
      const secondaryKey = `${record.item_code}_${record.date}_${record.vendor}_${record.qty_received}`;
      itemDateVendorMap.set(secondaryKey, record);
    });

    const duplicateRows: number[] = [];
    const newRows: number[] = [];
    const duplicateDetails: DuplicateAnalysis['duplicateDetails'] = [];

    validatedRows.forEach((row, index) => {
      const primaryKey = `${row.grn_number}_${row.item_code}`;
      const secondaryKey = `${row.item_code}_${row.date}_${row.vendor}_${row.qty_received}`;

      let existingRecord = grnItemMap.get(primaryKey);
      let duplicateKey = primaryKey;

      // If not found by primary key, check secondary key
      if (!existingRecord) {
        existingRecord = itemDateVendorMap.get(secondaryKey);
        duplicateKey = secondaryKey;
      }

      if (existingRecord) {
        duplicateRows.push(index);
        duplicateDetails.push({
          rowIndex: index,
          duplicateKey,
          existingRecord,
          csvRow: row
        });
      } else {
        newRows.push(index);
      }
    });

    console.log('📈 Duplicate analysis complete:', {
      totalRows: validatedRows.length,
      duplicates: duplicateRows.length,
      newRecords: newRows.length
    });

    return {
      existingRecords,
      duplicateRows,
      newRows,
      duplicateDetails
    };
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
      setDuplicateAnalysis(null);
      setShowDuplicatePreview(false);
      
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

  const analyzeDuplicatesInFile = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const csvContent = await file.text();
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

      if (!parseResult.data || parseResult.data.length === 0) {
        throw new Error("No valid data found in CSV file");
      }

      // Validate all rows
      const validatedRows: BulkGRNRow[] = [];
      const errors: Array<{ row: number; message: string; data?: any }> = [];

      for (let i = 0; i < parseResult.data.length; i++) {
        const validation = validateRow(parseResult.data[i], i + 2);
        if (validation.isValid && validation.data) {
          validatedRows.push(validation.data);
        } else {
          errors.push({
            row: i + 2,
            message: validation.errors.join('; '),
            data: parseResult.data[i]
          });
        }
      }

      if (validatedRows.length === 0) {
        throw new Error("No valid rows found after validation");
      }

      // Analyze duplicates
      const analysis = await analyzeDuplicates(validatedRows);
      setDuplicateAnalysis(analysis);
      setShowDuplicatePreview(true);

      toast({
        title: "Analysis Complete",
        description: `Found ${analysis.newRows.length} new records and ${analysis.duplicateRows.length} duplicates`,
      });

    } catch (error: any) {
      console.error('💥 Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze file",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !duplicateAnalysis) {
      toast({
        title: "No Analysis Available",
        description: "Please analyze the file first",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setResults(null);

    try {
      // Get CSV content and parse again
      const csvContent = await file.text();
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

      setProgress(20);

      // Validate against item_master
      const itemCodes = [...new Set(parseResult.data.map(row => row.item_code).filter(Boolean))];
      
      const { data: validItems } = await supabase
        .from('satguru_item_master')
        .select('item_code')
        .in('item_code', itemCodes);

      const validItemSet = new Set(validItems?.map(i => i.item_code) || []);
      setProgress(40);

      // Process only new records or all records based on user choice
      const processedRows: any[] = [];
      const errors: Array<{ row: number; message: string; data?: any }> = [];
      let skippedCount = 0;

      for (let i = 0; i < parseResult.data.length; i++) {
        const rowNum = i + 2;
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

          // Check if this row is a duplicate
          const isDuplicate = duplicateAnalysis.duplicateRows.includes(i);
          
          if (isDuplicate && skipDuplicates) {
            skippedCount++;
            continue; // Skip duplicates
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
        skipped: skippedCount,
        errors: errors,
        duplicateDetails: duplicateAnalysis
      };

      setResults(result);

      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['grn'] });
        queryClient.invalidateQueries({ queryKey: ['stock'] });
        
        const message = skipDuplicates 
          ? `Successfully uploaded ${successCount} new GRN entries, skipped ${skippedCount} duplicates`
          : `Successfully uploaded ${successCount} GRN entries`;
        
        toast({
          title: "Upload Successful",
          description: message + (errors.length > 0 ? ` with ${errors.length} errors` : ''),
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
    setDuplicateAnalysis(null);
    setShowDuplicatePreview(false);
    setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Smart Bulk Upload GRN</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Enhanced CSV Processing:</strong> Upload your GRN data with intelligent duplicate detection.
              The system will analyze your data and prevent duplicate entries while preserving existing records.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label className="text-base font-medium">Step 1: Download Template</Label>
            <Button onClick={downloadTemplate} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download GRN Template
            </Button>
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

          {/* Step 3: Analyze Duplicates */}
          {file && !showDuplicatePreview && (
            <div className="space-y-2">
              <Label className="text-base font-medium">Step 3: Analyze for Duplicates</Label>
              <Button 
                onClick={analyzeDuplicatesInFile}
                disabled={isAnalyzing}
                className="w-full"
                variant="outline"
              >
                {isAnalyzing ? (
                  <>Analyzing...</>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Analyze Duplicates
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Duplicate Analysis Results */}
          {duplicateAnalysis && showDuplicatePreview && (
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Duplicate Analysis Complete:</strong> Found {duplicateAnalysis.newRows.length} new records and {duplicateAnalysis.duplicateRows.length} duplicates
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{duplicateAnalysis.newRows.length}</div>
                  <div className="text-sm text-green-700">New Records</div>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{duplicateAnalysis.duplicateRows.length}</div>
                  <div className="text-sm text-yellow-700">Duplicates Found</div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{duplicateAnalysis.existingRecords.length}</div>
                  <div className="text-sm text-blue-700">Existing Records</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skipDuplicates"
                  checked={skipDuplicates}
                  onCheckedChange={(checked) => setSkipDuplicates(checked === true)}
                />
                <Label htmlFor="skipDuplicates" className="text-sm">
                  Skip duplicates and preserve existing records with their remarks
                </Label>
              </div>

              {duplicateAnalysis.duplicateDetails.length > 0 && (
                <Tabs defaultValue="summary" className="w-full">
                  <TabsList>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="details">Duplicate Details</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="summary" className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      {skipDuplicates 
                        ? `${duplicateAnalysis.newRows.length} records will be inserted, ${duplicateAnalysis.duplicateRows.length} duplicates will be skipped`
                        : `All ${duplicateAnalysis.newRows.length + duplicateAnalysis.duplicateRows.length} records will be processed`
                      }
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="details" className="space-y-2">
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {duplicateAnalysis.duplicateDetails.slice(0, 10).map((detail, index) => (
                        <div key={index} className="p-2 bg-yellow-50 rounded text-xs">
                          <div className="font-medium">Row {detail.rowIndex + 2}: {detail.csvRow.grn_number} - {detail.csvRow.item_code}</div>
                          <div className="text-muted-foreground">
                            Matches existing: {detail.existingRecord.grn_number} from {detail.existingRecord.date}
                          </div>
                        </div>
                      ))}
                      {duplicateAnalysis.duplicateDetails.length > 10 && (
                        <div className="text-xs text-muted-foreground">
                          ... and {duplicateAnalysis.duplicateDetails.length - 10} more duplicates
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground">
                Processing data... {progress}%
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
                  {results.skipped > 0 && `, ${results.skipped} duplicates skipped`}
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
            {showDuplicatePreview && (
              <Button
                onClick={handleUpload}
                disabled={!duplicateAnalysis || isUploading}
                className="min-w-[120px]"
              >
                {isUploading ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {duplicateAnalysis?.newRows.length || 0} New Records
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
