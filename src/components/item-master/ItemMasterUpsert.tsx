
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Info, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateBulkUploadData, type CsvItemData } from "@/schemas/itemMasterSchema";
import { ParsedRecord, UpsertSummary, UpsertProgress } from "@/types/itemMasterUpsert";
import { CategoryResolver } from "@/utils/categoryResolver";
import { ItemMasterProcessor } from "@/utils/itemMasterProcessor";
import { ValidationDiagnostics } from "./ValidationDiagnostics";
import * as XLSX from "xlsx";

export function ItemMasterUpsert() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedRecord[]>([]);
  const [summary, setSummary] = useState<UpsertSummary | null>(null);
  const [progress, setProgress] = useState<UpsertProgress>({ current: 0, total: 0, stage: 'analyzing' });
  const [validationResults, setValidationResults] = useState<{ valid: any[], invalid: any[] } | null>(null);
  const [rawCsvData, setRawCsvData] = useState<CsvItemData[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const parseCSVFile = async (file: File): Promise<CsvItemData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData as CsvItemData[]);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const analyzeData = async (csvData: CsvItemData[]) => {
    try {
      setIsProcessing(true);
      setProgress({ current: 0, total: csvData.length, stage: 'analyzing' });
      setRawCsvData(csvData);
      setShowDiagnostics(true);
      
      // Basic validation first
      const { valid, invalid } = validateBulkUploadData(csvData);
      setValidationResults({ valid, invalid });
      
      console.log(`Initial validation: ${valid.length} valid, ${invalid.length} invalid out of ${csvData.length} total`);
      
      if (invalid.length > 0) {
        toast({
          title: "Validation Issues Found",
          description: `${invalid.length} rows have validation errors. Use Validation Diagnostics for detailed analysis.`,
          variant: "destructive"
        });
      }

      // Initialize category resolver
      const categoryResolver = new CategoryResolver();
      await categoryResolver.initialize();

      // Check for unmapped categories
      const categoryNames = [...new Set(valid.map(item => item.category_name))];
      const unmappedCategories = categoryResolver.getUnmappedCategories(categoryNames);
      
      if (unmappedCategories.length > 0) {
        toast({
          title: "Unknown Categories",
          description: `Categories not found: ${unmappedCategories.join(', ')}. Use Validation Diagnostics for details.`,
          variant: "destructive"
        });
      }

      // Get existing items to determine updates vs inserts
      const existingItemNames = valid.map(item => item.item_name);
      const { data: existingItems } = await supabase
        .from('item_master')
        .select('*')
        .in('item_name', existingItemNames);

      const existingItemMap = new Map(
        existingItems?.map(item => [item.item_name.toLowerCase(), item]) || []
      );

      // Analyze each record
      const analyzed: ParsedRecord[] = valid.map((item, index) => {
        const existingItem = existingItemMap.get(item.item_name.toLowerCase());
        const categoryId = categoryResolver.resolveCategoryId(item.category_name);
        const validationErrors: string[] = [];
        
        if (!categoryId) {
          validationErrors.push(`Category "${item.category_name}" not found`);
        }
        
        return {
          ...item,
          row_number: index + 1,
          action: existingItem ? 'UPDATE' : 'INSERT',
          existing_item: existingItem,
          category_id: categoryId,
          validation_errors: validationErrors,
          can_process: validationErrors.length === 0
        };
      });

      setParsedData(analyzed);
      
      const processableRecords = analyzed.filter(r => r.can_process);
      const summary: UpsertSummary = {
        total: analyzed.length,
        updates: processableRecords.filter(r => r.action === 'UPDATE').length,
        inserts: processableRecords.filter(r => r.action === 'INSERT').length,
        errors: invalid.length,
        processed: 0,
        category_errors: analyzed.filter(r => !r.category_id).length,
        validation_errors: analyzed.filter(r => r.validation_errors && r.validation_errors.length > 0).length
      };
      
      setSummary(summary);
      
      if (invalid.length === 0 && unmappedCategories.length === 0) {
        toast({
          title: "Validation Successful",
          description: `All ${analyzed.length} rows validated successfully. Ready to process ${processableRecords.length} records.`
        });
      }
      
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const executeUpsert = async () => {
    if (!parsedData.length || !summary) return;

    try {
      setIsProcessing(true);
      setProgress({ current: 0, total: parsedData.length, stage: 'processing' });
      
      // Filter only processable records
      const processableRecords = parsedData.filter(r => r.can_process);
      
      if (processableRecords.length === 0) {
        toast({
          title: "No Valid Records",
          description: "No records can be processed due to validation errors.",
          variant: "destructive"
        });
        return;
      }

      // Initialize and run processor
      const processor = new ItemMasterProcessor();
      await processor.initialize();
      
      const result = await processor.processRecords(
        processableRecords,
        (progressUpdate) => setProgress(progressUpdate)
      );
      
      setSummary(prev => prev ? { ...prev, processed: result.success } : null);
      
      if (result.errors.length > 0) {
        console.error('Processing errors:', result.errors);
        toast({
          title: "Partial Success",
          description: `${result.success} records processed successfully. ${result.errors.length} failed.`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Upsert Complete",
          description: `Successfully processed ${result.success} records.`
        });
      }
      
    } catch (error: any) {
      console.error('Upsert error:', error);
      toast({
        title: "Upsert Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = async (files: File[]) => {
    if (files.length === 0) return;
    
    const file = files[0];
    if (!file.name.match(/\.(csv|xlsx)$/i)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV or Excel file.",
        variant: "destructive"
      });
      return;
    }

    try {
      const csvData = await parseCSVFile(file);
      await analyzeData(csvData);
    } catch (error: any) {
      console.error('File parse error:', error);
      toast({
        title: "File Parse Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const resetData = () => {
    setParsedData([]);
    setSummary(null);
    setProgress({ current: 0, total: 0, stage: 'analyzing' });
    setValidationResults(null);
    setRawCsvData([]);
    setShowDiagnostics(false);
  };

  const getProgressPercentage = () => {
    if (progress.total === 0) return 0;
    return (progress.current / progress.total) * 100;
  };

  const handleValidationComplete = (results: { valid: any[], invalid: any[] }) => {
    setValidationResults(results);
    console.log('Validation complete:', results);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Smart Item Master Update/Insert
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!rawCsvData.length ? (
            <div className="space-y-4">
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">Enhanced Validation Support:</p>
                    <ul className="text-sm space-y-1 ml-4">
                      <li>• UOM Variations: BOXES→BOX, NOS→PCS, KG, MTR, SQM, LTR, ROLL</li>
                      <li>• Size MM: Accepts both numbers and text (auto-converted)</li>
                      <li>• Category Mapping: Automatic validation against existing categories</li>
                      <li>• Item Code Generation: Smart generation for new items</li>
                      <li>• Export Limit Fixed: Now exports ALL items (no 1000 row limit)</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
              
              <FileUpload
                onFilesSelected={handleFileSelect}
                accept=".csv,.xlsx"
                disabled={isProcessing}
                className="min-h-[200px]"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Upload Analysis</h3>
                <Button variant="outline" onClick={resetData}>
                  Upload Different File
                </Button>
              </div>

              {/* Show diagnostics if we have raw data */}
              {showDiagnostics && rawCsvData.length > 0 && (
                <ValidationDiagnostics 
                  csvData={rawCsvData} 
                  onValidationComplete={handleValidationComplete}
                />
              )}
              
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Total Records</p>
                          <p className="text-2xl font-bold">{summary.total}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Updates</p>
                          <p className="text-2xl font-bold text-green-600">{summary.updates}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">New Inserts</p>
                          <p className="text-2xl font-bold text-blue-600">{summary.inserts}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Validation Errors</p>
                          <p className="text-2xl font-bold text-red-600">{summary.validation_errors}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Category Errors</p>
                          <p className="text-2xl font-bold text-orange-600">{summary.category_errors}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {progress.stage === 'analyzing' ? 'Analyzing...' : 'Processing...'} {Math.round(getProgressPercentage())}%
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  <Progress value={getProgressPercentage()} className="w-full" />
                  {progress.currentRecord && (
                    <p className="text-xs text-muted-foreground">
                      Processing: {progress.currentRecord.item_name} ({progress.currentRecord.action})
                    </p>
                  )}
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {summary?.updates || 0} Updates
                  </Badge>
                  <Badge variant="outline">
                    {summary?.inserts || 0} New Items
                  </Badge>
                  {(summary?.validation_errors || 0) > 0 && (
                    <Badge variant="destructive">
                      {summary?.validation_errors} Validation Errors
                    </Badge>
                  )}
                  {(summary?.category_errors || 0) > 0 && (
                    <Badge variant="destructive">
                      {summary?.category_errors} Category Errors
                    </Badge>
                  )}
                </div>
                
                <Button 
                  onClick={executeUpsert}
                  disabled={isProcessing || parsedData.length === 0 || (summary && (summary.updates + summary.inserts) === 0)}
                  className="min-w-[120px]"
                >
                  {isProcessing ? "Processing..." : "Execute Upsert"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
