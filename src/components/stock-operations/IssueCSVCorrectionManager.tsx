
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Download, 
  FileText, 
  AlertCircle, 
  CheckCircle,
  Upload
} from "lucide-react";

interface IssueCSVCorrectionManagerProps {
  records: any[];
  errorRecords: any[];
  correctedRecords: any[];
  onDownload: (mode: 'errors' | 'corrections' | 'retry-ready') => void;
  onReupload: () => void;
}

export function IssueCSVCorrectionManager({
  records,
  errorRecords,
  correctedRecords,
  onDownload,
  onReupload
}: IssueCSVCorrectionManagerProps) {
  const [downloadMode, setDownloadMode] = useState<'errors' | 'corrections' | 'retry-ready'>('retry-ready');

  const handleDownload = (mode: 'errors' | 'corrections' | 'retry-ready') => {
    console.log(`📥 Downloading Issue CSV in ${mode} mode...`);
    
    let csvData: any[] = [];
    let filename = '';
    
    switch (mode) {
      case 'errors':
        csvData = errorRecords;
        filename = 'issue_upload_errors.csv';
        break;
      case 'corrections':
        csvData = correctedRecords;
        filename = 'issue_upload_corrections.csv';
        break;
      case 'retry-ready':
        // Generate retry-ready CSV with all valid records
        csvData = records.filter(record => !errorRecords.some(err => err.rowIndex === record.rowIndex));
        filename = 'issue_upload_retry_ready.csv';
        break;
    }
    
    // Issue-specific CSV headers
    const headers = ['item_code', 'qty_issued', 'date', 'purpose', 'remarks'];
    
    // Convert to Issue CSV format
    const csvRows = csvData.map(record => [
      record.item_code || '',
      record.qty_issued || record.quantity || '',
      record.date || new Date().toISOString().split('T')[0],
      record.purpose || record.issued_to || 'General Issue',
      record.remarks || 'Bulk upload'
    ]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    
    console.log(`✅ Downloaded ${filename} with ${csvRows.length} records`);
  };

  const validRecords = records.filter(record => !errorRecords.some(err => err.rowIndex === record.rowIndex));

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Issue CSV Correction Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{records.length}</div>
            <div className="text-sm text-blue-700">Total Records</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{validRecords.length}</div>
            <div className="text-sm text-green-700">Valid Records</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{errorRecords.length}</div>
            <div className="text-sm text-red-700">Error Records</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{correctedRecords.length}</div>
            <div className="text-sm text-purple-700">Corrected Records</div>
          </div>
        </div>

        {/* Download Options */}
        <div className="space-y-4">
          <h4 className="font-medium">Download Options</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => handleDownload('errors')}
              disabled={errorRecords.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Errors ({errorRecords.length})
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleDownload('corrections')}
              disabled={correctedRecords.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Corrections ({correctedRecords.length})
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleDownload('retry-ready')}
              disabled={validRecords.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Retry-Ready ({validRecords.length})
            </Button>
          </div>
        </div>

        {/* Error Summary */}
        {errorRecords.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-medium">
                  {errorRecords.length} records have errors and need correction
                </div>
                <ScrollArea className="h-32">
                  <div className="space-y-1">
                    {errorRecords.slice(0, 10).map((error, index) => (
                      <div key={index} className="text-xs p-2 bg-red-50 rounded">
                        <div className="font-medium">Row {error.rowIndex + 1}: {error.item_code}</div>
                        <div className="text-red-600">{error.errors?.join(', ')}</div>
                      </div>
                    ))}
                    {errorRecords.length > 10 && (
                      <div className="text-xs text-muted-foreground">
                        ... and {errorRecords.length - 10} more errors
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Success Summary */}
        {validRecords.length > 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium">
                {validRecords.length} records are ready for processing
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                These records have passed validation and can be uploaded
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={onReupload}
            disabled={validRecords.length === 0}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Reprocess Valid Records ({validRecords.length})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
