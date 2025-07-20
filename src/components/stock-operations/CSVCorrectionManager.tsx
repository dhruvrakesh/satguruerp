
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { 
  Download, 
  FileText, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Upload
} from "lucide-react";

interface CorrectionRecord {
  rowIndex: number;
  originalData: any;
  correctedData?: any;
  errors: string[];
  suggestions: string[];
  included: boolean;
  correctionType: 'error' | 'correction' | 'stock-adjustment' | 'retry-ready';
}

interface CSVCorrectionManagerProps {
  records: any[];
  errorRecords: any[];
  correctedRecords: any[];
  onDownload: (mode: string, data: any[]) => void;
  onReupload: (data: any[]) => void;
}

export function CSVCorrectionManager({
  records,
  errorRecords,
  correctedRecords,
  onDownload,
  onReupload
}: CSVCorrectionManagerProps) {
  const [selectedMode, setSelectedMode] = useState<'errors' | 'corrections' | 'stock-adjusted' | 'retry-ready'>('errors');
  const [correctionRecords, setCorrectionRecords] = useState<CorrectionRecord[]>([]);
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [includeSuggestions, setIncludeSuggestions] = useState(true);
  const [autoCorrectEnabled, setAutoCorrectEnabled] = useState(false);

  // Initialize correction records
  useState(() => {
    const allRecords: CorrectionRecord[] = [];
    
    // Add error records
    errorRecords.forEach((record, index) => {
      allRecords.push({
        rowIndex: index,
        originalData: record,
        errors: record.errors || [],
        suggestions: generateSuggestions(record),
        included: true,
        correctionType: 'error'
      });
    });
    
    // Add corrected records
    correctedRecords.forEach((record, index) => {
      allRecords.push({
        rowIndex: index,
        originalData: record.original,
        correctedData: record.corrected,
        errors: [],
        suggestions: [],
        included: true,
        correctionType: 'correction'
      });
    });
    
    setCorrectionRecords(allRecords);
  }, [errorRecords, correctedRecords]);

  const generateSuggestions = (record: any): string[] => {
    const suggestions: string[] = [];
    
    if (!record.item_code) {
      suggestions.push("Add a valid item code (e.g., RAW_ADH_117)");
    }
    
    if (!record.grn_number || !record.grn_number.match(/^GRN-\d{4}-\d+$/)) {
      suggestions.push("Use GRN format: GRN-YYYY-NNN (e.g., GRN-2025-001)");
    }
    
    if (!record.qty_received || isNaN(Number(record.qty_received))) {
      suggestions.push("Enter a valid numeric quantity");
    } else if (Number(record.qty_received) <= 0) {
      suggestions.push("Quantity must be greater than 0");
    }
    
    if (!record.vendor) {
      suggestions.push("Provide vendor name");
    }
    
    if (!record.date) {
      suggestions.push("Add date in DD-MM-YYYY or YYYY-MM-DD format");
    }
    
    return suggestions;
  };

  const generateErrorCSV = () => {
    const headers = ['Row', 'Item Code', 'GRN Number', 'Quantity', 'Error Details', 'Suggestions', 'Original Data'];
    const rows = correctionRecords
      .filter(r => r.correctionType === 'error' && r.included)
      .map(record => [
        record.rowIndex + 2,
        record.originalData.item_code || '',
        record.originalData.grn_number || '',
        record.originalData.qty_received || '',
        record.errors.join('; '),
        record.suggestions.join('; '),
        JSON.stringify(record.originalData)
      ]);
    
    return [headers, ...rows];
  };

  const generateCorrectionTemplateCSV = () => {
    const headers = [
      'item_code', 'grn_number', 'qty_received', 'date', 'uom', 'vendor',
      'amount_inr', 'invoice_number', 'remarks', 'correction_notes'
    ];
    
    const rows = correctionRecords
      .filter(r => r.included)
      .map(record => {
        const data = record.correctedData || record.originalData;
        return [
          data.item_code || '',
          data.grn_number || '',
          data.qty_received || '',
          data.date || new Date().toISOString().split('T')[0],
          data.uom || 'KG',
          data.vendor || '',
          data.amount_inr || '',
          data.invoice_number || '',
          data.remarks || 'Corrected via CSV manager',
          record.suggestions.join('; ')
        ];
      });
    
    return [headers, ...rows];
  };

  const generateRetryReadyCSV = () => {
    const headers = ['item_code', 'grn_number', 'qty_received', 'date', 'uom', 'vendor', 'amount_inr', 'invoice_number', 'remarks'];
    
    // Include valid records + corrected records
    const validRecords = records.filter(r => !errorRecords.some(er => er.rowIndex === r.rowIndex));
    const readyRecords = [
      ...validRecords,
      ...correctionRecords
        .filter(r => r.correctionType === 'correction' && r.included)
        .map(r => r.correctedData)
    ];
    
    const rows = readyRecords.map(record => [
      record.item_code,
      record.grn_number,
      record.qty_received,
      record.date,
      record.uom || 'KG',
      record.vendor,
      record.amount_inr || '',
      record.invoice_number || '',
      record.remarks || 'Retry upload'
    ]);
    
    return [headers, ...rows];
  };

  const downloadCSV = (mode: string) => {
    let csvData: any[][] = [];
    let filename = '';
    
    switch (mode) {
      case 'errors':
        csvData = generateErrorCSV();
        filename = `grn_errors_${new Date().toISOString().split('T')[0]}.csv`;
        break;
      case 'corrections':
        csvData = generateCorrectionTemplateCSV();
        filename = `grn_correction_template_${new Date().toISOString().split('T')[0]}.csv`;
        break;
      case 'retry-ready':
        csvData = generateRetryReadyCSV();
        filename = `grn_retry_ready_${new Date().toISOString().split('T')[0]}.csv`;
        break;
      default:
        return;
    }
    
    const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    
    onDownload(mode, csvData);
    
    toast({
      title: "Download Complete",
      description: `${filename} has been downloaded successfully.`
    });
  };

  const handleReupload = () => {
    const retryData = generateRetryReadyCSV().slice(1); // Remove headers
    onReupload(retryData);
  };

  const toggleRecordIncluded = (index: number) => {
    setCorrectionRecords(prev => 
      prev.map((record, i) => 
        i === index ? { ...record, included: !record.included } : record
      )
    );
  };

  const getDownloadCount = (mode: string) => {
    switch (mode) {
      case 'errors':
        return correctionRecords.filter(r => r.correctionType === 'error' && r.included).length;
      case 'corrections':
        return correctionRecords.filter(r => r.included).length;
      case 'retry-ready':
        return records.length - errorRecords.length + correctionRecords.filter(r => r.correctionType === 'correction' && r.included).length;
      default:
        return 0;
    }
  };

  // Handle checkbox state properly
  const handleCheckboxChange = (checked: boolean | "indeterminate", setter: (value: boolean) => void) => {
    if (checked === "indeterminate") return;
    setter(checked as boolean);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          CSV Correction Manager
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedMode} onValueChange={(value: any) => setSelectedMode(value)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="errors" className="flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Errors ({correctionRecords.filter(r => r.correctionType === 'error').length})
            </TabsTrigger>
            <TabsTrigger value="corrections" className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Corrections ({correctionRecords.filter(r => r.correctionType === 'correction').length})
            </TabsTrigger>
            <TabsTrigger value="stock-adjusted" className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              Stock Adjusted (0)
            </TabsTrigger>
            <TabsTrigger value="retry-ready" className="flex items-center gap-1">
              <RefreshCw className="w-4 h-4" />
              Retry Ready ({getDownloadCount('retry-ready')})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="errors" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Download error details with suggestions for manual correction. 
                These records failed validation and need attention before reupload.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              {correctionRecords
                .filter(r => r.correctionType === 'error')
                .map((record, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={record.included}
                      onCheckedChange={(checked) => toggleRecordIncluded(index)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">Row {record.rowIndex + 2}</div>
                      <div className="text-sm text-red-600">
                        {record.errors.join(', ')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {record.suggestions.slice(0, 2).join(', ')}
                      </div>
                    </div>
                    <Badge variant="destructive">Error</Badge>
                  </div>
                ))
              }
            </div>
            
            <Button 
              onClick={() => downloadCSV('errors')}
              className="w-full"
              disabled={getDownloadCount('errors') === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Error Report ({getDownloadCount('errors')} records)
            </Button>
          </TabsContent>
          
          <TabsContent value="corrections" className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Download a correction template with your fixes applied. 
                Review and modify as needed before reupload.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-suggestions"
                  checked={includeSuggestions}
                  onCheckedChange={(checked) => handleCheckboxChange(checked, setIncludeSuggestions)}
                />
                <label htmlFor="include-suggestions" className="text-sm">
                  Include correction suggestions in CSV
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto-correct"
                  checked={autoCorrectEnabled}
                  onCheckedChange={(checked) => handleCheckboxChange(checked, setAutoCorrectEnabled)}
                />
                <label htmlFor="auto-correct" className="text-sm">
                  Apply automatic corrections where possible
                </label>
              </div>
            </div>
            
            <Button 
              onClick={() => downloadCSV('corrections')}
              className="w-full"
              disabled={getDownloadCount('corrections') === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Correction Template ({getDownloadCount('corrections')} records)
            </Button>
          </TabsContent>
          
          <TabsContent value="stock-adjusted" className="space-y-4">
            <Alert>
              <TrendingUp className="h-4 w-4" />
              <AlertDescription>
                Stock-adjusted records will be available here when stock level corrections are applied.
                This feature helps balance quantities with available inventory.
              </AlertDescription>
            </Alert>
            
            <Button disabled className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Stock Adjustment Feature Coming Soon
            </Button>
          </TabsContent>
          
          <TabsContent value="retry-ready" className="space-y-4">
            <Alert>
              <RefreshCw className="h-4 w-4" />
              <AlertDescription>
                Clean, validated records ready for immediate reupload. 
                This includes all valid records plus your corrections.
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => downloadCSV('retry-ready')}
                className="flex-1"
                disabled={getDownloadCount('retry-ready') === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Retry CSV ({getDownloadCount('retry-ready')} records)
              </Button>
              
              <Button 
                onClick={handleReupload}
                variant="outline"
                disabled={getDownloadCount('retry-ready') === 0}
              >
                <Upload className="w-4 h-4 mr-2" />
                Direct Reupload
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
