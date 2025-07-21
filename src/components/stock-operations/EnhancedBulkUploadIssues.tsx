
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle, Info, TrendingDown, Activity, Calendar, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useEnhancedIssueUpload } from "@/hooks/useEnhancedIssueUpload";
import { IssueUploadDebugger } from "./IssueUploadDebugger";
import Papa from "papaparse";

interface EnhancedBulkUploadIssuesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnhancedBulkUploadIssues({ open, onOpenChange }: EnhancedBulkUploadIssuesProps) {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [showDebugger, setShowDebugger] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadWithDuplicateHandling, isProcessing, uploadProgress } = useEnhancedIssueUpload();

  const downloadTemplate = () => {
    const csvContent = `item_code,qty_issued,date,purpose,remarks
LDPELAM_NP_775_50,100,15-05-2025,Production Order PO-001,For lamination process
BOPP-FILM-20-20,50,16-05-2025,Quality Testing,Sample testing
PE-WRAP-80,25,17-05-2025,Production Order PO-002,Wrapper material`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'issue_upload_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "CSV template with date format examples has been downloaded successfully.",
    });
  };

  const resetUploadState = () => {
    console.log('🔄 Resetting upload state...');
    setResult(null);
    setCsvData([]);
    setShowDebugger(false);
    setActiveTab("upload");
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    resetUploadState();

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please select a CSV file",
        variant: "destructive"
      });
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 50MB",
        variant: "destructive"
      });
      return;
    }

    setFile(selectedFile);
    
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log('📊 CSV parsed for preview:', results.data.length, 'records');
        setCsvData(results.data);
        toast({
          title: "File Ready",
          description: `${selectedFile.name} loaded with ${results.data.length} records. Date formats will be automatically parsed.`,
        });
      },
      error: (error) => {
        console.error('❌ CSV parse error:', error);
        toast({
          title: "Parse Error",
          description: "Failed to parse CSV file. Please check the format.",
          variant: "destructive"
        });
      }
    });
  };

  const handleProcessUpload = async () => {
    if (!csvData.length) {
      toast({
        title: "No Data",
        description: "Please select a valid CSV file first",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🚀 Starting enhanced upload process with date format handling...');
      
      const uploadResult = await uploadWithDuplicateHandling(csvData, {
        skipDuplicates: true,
        showDuplicateWarning: false
      });

      console.log('✅ Upload completed:', uploadResult);
      setResult(uploadResult);
      
      if (uploadResult.success && uploadResult.successful_inserts > 0) {
        setActiveTab("results");
      } else if (uploadResult.date_format_errors && uploadResult.date_format_errors > 0) {
        toast({
          title: "Date Format Issues Detected",
          description: `${uploadResult.date_format_errors} records have date format issues. Check the results tab for details.`,
          variant: "destructive"
        });
        setActiveTab("results");
      } else if (uploadResult.success && uploadResult.duplicates_skipped > 0 && uploadResult.successful_inserts === 0) {
        setActiveTab("results");
      } else if (uploadResult.errors && uploadResult.errors.length > 0) {
        setActiveTab("results");
      } else {
        setActiveTab("results");
      }

    } catch (error: any) {
      console.error('💥 Upload process failed:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
      setResult({
        success: false,
        total_processed: 0,
        successful_inserts: 0,
        duplicates_skipped: 0,
        validation_errors: 0,
        duplicates: [],
        errors: [{ row: 0, message: error.message }],
        date_format_errors: 0
      });
      setActiveTab("results");
    }
  };

  const handleShowDebugger = () => {
    if (csvData.length > 0) {
      setShowDebugger(true);
      setActiveTab("debugger");
    } else {
      toast({
        title: "No Data to Debug",
        description: "Please select and load a CSV file first",
        variant: "destructive"
      });
    }
  };

  const handleRecordCorrection = (rowIndex: number, correctedData: any) => {
    console.log('🔧 Record correction applied:', rowIndex, correctedData);
  };

  const handleBatchReprocess = (correctedRecords: any[]) => {
    console.log('🔄 Batch reprocessing:', correctedRecords.length, 'records');
  };

  const handleDownloadCorrectedCSV = (mode: 'errors' | 'corrections' | 'retry-ready') => {
    console.log('📥 Downloading corrected CSV:', mode);
    toast({
      title: "Feature Coming Soon",
      description: `CSV download for ${mode} will be available in the next update`,
    });
  };

  const handleDialogClose = () => {
    resetUploadState();
    setFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5" />
            Enhanced Bulk Upload - Stock Issues (Date Format Fixed)
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="debugger" disabled={!csvData.length}>
              Debug Console {csvData.length > 0 && `(${csvData.length})`}
            </TabsTrigger>
            <TabsTrigger value="results" disabled={!result}>
              Results {result && `(${result.total_processed || 0})`}
            </TabsTrigger>
            <TabsTrigger value="help">Help</TabsTrigger>
          </TabsList>

          <div className="overflow-y-auto max-h-[calc(95vh-8rem)]">
            <TabsContent value="upload" className="space-y-6 mt-6">
              {/* Template Download */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5" />
                    Step 1: Download Template
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-3 mb-4">
                    <Calendar className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Download the CSV template with date format examples. Now supports multiple date formats:
                      </p>
                      <ul className="text-xs text-muted-foreground ml-4 space-y-1">
                        <li>• DD-MM-YYYY (15-05-2025)</li>
                        <li>• MM-DD-YYYY (05-15-2025)</li>
                        <li>• YYYY-MM-DD (2025-05-15)</li>
                        <li>• DD/MM/YYYY (15/05/2025)</li>
                      </ul>
                    </div>
                  </div>
                  <Button variant="outline" onClick={downloadTemplate}>
                    <Download className="w-4 h-4 mr-2" />
                    Download CSV Template
                  </Button>
                </CardContent>
              </Card>

              {/* File Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Step 2: Upload Your CSV File
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv,application/csv"
                    onChange={handleFileSelect}
                    disabled={isProcessing}
                  />

                  {file && csvData.length > 0 && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex items-center justify-between">
                          <div>
                            <p><strong>File:</strong> {file.name}</p>
                            <p><strong>Records:</strong> {csvData.length}</p>
                            <p><strong>Size:</strong> {(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Date Format Ready
                          </Badge>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {isProcessing && (
                    <div className="space-y-2">
                      <Progress value={uploadProgress} />
                      <p className="text-sm text-muted-foreground">
                        Processing upload with date format handling... {Math.round(uploadProgress)}%
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleProcessUpload}
                      disabled={!csvData.length || isProcessing}
                      className="flex-1"
                    >
                      {isProcessing ? (
                        <>
                          <Activity className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Process Upload
                        </>
                      )}
                    </Button>
                    
                    <Button 
                      variant="outline"
                      onClick={handleShowDebugger}
                      disabled={!csvData.length || isProcessing}
                    >
                      Debug Console
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="debugger" className="mt-6">
              {csvData.length > 0 ? (
                <IssueUploadDebugger
                  csvData={csvData}
                  onRecordCorrection={handleRecordCorrection}
                  onBatchReprocess={handleBatchReprocess}
                  onDownloadCorrectedCSV={handleDownloadCorrectedCSV}
                  isProcessing={isProcessing}
                />
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">Please upload a CSV file to access the debug console.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="results" className="space-y-6 mt-6">
              {result ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                      Upload Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{result.total_processed}</div>
                        <div className="text-sm text-blue-700">Total Processed</div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{result.successful_inserts}</div>
                        <div className="text-sm text-green-700">Successful</div>
                      </div>
                      <div className="p-4 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{result.duplicates_skipped}</div>
                        <div className="text-sm text-yellow-700">Duplicates Skipped</div>
                      </div>
                      <div className="p-4 bg-orange-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">{result.date_format_errors || 0}</div>
                        <div className="text-sm text-orange-700">Date Format Errors</div>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{result.errors?.length || 0}</div>
                        <div className="text-sm text-red-700">Other Errors</div>
                      </div>
                    </div>

                    {result.date_format_errors > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription>
                          <strong>Date Format Issues:</strong> {result.date_format_errors} records have date format problems. 
                          Supported formats: DD-MM-YYYY, MM-DD-YYYY, YYYY-MM-DD, DD/MM/YYYY
                        </AlertDescription>
                      </Alert>
                    )}

                    {result.errors && result.errors.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Error Details</h4>
                        <div className="max-h-40 overflow-y-auto space-y-2">
                          {result.errors.map((error: any, index: number) => (
                            <Alert key={index} variant="destructive">
                              <AlertCircle className="w-4 h-4" />
                              <AlertDescription>
                                <strong>Row {error.row}:</strong> {error.message}
                              </AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-4 border-t">
                      <Button onClick={resetUploadState} variant="outline">
                        Upload Another File
                      </Button>
                      <Button onClick={handleDialogClose}>
                        Close
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No upload results to display yet.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="help" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Enhanced Upload Features</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Date Format Handling
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Automatic detection of DD-MM-YYYY format</li>
                        <li>• Support for MM-DD-YYYY and YYYY-MM-DD</li>
                        <li>• Date validation and error reporting</li>
                        <li>• Graceful handling of invalid dates</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Smart Validation</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Real-time stock availability checking</li>
                        <li>• Automatic duplicate detection</li>
                        <li>• Data format validation</li>
                        <li>• Item code verification</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Required CSV Columns</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p><strong>item_code</strong> - Product identifier</p>
                        <p><strong>qty_issued</strong> - Quantity to issue</p>
                      </div>
                      <div>
                        <p><strong>date</strong> - Issue date (multiple formats supported)</p>
                        <p><strong>purpose</strong> - Reason for issue</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
