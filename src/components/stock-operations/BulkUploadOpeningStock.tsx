
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

interface StockRow {
  item_code: string;
  current_qty: number;
  min_stock_level?: number;
  max_stock_level?: number;
  reorder_level?: number;
}

interface ValidationResult {
  valid: StockRow[];
  invalid: Array<{
    row: number;
    data: any;
    errors: string[];
  }>;
}

export function BulkUploadOpeningStock() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Updated header mapping for satguru_stock schema
  const headerMap: Record<string, string[]> = {
    item_code: ['item_code', 'item code', 'itemcode', 'Item Code', 'ITEM_CODE'],
    current_qty: ['current_qty', 'opening_qty', 'opening qty', 'quantity', 'qty', 'Current Qty', 'CURRENT_QTY'],
    min_stock_level: ['min_stock_level', 'min_level', 'minimum', 'Min Stock Level', 'MIN_STOCK_LEVEL'],
    max_stock_level: ['max_stock_level', 'max_level', 'maximum', 'Max Stock Level', 'MAX_STOCK_LEVEL'],
    reorder_level: ['reorder_level', 'reorder', 'reorder_point', 'Reorder Level', 'REORDER_LEVEL']
  };

  const normalizeHeaders = (headers: string[]): Record<string, string> => {
    const normalized: Record<string, string> = {};
    
    headers.forEach(header => {
      const trimmedHeader = header.trim();
      for (const [standardKey, variations] of Object.entries(headerMap)) {
        if (variations.some(variation => 
          variation.toLowerCase() === trimmedHeader.toLowerCase()
        )) {
          normalized[standardKey] = trimmedHeader;
          break;
        }
      }
    });
    
    return normalized;
  };

  const validateData = async (data: any[]): Promise<ValidationResult> => {
    const valid: StockRow[] = [];
    const invalid: Array<{ row: number; data: any; errors: string[] }> = [];

    // Get existing item codes for validation from satguru_item_master
    const { data: items } = await supabase
      .from('satguru_item_master')
      .select('item_code');
    
    const validItemCodes = new Set(items?.map(item => item.item_code) || []);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const errors: string[] = [];

      // Check required fields
      if (!row.item_code || row.item_code.toString().trim() === '') {
        errors.push('Item code is required');
      } else if (!validItemCodes.has(row.item_code.toString().trim())) {
        errors.push('Item code does not exist in item master');
      }

      if (!row.current_qty && row.current_qty !== 0) {
        errors.push('Current quantity is required');
      } else if (isNaN(Number(row.current_qty))) {
        errors.push('Current quantity must be a number');
      } else if (Number(row.current_qty) < 0) {
        errors.push('Current quantity cannot be negative');
      }

      if (errors.length === 0) {
        valid.push({
          item_code: row.item_code.toString().trim(),
          current_qty: Number(row.current_qty),
          min_stock_level: row.min_stock_level ? Number(row.min_stock_level) : 0,
          max_stock_level: row.max_stock_level ? Number(row.max_stock_level) : 0,
          reorder_level: row.reorder_level ? Number(row.reorder_level) : 0
        });
      } else {
        invalid.push({
          row: i + 2, // +2 because Excel rows start at 1 and we have header
          data: row,
          errors
        });
      }
    }

    return { valid, invalid };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error('File must contain at least a header row and one data row');
      }

      const headers = jsonData[0] as string[];
      const normalizedHeaderMap = normalizeHeaders(headers);
      
      // Convert rows to objects with normalized headers
      const dataRows = jsonData.slice(1).map((row: any[]) => {
        const obj: any = {};
        headers.forEach((header, index) => {
          const normalizedKey = Object.keys(normalizedHeaderMap).find(key => 
            normalizedHeaderMap[key] === header
          );
          if (normalizedKey) {
            obj[normalizedKey] = row[index];
          }
        });
        return obj;
      }).filter(row => Object.keys(row).length > 0);

      setPreviewData(dataRows.slice(0, 5)); // Show first 5 rows for preview
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to parse file",
        variant: "destructive",
      });
    }
  };

  const processUpload = async () => {
    if (!file || previewData.length === 0) {
      toast({
        title: "Error",
        description: "Please select a valid file first",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Parse the full file again
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const headers = jsonData[0] as string[];
      const normalizedHeaderMap = normalizeHeaders(headers);
      
      const dataRows = jsonData.slice(1).map((row: any[]) => {
        const obj: any = {};
        headers.forEach((header, index) => {
          const normalizedKey = Object.keys(normalizedHeaderMap).find(key => 
            normalizedHeaderMap[key] === header
          );
          if (normalizedKey) {
            obj[normalizedKey] = row[index];
          }
        });
        return obj;
      }).filter(row => Object.keys(row).length > 0);

      setProgress(25);

      // Validate data
      const validation = await validateData(dataRows);
      setProgress(50);

      if (validation.valid.length === 0) {
        throw new Error('No valid records found');
      }

      // Insert valid records in batches - Updated to match satguru_stock schema exactly
      const batchSize = 100;
      let successCount = 0;
      
      for (let i = 0; i < validation.valid.length; i += batchSize) {
        const batch = validation.valid.slice(i, i + batchSize);
        
        // Structure data to match exact satguru_stock schema
        const stockData = batch.map(item => ({
          item_code: item.item_code,
          current_qty: item.current_qty,
          min_stock_level: item.min_stock_level || 0,
          max_stock_level: item.max_stock_level || 0,
          reorder_level: item.reorder_level || 0,
          last_updated: new Date().toISOString()
        }));

        // Upsert to satguru_stock table with exact schema match
        const { error: stockError } = await supabase
          .from('satguru_stock')
          .upsert(stockData, { onConflict: 'item_code' });

        if (stockError) throw stockError;

        // Create corresponding GRN log entries for audit trail
        const logData = batch.map(item => ({
          item_code: item.item_code,
          grn_number: `OPENING-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          qty_received: item.current_qty,
          date: new Date().toISOString().split('T')[0],
          uom: 'KG',
          vendor: 'Opening Stock',
          amount_inr: 0,
          remarks: 'Opening stock upload'
        }));

        const { error: logError } = await supabase
          .from('satguru_grn_log')
          .insert(logData);

        if (logError) throw logError;

        successCount += batch.length;
        setProgress(50 + ((i + batch.length) / validation.valid.length) * 50);
      }

      setResults({
        success: successCount,
        failed: validation.invalid.length,
        errors: validation.invalid
      });

      toast({
        title: "Upload Complete",
        description: `Successfully processed ${successCount} records. ${validation.invalid.length} records failed.`,
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    // Updated template to match exact satguru_stock schema
    const template = [
      ['item_code', 'current_qty', 'min_stock_level', 'max_stock_level', 'reorder_level'],
      ['SAMPLE001', '100', '10', '500', '25'],
      ['SAMPLE002', '200', '20', '1000', '50']
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Opening Stock Template');
    XLSX.writeFile(wb, 'opening_stock_template.xlsx');
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Bulk Upload Opening Stock
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload Data</TabsTrigger>
            <TabsTrigger value="results" disabled={!results}>Results</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Updated CSV Format:</strong> This template now matches the exact satguru_stock database schema. 
                Required: item_code, current_qty. Optional: min_stock_level, max_stock_level, reorder_level.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button onClick={downloadTemplate} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Updated Template
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Select Excel/CSV File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </div>

              {previewData.length > 0 && (
                <div className="space-y-2">
                  <Label>Preview (First 5 rows)</Label>
                  <div className="border rounded-md p-4 max-h-64 overflow-auto">
                    <pre className="text-sm">
                      {JSON.stringify(previewData, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {uploading && (
                <div className="space-y-2">
                  <Label>Upload Progress</Label>
                  <Progress value={progress} className="w-full" />
                  <p className="text-sm text-muted-foreground">{progress}% complete</p>
                </div>
              )}

              <Button 
                onClick={processUpload} 
                disabled={!file || uploading || previewData.length === 0}
                className="w-full"
              >
                {uploading ? "Processing..." : "Upload Opening Stock"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {results && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="text-2xl font-bold text-green-600">{results.success}</p>
                          <p className="text-sm text-muted-foreground">Successful</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <div>
                          <p className="text-2xl font-bold text-red-600">{results.failed}</p>
                          <p className="text-sm text-muted-foreground">Failed</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {results.errors.length > 0 && (
                  <div className="space-y-2">
                    <Label>Failed Records</Label>
                    <div className="border rounded-md max-h-64 overflow-auto">
                      {results.errors.map((error: any, index: number) => (
                        <Alert key={index} variant="destructive" className="mb-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Row {error.row}:</strong> {error.errors.join(', ')}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
