
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  Download, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  FileSpreadsheet,
  Database
} from "lucide-react";
import { useEnhancedCategories, useEnhancedCategoryMutations, EnhancedCategory } from "@/hooks/useEnhancedCategories";
import { toast } from "@/hooks/use-toast";

interface CategoryImportExportProps {
  categories: EnhancedCategory[];
  onRefresh: () => void;
}

type ExportType = 'template' | 'basic' | 'full';
type ExportFormat = 'csv' | 'json';

export function CategoryImportExport({ categories, onRefresh }: CategoryImportExportProps) {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [importResult, setImportResult] = useState<any>(null);
  const [exportType, setExportType] = useState<ExportType>('template');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { createCategory } = useEnhancedCategoryMutations();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      setValidationErrors([]);
    }
  };

  const validateImportData = (data: any[]): string[] => {
    const errors: string[] = [];
    
    data.forEach((row, index) => {
      if (!row.category_name || row.category_name.trim() === '') {
        errors.push(`Row ${index + 1}: Category name is required`);
      }
      
      if (row.category_code && !/^[A-Z0-9_-]+$/.test(row.category_code)) {
        errors.push(`Row ${index + 1}: Category code must contain only uppercase letters, numbers, underscores, and hyphens`);
      }
      
      if (row.category_type && !['STANDARD', 'SYSTEM', 'TEMPORARY'].includes(row.category_type)) {
        errors.push(`Row ${index + 1}: Invalid category type`);
      }
    });
    
    return errors;
  };

  const processImport = async () => {
    if (!importFile) return;

    setImportStatus('processing');
    setImportProgress(0);
    setValidationErrors([]);

    try {
      const text = await importFile.text();
      let data: any[] = [];

      if (importFile.name.endsWith('.csv')) {
        // Simple CSV parsing
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });
          return obj;
        }).filter(row => row.category_name); // Filter out empty rows
      } else if (importFile.name.endsWith('.json')) {
        data = JSON.parse(text);
      } else {
        throw new Error('Unsupported file format. Please use CSV or JSON files.');
      }

      // Validate data
      const errors = validateImportData(data);
      if (errors.length > 0) {
        setValidationErrors(errors);
        setImportStatus('error');
        return;
      }

      // Process import
      let successCount = 0;
      let errorCount = 0;
      const importErrors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i];
          await createCategory.mutateAsync({
            category_name: row.category_name,
            description: row.description || '',
            category_code: row.category_code || '',
            parent_category_id: row.parent_category_id || null,
            category_type: row.category_type || 'STANDARD',
            is_active: row.is_active !== 'false',
            sort_order: parseInt(row.sort_order) || 0,
            business_rules: row.business_rules ? JSON.parse(row.business_rules) : {},
            metadata: row.metadata ? JSON.parse(row.metadata) : {}
          });
          
          successCount++;
        } catch (error: any) {
          errorCount++;
          importErrors.push(`Row ${i + 1}: ${error.message}`);
        }
        
        setImportProgress(((i + 1) / data.length) * 100);
      }

      setImportResult({
        total: data.length,
        success: successCount,
        errors: errorCount,
        errorDetails: importErrors
      });

      setImportStatus('success');
      
      toast({
        title: "Import Completed",
        description: `Successfully imported ${successCount} of ${data.length} categories`,
      });

      onRefresh();
    } catch (error: any) {
      setImportStatus('error');
      setValidationErrors([error.message]);
      
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const generateExportData = () => {
    switch (exportType) {
      case 'template':
        return [{
          category_name: 'Sample Category',
          description: 'Sample description',
          category_code: 'SAMPLE_CODE',
          parent_category_id: '',
          category_type: 'STANDARD',
          is_active: 'true',
          sort_order: '0',
          business_rules: '{}',
          metadata: '{}'
        }];
      
      case 'basic':
        return categories.map(cat => ({
          category_name: cat.category_name,
          description: cat.description || '',
          category_code: cat.category_code || '',
          category_type: cat.category_type,
          is_active: cat.is_active.toString()
        }));
      
      case 'full':
        return categories.map(cat => ({
          id: cat.id,
          category_name: cat.category_name,
          description: cat.description || '',
          category_code: cat.category_code || '',
          parent_category_id: cat.parent_category_id || '',
          category_level: cat.category_level,
          sort_order: cat.sort_order,
          is_active: cat.is_active.toString(),
          category_type: cat.category_type,
          business_rules: JSON.stringify(cat.business_rules),
          metadata: JSON.stringify(cat.metadata),
          total_items: cat.total_items,
          active_items: cat.active_items,
          avg_item_value: cat.avg_item_value,
          created_at: cat.created_at,
          updated_at: cat.updated_at
        }));
      
      default:
        return [];
    }
  };

  const handleExport = () => {
    const data = generateExportData();
    const timestamp = new Date().toISOString().split('T')[0];
    
    if (exportFormat === 'csv') {
      const headers = Object.keys(data[0]).join(',');
      const csv = [headers, ...data.map(row => Object.values(row).join(','))].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `categories_${exportType}_${timestamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `categories_${exportType}_${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    
    toast({
      title: "Export Successful",
      description: `Exported ${data.length} categories as ${exportFormat.toUpperCase()}`,
    });
  };

  const resetImport = () => {
    setImportFile(null);
    setImportProgress(0);
    setImportStatus('idle');
    setImportResult(null);
    setValidationErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Category Import/Export
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Select File</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                  disabled={importStatus === 'processing'}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Supported formats: CSV, JSON
                </p>
              </div>

              {importFile && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm">{importFile.name}</span>
                  <Badge variant="secondary">{(importFile.size / 1024).toFixed(1)} KB</Badge>
                </div>
              )}

              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-semibold">Validation Errors:</p>
                      {validationErrors.map((error, index) => (
                        <p key={index} className="text-sm">{error}</p>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {importStatus === 'processing' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Processing import...</span>
                  </div>
                  <Progress value={importProgress} className="h-2" />
                </div>
              )}

              {importStatus === 'success' && importResult && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-semibold">Import Completed</p>
                      <p className="text-sm">
                        Total: {importResult.total} | 
                        Success: {importResult.success} | 
                        Errors: {importResult.errors}
                      </p>
                      {importResult.errorDetails && importResult.errorDetails.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm font-medium">
                            View Error Details
                          </summary>
                          <div className="mt-2 space-y-1">
                            {importResult.errorDetails.map((error: string, index: number) => (
                              <p key={index} className="text-xs text-destructive">{error}</p>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={processImport}
                  disabled={!importFile || importStatus === 'processing'}
                  className="flex-1"
                >
                  {importStatus === 'processing' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Categories
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={resetImport}
                  disabled={importStatus === 'processing'}
                >
                  Reset
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="export" className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="export-type">Export Type</Label>
                  <Select 
                    value={exportType} 
                    onValueChange={(value: string) => setExportType(value as ExportType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select export type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="template">Template (Sample)</SelectItem>
                      <SelectItem value="basic">Basic Categories</SelectItem>
                      <SelectItem value="full">Full Export</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="export-format">Format</Label>
                  <Select 
                    value={exportFormat} 
                    onValueChange={(value: string) => setExportFormat(value as ExportFormat)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Export Details:</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>• Type: {exportType === 'template' ? 'Sample template' : exportType === 'basic' ? 'Basic category data' : 'Complete category data with statistics'}</p>
                  <p>• Format: {exportFormat.toUpperCase()}</p>
                  <p>• Records: {exportType === 'template' ? '1 sample' : `${categories.length} categories`}</p>
                </div>
              </div>

              <Button onClick={handleExport} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Export Categories
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
