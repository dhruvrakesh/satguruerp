
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, AlertCircle, CheckCircle, History, Shield, FileText, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

interface LegacyRow {
  item_code: string;
  current_qty: number;
  remarks?: string;
}

interface ConflictAnalysis {
  missing: LegacyRow[];
  conflicts: Array<{
    item_code: string;
    legacy_qty: number;
    existing_qty: number;
    difference: number;
  }>;
  identical: LegacyRow[];
}

interface ImportResult {
  imported: number;
  skipped: number;
  conflicts: number;
  details: any[];
}

export function LegacyDataIntegration() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [legacyData, setLegacyData] = useState<LegacyRow[]>([]);
  const [conflictAnalysis, setConflictAnalysis] = useState<ConflictAnalysis | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const parseFile = async (selectedFile: File) => {
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
      const dataRows = jsonData.slice(1).map((row: any[]) => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')] = row[index];
        });
        return obj;
      }).filter(row => Object.keys(row).length > 0);

      // Map to expected format
      const parsed: LegacyRow[] = dataRows.map(row => ({
        item_code: row.item_code || row.itemcode || row['item code'] || '',
        current_qty: Number(row.current_qty || row.qty || row.quantity || row['current qty'] || 0),
        remarks: row.remarks || `Legacy data import - ${new Date().toISOString()}`
      })).filter(row => row.item_code && row.current_qty > 0);

      setLegacyData(parsed);
      toast({
        title: "File Parsed Successfully",
        description: `Found ${parsed.length} valid legacy records`,
      });

    } catch (error) {
      toast({
        title: "Parse Error",
        description: error instanceof Error ? error.message : "Failed to parse file",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setUploading(true);
    
    try {
      await parseFile(selectedFile);
    } finally {
      setUploading(false);
    }
  };

  const performConflictAnalysis = async () => {
    if (legacyData.length === 0) {
      toast({
        title: "No Data",
        description: "Please upload legacy data first",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);
    setProgress(0);

    try {
      // Get existing opening stock entries
      const { data: existingStock, error } = await supabase
        .from('satguru_grn_log')
        .select('item_code, qty_received')
        .eq('transaction_type', 'OPENING_STOCK');

      if (error) throw error;

      setProgress(50);

      // Create lookup map for existing stock
      const existingMap = new Map(
        existingStock?.map(item => [item.item_code, item.qty_received]) || []
      );

      // Analyze conflicts
      const missing: LegacyRow[] = [];
      const conflicts: ConflictAnalysis['conflicts'] = [];
      const identical: LegacyRow[] = [];

      legacyData.forEach(item => {
        const existingQty = existingMap.get(item.item_code);
        
        if (existingQty === undefined) {
          missing.push(item);
        } else if (existingQty === item.current_qty) {
          identical.push(item);
        } else {
          conflicts.push({
            item_code: item.item_code,
            legacy_qty: item.current_qty,
            existing_qty: existingQty,
            difference: item.current_qty - existingQty
          });
        }
      });

      setConflictAnalysis({ missing, conflicts, identical });
      setProgress(100);

      toast({
        title: "Analysis Complete",
        description: `Found ${missing.length} new items, ${conflicts.length} conflicts, ${identical.length} identical`,
      });

    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze conflicts",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const performSafeImport = async (importMissingOnly: boolean = true) => {
    if (!conflictAnalysis) {
      toast({
        title: "No Analysis",
        description: "Please run conflict analysis first",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setProgress(0);

    const batchId = crypto.randomUUID();
    const timestamp = new Date().toISOString().substring(0, 16).replace(/[-:T]/g, '');
    
    let imported = 0;
    let skipped = 0;
    let conflictCount = 0;
    const details: any[] = [];

    try {
      // Import missing items only (safe import)
      const itemsToImport = importMissingOnly ? conflictAnalysis.missing : 
        [...conflictAnalysis.missing, ...conflictAnalysis.conflicts.map(c => ({
          item_code: c.item_code,
          current_qty: c.legacy_qty,
          remarks: `Legacy conflict import - was ${c.existing_qty}, now ${c.legacy_qty}`
        }))];

      const totalItems = itemsToImport.length;
      
      for (let i = 0; i < itemsToImport.length; i++) {
        const item = itemsToImport[i];
        
        try {
          // Create GRN log entry
          const grnData = {
            grn_number: `LEGACY-${timestamp}-${item.item_code}`,
            item_code: item.item_code,
            qty_received: item.current_qty,
            date: new Date().toISOString().split('T')[0],
            uom: 'KG',
            vendor: 'Legacy Data Import',
            amount_inr: 0,
            remarks: item.remarks || `Legacy data import - Batch: ${batchId}`,
            transaction_type: 'OPENING_STOCK',
            upload_source: 'LEGACY_IMPORT'
          };

          const { error: grnError } = await supabase
            .from('satguru_grn_log')
            .insert([grnData]);

          if (grnError) throw grnError;

          // Update/insert stock record
          const stockData = {
            item_code: item.item_code,
            current_qty: item.current_qty,
            last_updated: new Date().toISOString(),
            batch_id: batchId,
            upload_source: 'LEGACY_IMPORT'
          };

          const { error: stockError } = await supabase
            .from('satguru_stock')
            .upsert([stockData], { onConflict: 'item_code' });

          if (stockError) throw stockError;

          imported++;
          details.push({
            item_code: item.item_code,
            qty: item.current_qty,
            status: 'imported',
            grn_number: grnData.grn_number
          });

        } catch (error) {
          console.error(`Failed to import ${item.item_code}:`, error);
          details.push({
            item_code: item.item_code,
            qty: item.current_qty,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }

        setProgress((i + 1) / totalItems * 100);
      }

      // Count skipped items
      skipped = conflictAnalysis.identical.length;
      conflictCount = importMissingOnly ? conflictAnalysis.conflicts.length : 0;

      setImportResult({
        imported,
        skipped,
        conflicts: conflictCount,
        details
      });

      toast({
        title: "Import Complete",
        description: `Imported ${imported} items, skipped ${skipped}, ${conflictCount} conflicts flagged`,
      });

    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Import process failed",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      ['item_code', 'current_qty', 'remarks'],
      ['SAMPLE001', '100', 'Legacy opening stock'],
      ['SAMPLE002', '250', 'Legacy opening stock']
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Legacy Data Template');
    XLSX.writeFile(wb, 'legacy_data_template.xlsx');
  };

  const downloadConflictReport = () => {
    if (!conflictAnalysis) return;

    const reportData = [
      ['Type', 'Item Code', 'Legacy Qty', 'Existing Qty', 'Difference', 'Action'],
      ...conflictAnalysis.missing.map(item => ['Missing', item.item_code, item.current_qty, '', '', 'Will Import']),
      ...conflictAnalysis.conflicts.map(item => ['Conflict', item.item_code, item.legacy_qty, item.existing_qty, item.difference, 'Needs Review']),
      ...conflictAnalysis.identical.map(item => ['Identical', item.item_code, item.current_qty, item.current_qty, 0, 'Skip'])
    ];

    const ws = XLSX.utils.aoa_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Conflict Analysis');
    XLSX.writeFile(wb, `legacy_conflict_analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Legacy Data Integration (97 Rows)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upload">1. Upload Data</TabsTrigger>
            <TabsTrigger value="analysis" disabled={legacyData.length === 0}>2. Conflict Analysis</TabsTrigger>
            <TabsTrigger value="import" disabled={!conflictAnalysis}>3. Safe Import</TabsTrigger>
            <TabsTrigger value="results" disabled={!importResult}>4. Results</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Safe Integration Process:</strong> This tool analyzes your 97 legacy rows against existing opening stock (206 entries) 
                to identify conflicts and safely import only new data without breaking existing calculations.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button onClick={downloadTemplate} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="legacy-file">Upload Legacy Data (Excel/CSV)</Label>
                <Input
                  id="legacy-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </div>

              {legacyData.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Parsed Legacy Data Preview</Label>
                    <Badge variant="secondary">{legacyData.length} rows loaded</Badge>
                  </div>
                  <div className="border rounded-md p-4 max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {legacyData.slice(0, 10).map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.item_code}</TableCell>
                            <TableCell>{item.current_qty}</TableCell>
                            <TableCell className="max-w-xs truncate">{item.remarks}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {legacyData.length > 10 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Showing first 10 of {legacyData.length} rows
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Conflict Analysis:</strong> Compare your legacy data against existing opening stock entries 
                to identify safe imports vs potential conflicts.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <Button 
                onClick={performConflictAnalysis} 
                disabled={analyzing || legacyData.length === 0}
                className="w-full"
              >
                <Eye className="h-4 w-4 mr-2" />
                {analyzing ? "Analyzing..." : "Run Conflict Analysis"}
              </Button>

              {analyzing && (
                <div className="space-y-2">
                  <Label>Analysis Progress</Label>
                  <Progress value={progress} className="w-full" />
                </div>
              )}

              {conflictAnalysis && (
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="text-2xl font-bold text-green-600">{conflictAnalysis.missing.length}</p>
                          <p className="text-sm text-muted-foreground">Safe to Import</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                        <div>
                          <p className="text-2xl font-bold text-amber-600">{conflictAnalysis.conflicts.length}</p>
                          <p className="text-sm text-muted-foreground">Conflicts Found</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <Shield className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="text-2xl font-bold text-blue-600">{conflictAnalysis.identical.length}</p>
                          <p className="text-sm text-muted-foreground">Identical (Skip)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {conflictAnalysis && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Detailed Analysis</Label>
                    <Button onClick={downloadConflictReport} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download Report
                    </Button>
                  </div>

                  {conflictAnalysis.conflicts.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Conflicts Detected:</strong> {conflictAnalysis.conflicts.length} items have different quantities. 
                        Review the conflict report before proceeding.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="border rounded-md max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Legacy Qty</TableHead>
                          <TableHead>Existing Qty</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {conflictAnalysis.missing.slice(0, 5).map((item, index) => (
                          <TableRow key={`missing-${index}`}>
                            <TableCell><Badge className="bg-green-50 text-green-700">New</Badge></TableCell>
                            <TableCell className="font-medium">{item.item_code}</TableCell>
                            <TableCell>{item.current_qty}</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>Will Import</TableCell>
                          </TableRow>
                        ))}
                        {conflictAnalysis.conflicts.slice(0, 3).map((item, index) => (
                          <TableRow key={`conflict-${index}`}>
                            <TableCell><Badge variant="destructive">Conflict</Badge></TableCell>
                            <TableCell className="font-medium">{item.item_code}</TableCell>
                            <TableCell>{item.legacy_qty}</TableCell>
                            <TableCell>{item.existing_qty}</TableCell>
                            <TableCell>Manual Review</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Safe Import:</strong> Import only non-conflicting items to preserve data integrity. 
                Conflicts will be flagged for manual review.
              </AlertDescription>
            </Alert>

            {conflictAnalysis && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    onClick={() => performSafeImport(true)} 
                    disabled={importing}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Safe Import ({conflictAnalysis.missing.length} items)
                  </Button>
                  
                  {conflictAnalysis.conflicts.length > 0 && (
                    <Button 
                      onClick={() => performSafeImport(false)} 
                      disabled={importing}
                      variant="destructive"
                      className="flex-1"
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Force Import All ({conflictAnalysis.missing.length + conflictAnalysis.conflicts.length} items)
                    </Button>
                  )}
                </div>

                {importing && (
                  <div className="space-y-2">
                    <Label>Import Progress</Label>
                    <Progress value={progress} className="w-full" />
                    <p className="text-sm text-muted-foreground">{progress.toFixed(1)}% complete</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {importResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                          <p className="text-sm text-muted-foreground">Imported</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <Shield className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="text-2xl font-bold text-blue-600">{importResult.skipped}</p>
                          <p className="text-sm text-muted-foreground">Skipped</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                        <div>
                          <p className="text-2xl font-bold text-amber-600">{importResult.conflicts}</p>
                          <p className="text-sm text-muted-foreground">Conflicts</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Alert>
                  <History className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Integration Complete:</strong> Your legacy data has been safely integrated. 
                    All imports are tracked with unique GRN numbers and batch IDs for audit purposes.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>Import Details</Label>
                  <div className="border rounded-md max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>GRN Number</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResult.details.map((detail, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{detail.item_code}</TableCell>
                            <TableCell>{detail.qty}</TableCell>
                            <TableCell>
                              <Badge variant={detail.status === 'imported' ? 'default' : 'destructive'}>
                                {detail.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{detail.grn_number || detail.error || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
