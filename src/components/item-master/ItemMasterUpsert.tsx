
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Info, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateBulkUploadData, type CsvItemData } from "@/schemas/itemMasterSchema";
import * as XLSX from "xlsx";

interface ParsedRecord extends CsvItemData {
  row_number: number;
  action: 'INSERT' | 'UPDATE';
  existing_item?: any;
}

interface UpsertSummary {
  total: number;
  updates: number;
  inserts: number;
  errors: number;
  processed: number;
}

export function ItemMasterUpsert() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedRecord[]>([]);
  const [summary, setSummary] = useState<UpsertSummary | null>(null);
  const [progress, setProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);

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
      
      // Validate CSV data
      const { valid, invalid } = validateBulkUploadData(csvData);
      setValidationErrors(invalid);
      
      if (invalid.length > 0) {
        toast({
          title: "Validation Errors",
          description: `${invalid.length} rows have validation errors. Please check the preview.`,
          variant: "destructive"
        });
      }

      // Get all categories for mapping
      const { data: categories } = await supabase
        .from('categories')
        .select('id, category_name');

      const categoryMap = new Map(
        categories?.map(cat => [cat.category_name.toLowerCase(), cat.id]) || []
      );

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
        const categoryId = categoryMap.get(item.category_name.toLowerCase());
        
        return {
          ...item,
          row_number: index + 1,
          action: existingItem ? 'UPDATE' : 'INSERT',
          existing_item: existingItem,
          category_id: categoryId || null
        };
      });

      setParsedData(analyzed);
      
      const summary: UpsertSummary = {
        total: analyzed.length,
        updates: analyzed.filter(r => r.action === 'UPDATE').length,
        inserts: analyzed.filter(r => r.action === 'INSERT').length,
        errors: invalid.length,
        processed: 0
      };
      
      setSummary(summary);
      
    } catch (error: any) {
      toast({
        title: "Analysis Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateItemCode = (item: CsvItemData, categoryName: string): string => {
    const categoryCode = categoryName.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    return `${categoryCode}-${timestamp}`;
  };

  const executeUpsert = async () => {
    if (!parsedData.length || !summary) return;

    try {
      setIsProcessing(true);
      setProgress(0);
      
      let processedCount = 0;
      const batchSize = 10;
      
      for (let i = 0; i < parsedData.length; i += batchSize) {
        const batch = parsedData.slice(i, i + batchSize);
        
        for (const record of batch) {
          try {
            if (record.action === 'UPDATE' && record.existing_item) {
              const updateData = {
                item_name: record.item_name,
                category_id: record.category_id,
                qualifier: record.qualifier,
                gsm: record.gsm,
                size_mm: record.size_mm,
                uom: record.uom,
                usage_type: record.usage_type,
                updated_at: new Date().toISOString()
              };

              await supabase
                .from('item_master')
                .update(updateData)
                .eq('id', record.existing_item.id);
                
            } else if (record.action === 'INSERT') {
              const itemCode = generateItemCode(record, record.category_name);
              
              const insertData = {
                item_code: itemCode,
                item_name: record.item_name,
                category_id: record.category_id,
                qualifier: record.qualifier,
                gsm: record.gsm,
                size_mm: record.size_mm,
                uom: record.uom,
                usage_type: record.usage_type,
                status: 'active',
                created_at: new Date().toISOString()
              };

              await supabase
                .from('item_master')
                .insert(insertData);
            }
            
            processedCount++;
            setProgress((processedCount / parsedData.length) * 100);
            
          } catch (error: any) {
            console.error(`Error processing row ${record.row_number}:`, error);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setSummary(prev => prev ? { ...prev, processed: processedCount } : null);
      
      toast({
        title: "Upsert Complete",
        description: `Successfully processed ${processedCount} out of ${parsedData.length} records.`
      });
      
    } catch (error: any) {
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
    setProgress(0);
    setValidationErrors([]);
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
          {!parsedData.length ? (
            <FileUpload
              onFilesSelected={handleFileSelect}
              accept=".csv,.xlsx"
              disabled={isProcessing}
              className="min-h-[200px]"
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Upload Analysis</h3>
                <Button variant="outline" onClick={resetData}>
                  Upload Different File
                </Button>
              </div>
              
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                          <p className="text-sm text-muted-foreground">Errors</p>
                          <p className="text-2xl font-bold text-red-600">{summary.errors}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {validationErrors.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold">Validation Errors Found:</p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {validationErrors.slice(0, 5).map((error, index) => (
                          <p key={index} className="text-sm">
                            Row {error.row}: {error.errors.join(", ")}
                          </p>
                        ))}
                        {validationErrors.length > 5 && (
                          <p className="text-sm text-muted-foreground">
                            ... and {validationErrors.length - 5} more errors
                          </p>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Processing... {Math.round(progress)}%
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {summary?.processed || 0} / {summary?.total || 0}
                    </span>
                  </div>
                  <Progress value={progress} className="w-full" />
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
                  {validationErrors.length > 0 && (
                    <Badge variant="destructive">
                      {validationErrors.length} Errors
                    </Badge>
                  )}
                </div>
                
                <Button 
                  onClick={executeUpsert}
                  disabled={isProcessing || parsedData.length === 0}
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
