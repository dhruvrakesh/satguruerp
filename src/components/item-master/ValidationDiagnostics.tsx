
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Info, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateBulkUploadData, type CsvItemData } from "@/schemas/itemMasterSchema";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ValidationDiagnosticsProps {
  csvData: CsvItemData[];
  onValidationComplete: (results: { valid: any[], invalid: any[] }) => void;
}

export function ValidationDiagnostics({ csvData, onValidationComplete }: ValidationDiagnosticsProps) {
  const [categories, setCategories] = useState<any[]>([]);
  const [validationResults, setValidationResults] = useState<{ valid: any[], invalid: any[] } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, category_name')
        .eq('is_active', true);
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const runValidation = async () => {
    setIsAnalyzing(true);
    
    try {
      // Run the validation
      const results = validateBulkUploadData(csvData);
      
      // Analyze category mismatches
      const csvCategories = [...new Set(csvData.map(item => item.category_name))];
      const existingCategoryNames = categories.map(cat => cat.category_name.toLowerCase());
      const missingCategories = csvCategories.filter(
        csvCat => !existingCategoryNames.includes(csvCat.toLowerCase())
      );

      // Add category validation errors
      if (missingCategories.length > 0) {
        csvData.forEach((row, index) => {
          if (missingCategories.includes(row.category_name)) {
            const existingError = results.invalid.find(err => err.row === index + 1);
            if (existingError) {
              existingError.errors.push(`Category "${row.category_name}" not found in database`);
            } else {
              results.invalid.push({
                row: index + 1,
                errors: [`Category "${row.category_name}" not found in database`]
              });
            }
          }
        });
      }

      setValidationResults(results);
      onValidationComplete(results);
      
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportValidationReport = () => {
    if (!validationResults) return;

    const report = [
      'Validation Report',
      `Generated: ${new Date().toISOString()}`,
      `Total Rows: ${csvData.length}`,
      `Valid Rows: ${validationResults.valid.length}`,
      `Invalid Rows: ${validationResults.invalid.length}`,
      '',
      'Errors by Row:',
      ...validationResults.invalid.map(error => 
        `Row ${error.row}: ${error.errors.join('; ')}`
      )
    ].join('\n');

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `validation_report_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getCategoryAnalysis = () => {
    const csvCategories = [...new Set(csvData.map(item => item.category_name))];
    const existingCategoryNames = categories.map(cat => cat.category_name);
    const missing = csvCategories.filter(
      csvCat => !existingCategoryNames.some(existing => 
        existing.toLowerCase() === csvCat.toLowerCase()
      )
    );
    const matched = csvCategories.filter(
      csvCat => existingCategoryNames.some(existing => 
        existing.toLowerCase() === csvCat.toLowerCase()
      )
    );

    return { missing, matched, total: csvCategories.length };
  };

  const categoryAnalysis = getCategoryAnalysis();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Validation Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Rows</p>
                  <p className="text-2xl font-bold">{csvData.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Categories Matched</p>
                  <p className="text-2xl font-bold text-green-600">{categoryAnalysis.matched.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Missing Categories</p>
                  <p className="text-2xl font-bold text-red-600">{categoryAnalysis.missing.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {categoryAnalysis.missing.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Missing Categories in Database:</p>
                <div className="flex flex-wrap gap-1">
                  {categoryAnalysis.missing.map((cat, index) => (
                    <Badge key={index} variant="destructive">{cat}</Badge>
                  ))}
                </div>
                <p className="text-sm">These categories need to be created in the system before importing.</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={runValidation} 
            disabled={isAnalyzing}
            className="flex-1"
          >
            {isAnalyzing ? "Analyzing..." : "Run Detailed Validation"}
          </Button>
          
          {validationResults && (
            <Button variant="outline" onClick={exportValidationReport}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          )}
        </div>

        {validationResults && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Valid Rows</p>
                      <p className="text-xl font-bold text-green-600">{validationResults.valid.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Invalid Rows</p>
                      <p className="text-xl font-bold text-red-600">{validationResults.invalid.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {validationResults.invalid.length > 0 && (
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full">
                    {showDetails ? 'Hide' : 'Show'} Error Details ({validationResults.invalid.length} errors)
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-4">
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {validationResults.invalid.slice(0, 20).map((error, index) => (
                      <Alert key={index}>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <span className="font-semibold">Row {error.row}:</span> {error.errors.join("; ")}
                        </AlertDescription>
                      </Alert>
                    ))}
                    {validationResults.invalid.length > 20 && (
                      <p className="text-sm text-muted-foreground text-center">
                        ... and {validationResults.invalid.length - 20} more errors. Export full report for details.
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
