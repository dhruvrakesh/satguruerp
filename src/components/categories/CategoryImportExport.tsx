
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Upload, 
  Download, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  File,
  X
} from "lucide-react";
import { useEnhancedCategories, useEnhancedCategoryMutations } from "@/hooks/useEnhancedCategories";
import { toast } from "@/hooks/use-toast";

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    category: string;
    error: string;
  }>;
}

export function CategoryImportExport() {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportType, setExportType] = useState<'full' | 'basic' | 'template'>('full');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: categories = [] } = useEnhancedCategories();
  const { createCategory } = useEnhancedCategoryMutations();

  const csvTemplate = [
    'category_name,category_code,description,category_type,parent_category_name,is_active,sort_order',
    'Electronics,ELEC,Electronic items and components,STANDARD,,true,1',
    'Components,COMP,Electronic components,STANDARD,Electronics,true,2',
    'Packaging,PACK,Packaging materials,STANDARD,,true,3'
  ].join('\n');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setImportResult(null);
      setImportStatus('idle');
    }
  };

  const processCSVImport = async (csvContent: string) => {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const dataLines = lines.slice(1);

    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    const categoryMap = new Map(categories.map(cat => [cat.category_name.toLowerCase(), cat.id]));

    for (let i = 0; i < dataLines.length; i++) {
      const values = dataLines[i].split(',').map(v => v.trim());
      const rowData: Record<string, any> = {};
      
      headers.forEach((header, index) => {
        rowData[header] = values[index] || '';
      });

      try {
        // Validate required fields
        if (!rowData.category_name) {
          throw new Error('Category name is required');
        }

        // Find parent category ID if specified
        let parent_category_id = null;
        if (rowData.parent_category_name) {
          parent_category_id = categoryMap.get(rowData.parent_category_name.toLowerCase());
          if (!parent_category_id) {
            throw new Error(`Parent category '${rowData.parent_category_name}' not found`);
          }
        }

        // Create category
        await createCategory.mutateAsync({
          category_name: rowData.category_name,
          category_code: rowData.category_code || undefined,
          description: rowData.description || undefined,
          category_type: rowData.category_type || 'STANDARD',
          parent_category_id,
          is_active: rowData.is_active !== 'false',
          sort_order: parseInt(rowData.sort_order) || 0
        });

        result.success++;
        setImportProgress(((i + 1) / dataLines.length) * 100);
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: i + 2, // +2 because we skip header and are 1-indexed
          category: rowData.category_name || 'Unknown',
          error: error.message
        });
      }
    }

    return result;
  };

  const handleImport = async () => {
    if (!uploadFile) return;

    setImportStatus('uploading');
    setImportProgress(0);

    try {
      const content = await uploadFile.text();
      setImportStatus('processing');
      
      const result = await processCSVImport(content);
      
      setImportResult(result);
      setImportStatus('success');
      
      toast({
        title: "Import Completed",
        description: `Successfully imported ${result.success} categories, ${result.failed} failed`,
        variant: result.failed > 0 ? "destructive" : "default"
      });
    } catch (error: any) {
      setImportStatus('error');
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleExport = () => {
    let exportData: any[] = [];

    if (exportType === 'template') {
      // Download template
      const blob = new Blob([csvTemplate], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'category_import_template.csv';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (exportType === 'basic') {
      exportData = categories.map(cat => ({
        category_name: cat.category_name,
        category_code: cat.category_code,
        description: cat.description,
        category_type: cat.category_type,
        is_active: cat.is_active,
        total_items: cat.total_items
      }));
    } else {
      exportData = categories.map(cat => ({
        category_name: cat.category_name,
        category_code: cat.category_code,
        description: cat.description,
        category_type: cat.category_type,
        is_active: cat.is_active,
        category_level: cat.category_level,
        sort_order: cat.sort_order,
        total_items: cat.total_items,
        active_items: cat.active_items,
        fg_items: cat.fg_items,
        rm_items: cat.rm_items,
        packaging_items: cat.packaging_items,
        consumable_items: cat.consumable_items,
        avg_item_value: cat.avg_item_value,
        total_value: cat.avg_item_value * cat.total_items,
        created_at: cat.created_at,
        updated_at: cat.updated_at
      }));
    }

    const filename = `categories_export_${exportType}_${new Date().toISOString().split('T')[0]}`;

    if (exportFormat === 'csv') {
      const csv = [
        Object.keys(exportData[0]).join(','),
        ...exportData.map(row => Object.values(row).map(val => 
          typeof val === 'string' && val.includes(',') ? `"${val}"` : val
        ).join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    toast({
      title: "Export Successful",
      description: `Exported ${exportData.length} categories`,
    });
  };

  const clearUpload = () => {
    setUploadFile(null);
    setImportResult(null);
    setImportStatus('idle');
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="export" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="export">Export Categories</TabsTrigger>
          <TabsTrigger value="import">Import Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="export_type">Export Type</Label>
                  <Select value={exportType} onValueChange={setExportType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="template">Import Template</SelectItem>
                      <SelectItem value="basic">Basic Export</SelectItem>
                      <SelectItem value="full">Full Export</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="export_format">Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleExport} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Export {exportType === 'template' ? 'Template' : `${categories.length} Categories`}
              </Button>

              {exportType === 'template' && (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    This will download a template CSV file with sample data that you can use for importing categories.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Import Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="file_upload">Upload CSV File</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="mt-1"
                />
                {uploadFile && (
                  <div className="flex items-center gap-2 mt-2">
                    <File className="w-4 h-4" />
                    <span className="text-sm">{uploadFile.name}</span>
                    <Button variant="ghost" size="sm" onClick={clearUpload}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  CSV should have columns: category_name, category_code, description, category_type, parent_category_name, is_active, sort_order
                </AlertDescription>
              </Alert>

              {importStatus === 'processing' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Processing import...</span>
                  </div>
                  <Progress value={importProgress} className="h-2" />
                </div>
              )}

              {importResult && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Success: {importResult.success}
                    </Badge>
                    {importResult.failed > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Failed: {importResult.failed}
                      </Badge>
                    )}
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="max-h-40 overflow-y-auto">
                      <Label>Import Errors:</Label>
                      {importResult.errors.map((error, index) => (
                        <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded mt-1">
                          Row {error.row}: {error.category} - {error.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button 
                onClick={handleImport} 
                disabled={!uploadFile || importStatus === 'processing'}
                className="w-full"
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
