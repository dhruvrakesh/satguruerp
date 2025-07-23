import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useEnhancedCategoryMutations, type EnhancedCategory } from "@/hooks/useEnhancedCategories";
import { 
  Upload, Download, FileText, AlertCircle, 
  CheckCircle, XCircle, Loader2 
} from "lucide-react";
import Papa from 'papaparse';

interface CategoryImportExportProps {
  categories: EnhancedCategory[];
  onRefresh: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string; data?: any }>;
}

export function CategoryImportExport({ categories, onRefresh }: CategoryImportExportProps) {
  const { createCategory } = useEnhancedCategoryMutations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const generateTemplate = () => {
    const template = [
      {
        category_name: 'Sample Category',
        description: 'Sample category description',
        category_code: 'SAMPLE',
        category_type: 'STANDARD',
        sort_order: 1,
        is_active: true
      }
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `category_template_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportCategories = async () => {
    if (!categories || categories.length === 0) return;

    setIsExporting(true);
    
    try {
      const exportData = categories.map(category => ({
        category_name: category.category_name,
        description: category.description || '',
        category_code: category.category_code || '',
        category_type: category.category_type,
        sort_order: category.sort_order,
        is_active: category.is_active,
        total_items: category.total_items,
        avg_item_value: category.avg_item_value,
        created_at: category.created_at,
        updated_at: category.updated_at
      }));

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `categories_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const validateCategoryData = (data: any[], rowIndex: number): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const row = data[rowIndex];

    if (!row.category_name || row.category_name.trim() === '') {
      errors.push('Category name is required');
    }

    if (row.category_name && row.category_name.length > 100) {
      errors.push('Category name must be less than 100 characters');
    }

    if (row.category_code && row.category_code.length > 20) {
      errors.push('Category code must be less than 20 characters');
    }

    if (row.category_type && !['STANDARD', 'SYSTEM', 'TEMPORARY'].includes(row.category_type)) {
      errors.push('Category type must be STANDARD, SYSTEM, or TEMPORARY');
    }

    if (row.sort_order && (isNaN(row.sort_order) || row.sort_order < 0)) {
      errors.push('Sort order must be a non-negative number');
    }

    if (row.is_active && !['true', 'false', true, false].includes(row.is_active)) {
      errors.push('is_active must be true or false');
    }

    return { valid: errors.length === 0, errors };
  };

  const importCategories = async (file: File) => {
    setIsImporting(true);
    setImportProgress(0);
    setImportResult(null);

    try {
      const results = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: resolve,
          error: reject
        });
      });

      const data = results.data;
      const total = data.length;
      let success = 0;
      let failed = 0;
      const errors: ImportResult['errors'] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const validation = validateCategoryData(data, i);

        if (!validation.valid) {
          failed++;
          errors.push({
            row: i + 2, // +2 because CSV has header and is 1-indexed
            message: validation.errors.join(', '),
            data: row
          });
          setImportProgress(((i + 1) / total) * 100);
          continue;
        }

        try {
          await createCategory.mutateAsync({
            category_name: row.category_name.trim(),
            description: row.description || null,
            category_code: row.category_code || null,
            category_type: row.category_type || 'STANDARD',
            sort_order: parseInt(row.sort_order) || 0,
            is_active: row.is_active === 'true' || row.is_active === true,
            business_rules: {},
            metadata: {}
          });
          success++;
        } catch (error: any) {
          failed++;
          errors.push({
            row: i + 2,
            message: error.message || 'Failed to create category',
            data: row
          });
        }

        setImportProgress(((i + 1) / total) * 100);
      }

      setImportResult({ success, failed, errors });
      if (success > 0) {
        onRefresh();
      }
    } catch (error) {
      console.error('Import failed:', error);
      setImportResult({
        success: 0,
        failed: 1,
        errors: [{ row: 0, message: 'Failed to parse CSV file' }]
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      importCategories(file);
    } else {
      alert('Please select a valid CSV file');
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Button
              variant="outline"
              onClick={generateTemplate}
              className="w-full"
            >
              <FileText className="w-4 h-4 mr-2" />
              Download Template
            </Button>
            
            <div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                ref={fileInputRef}
                className="hidden"
                id="csv-upload"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Select CSV File
                  </>
                )}
              </Button>
            </div>
          </div>

          {isImporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Import Progress</span>
                <span>{Math.round(importProgress)}%</span>
              </div>
              <Progress value={importProgress} className="w-full" />
            </div>
          )}

          {importResult && (
            <Alert variant={importResult.failed > 0 ? "destructive" : "default"}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex gap-4">
                    {importResult.success > 0 && (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {importResult.success} Success
                      </Badge>
                    )}
                    {importResult.failed > 0 && (
                      <Badge variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" />
                        {importResult.failed} Failed
                      </Badge>
                    )}
                  </div>

                  {importResult.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        View Import Errors ({importResult.errors.length})
                      </summary>
                      <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                        {importResult.errors.slice(0, 10).map((error, index) => (
                          <p key={index} className="text-xs">
                            Row {error.row}: {error.message}
                          </p>
                        ))}
                        {importResult.errors.length > 10 && (
                          <p className="text-xs text-muted-foreground">
                            ... and {importResult.errors.length - 10} more errors
                          </p>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Export All Categories</h4>
              <p className="text-sm text-muted-foreground">
                Download complete category data including stats and metrics
              </p>
            </div>
            <Button
              onClick={exportCategories}
              disabled={isExporting || !categories || categories.length === 0}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV ({categories?.length || 0})
                </>
              )}
            </Button>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Export includes:</strong> Category details, item counts, 
              average values, and timestamps. Use this for backup or analysis purposes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}