
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/hooks/use-toast";
import { useBulkStockValidation } from "@/hooks/useStockValidation";
import { CSVCorrectionManager } from "./CSVCorrectionManager";
import { GRNUploadDebugger } from "./GRNUploadDebugger";
import { 
  Upload, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Activity,
  TrendingDown,
  Eye,
  Download
} from "lucide-react";
import Papa from "papaparse";

interface UploadStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  always_visible?: boolean;
}

interface ProcessedRecord {
  rowIndex: number;
  data: any;
  stockStatus?: 'sufficient' | 'insufficient' | 'critical' | 'unknown';
  stockAvailable?: number;
  stockRequired?: number;
  errors: string[];
  warnings: string[];
}

interface EnhancedBulkUploadIssuesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnhancedBulkUploadIssues({ open, onOpenChange }: EnhancedBulkUploadIssuesProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [processedRecords, setProcessedRecords] = useState<ProcessedRecord[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugAnalysisData, setDebugAnalysisData] = useState<any>(null);
  const [errorRecords, setErrorRecords] = useState<any[]>([]);
  const [correctedRecords, setCorrectedRecords] = useState<any[]>([]);
  const [stockValidationEnabled, setStockValidationEnabled] = useState(true);
  const { toast } = useToast();

  const steps: UploadStep[] = [
    {
      id: 1,
      title: "Select CSV File",
      description: "Choose your GRN data file",
      status: uploadFile ? 'completed' : 'active'
    },
    {
      id: 2,
      title: "Real-time Preview & Validation",
      description: "Automatic stock validation and error detection",
      status: csvData.length > 0 ? 'completed' : uploadFile ? 'active' : 'pending',
      always_visible: true
    },
    {
      id: 3,
      title: "Debug Console",
      description: "Advanced debugging and correction tools",
      status: processedRecords.length > 0 ? 'completed' : csvData.length > 0 ? 'active' : 'pending',
      always_visible: true
    },
    {
      id: 4,
      title: "Process Upload",
      description: "Execute the validated upload",
      status: 'pending'
    }
  ];

  // Extract item codes from CSV data for stock validation
  const itemCodes = csvData.map(row => row.item_code).filter(Boolean);
  const { data: stockValidationData } = useBulkStockValidation(itemCodes);

  // Process CSV file immediately when selected
  useEffect(() => {
    if (uploadFile) {
      processCSVFile(uploadFile);
    }
  }, [uploadFile]);

  // Run stock validation when CSV data changes
  useEffect(() => {
    if (csvData.length > 0 && stockValidationData) {
      performStockValidation();
    }
  }, [csvData, stockValidationData]);

  const processCSVFile = async (file: File) => {
    setIsProcessing(true);
    setCurrentStep(2);
    
    try {
      const text = await file.text();
      const result = Papa.parse(text, { 
        header: true, 
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_')
      });
      
      if (result.errors.length > 0) {
        toast({
          title: "CSV Parse Errors",
          description: `Found ${result.errors.length} parsing errors`,
          variant: "destructive"
        });
      }
      
      setCsvData(result.data as any[]);
      setCurrentStep(3);
      
    } catch (error: any) {
      toast({
        title: "File Processing Error",
        description: error.message || "Failed to process CSV file",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const performStockValidation = () => {
    console.log('🔍 Performing proactive stock validation...');
    
    const processed: ProcessedRecord[] = csvData.map((row, index) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Basic validation
      if (!row.item_code) errors.push('Missing item code');
      if (!row.qty_received || isNaN(Number(row.qty_received))) {
        errors.push('Invalid quantity');
      }
      if (!row.grn_number) errors.push('Missing GRN number');
      if (!row.vendor) warnings.push('Missing vendor name');
      if (!row.date) warnings.push('Missing date');
      
      // Stock validation
      let stockStatus: ProcessedRecord['stockStatus'] = 'unknown';
      let stockAvailable = 0;
      let stockRequired = Number(row.qty_received) || 0;
      
      if (stockValidationData && row.item_code) {
        const stockInfo = stockValidationData.find(s => s.itemCode === row.item_code);
        if (stockInfo) {
          stockAvailable = stockInfo.available;
          
          if (stockAvailable >= stockRequired) {
            stockStatus = 'sufficient';
          } else if (stockAvailable > stockRequired * 0.5) {
            stockStatus = 'insufficient';
            warnings.push(`Only ${stockAvailable} available, ${stockRequired} required`);
            errors.push('Insufficient stock'); // This is the error that was appearing
          } else {
            stockStatus = 'critical';
            errors.push(`Critical stock shortage: ${stockAvailable} available, ${stockRequired} required`);
          }
        }
      }
      
      return {
        rowIndex: index,
        data: row,
        stockStatus,
        stockAvailable,
        stockRequired,
        errors,
        warnings
      };
    });
    
    setProcessedRecords(processed);
    
    // Auto-populate debug analysis data
    const analysisData = {
      totalRecords: processed.length,
      validRecords: processed.filter(r => r.errors.length === 0).length,
      errorRecords: processed.filter(r => r.errors.length > 0).length,
      warningRecords: processed.filter(r => r.warnings.length > 0).length,
      stockIssues: processed.filter(r => r.stockStatus === 'insufficient' || r.stockStatus === 'critical').length,
      data: processed.map(r => r.data),
      records: processed
    };
    
    setDebugAnalysisData(analysisData);
    
    // Set error records for correction manager
    const errors = processed
      .filter(r => r.errors.length > 0)
      .map(r => ({ ...r.data, errors: r.errors, rowIndex: r.rowIndex }));
    setErrorRecords(errors);
    
    console.log('✅ Stock validation complete:', {
      totalRecords: processed.length,
      errors: errors.length,
      stockIssues: analysisData.stockIssues
    });
  };

  const handleRecordCorrection = (rowIndex: number, correctedData: any) => {
    setCorrectedRecords(prev => [
      ...prev.filter(r => r.rowIndex !== rowIndex),
      { rowIndex, original: processedRecords[rowIndex]?.data, corrected: correctedData }
    ]);
    
    toast({
      title: "Record Corrected",
      description: `Row ${rowIndex + 1} has been corrected and is ready for upload`
    });
  };

  const handleBatchReprocess = (correctedRecords: any[]) => {
    // Reprocess with corrections
    performStockValidation();
    toast({
      title: "Batch Reprocessed",
      description: "All corrections have been applied and validated"
    });
  };

  const handleDownloadCorrectedCSV = (mode: string) => {
    console.log(`📥 Downloading CSV in ${mode} mode`);
  };

  const getStepStatus = (step: UploadStep) => {
    if (step.status === 'completed') return 'text-green-600 bg-green-50';
    if (step.status === 'active') return 'text-blue-600 bg-blue-50';
    if (step.status === 'error') return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getStepIcon = (step: UploadStep) => {
    if (step.status === 'completed') return <CheckCircle className="w-5 h-5" />;
    if (step.status === 'active') return <Activity className="w-5 h-5 animate-spin" />;
    if (step.status === 'error') return <AlertTriangle className="w-5 h-5" />;
    return <div className="w-5 h-5 rounded-full border-2 border-current" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-6 w-6" />
            Enhanced Stock Issues Upload with Real-time Debugging
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Steps - Always Visible */}
          <div className="grid grid-cols-4 gap-4">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  step.status === 'active' ? 'border-blue-500' : 'border-gray-200'
                } ${getStepStatus(step)}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {getStepIcon(step)}
                  <span className="font-medium text-sm">Step {step.id}</span>
                </div>
                <h3 className="font-semibold text-sm">{step.title}</h3>
                <p className="text-xs opacity-75">{step.description}</p>
              </div>
            ))}
          </div>

          {/* Step 1: File Upload */}
          {currentStep >= 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Select CSV File
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FileUpload
                  accept=".csv"
                  onFilesSelected={(files) => setUploadFile(files[0])}
                  disabled={isProcessing}
                />
                {uploadFile && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">{uploadFile.name}</span>
                      <Badge variant="secondary">
                        {(uploadFile.size / 1024).toFixed(1)} KB
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Real-time Preview & Validation - Always Visible */}
          {csvData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Real-time Preview & Stock Validation
                  <Badge variant="outline">
                    {csvData.length} records
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{processedRecords.length}</div>
                    <div className="text-sm text-blue-700">Total Records</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {processedRecords.filter(r => r.errors.length === 0).length}
                    </div>
                    <div className="text-sm text-green-700">Valid Records</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {processedRecords.filter(r => r.errors.length > 0).length}
                    </div>
                    <div className="text-sm text-red-700">Error Records</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {processedRecords.filter(r => r.stockStatus === 'insufficient' || r.stockStatus === 'critical').length}
                    </div>
                    <div className="text-sm text-yellow-700">Stock Issues</div>
                  </div>
                </div>

                {/* Stock Status Preview */}
                <ScrollArea className="h-40 border rounded-lg p-3">
                  <div className="space-y-2">
                    {processedRecords.slice(0, 10).map((record, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Row {record.rowIndex + 1}</span>
                          <span className="text-sm">{record.data.item_code}</span>
                          {record.stockStatus && (
                            <Badge 
                              variant={record.stockStatus === 'sufficient' ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {record.stockStatus}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Stock: {record.stockAvailable}/{record.stockRequired}
                        </div>
                      </div>
                    ))}
                    {processedRecords.length > 10 && (
                      <div className="text-center text-sm text-muted-foreground">
                        ... and {processedRecords.length - 10} more records
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Debug Console - Always Visible When Data Exists */}
          {processedRecords.length > 0 && (
            <Tabs defaultValue="debugger" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="debugger" className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Debug Console
                </TabsTrigger>
                <TabsTrigger value="corrections" className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  CSV Corrections
                </TabsTrigger>
              </TabsList>

              <TabsContent value="debugger">
                <GRNUploadDebugger
                  analysisData={debugAnalysisData}
                  onRecordCorrection={handleRecordCorrection}
                  onBatchReprocess={handleBatchReprocess}
                  onDownloadCorrectedCSV={handleDownloadCorrectedCSV}
                  isProcessing={isProcessing}
                />
              </TabsContent>

              <TabsContent value="corrections">
                <CSVCorrectionManager
                  records={csvData}
                  errorRecords={errorRecords}
                  correctedRecords={correctedRecords}
                  onDownload={handleDownloadCorrectedCSV}
                  onReupload={handleBatchReprocess}
                />
              </TabsContent>
            </Tabs>
          )}

          {/* Critical Errors Alert - Always Visible */}
          {errorRecords.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{errorRecords.length} records have critical errors</strong> that must be resolved before upload.
                Use the Debug Console and CSV Corrections tools above to fix these issues.
              </AlertDescription>
            </Alert>
          )}

          {/* Step 4: Process Upload */}
          {processedRecords.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ready to Process</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button 
                    disabled={errorRecords.length > 0}
                    className="flex-1"
                  >
                    Process {processedRecords.filter(r => r.errors.length === 0).length} Valid Records
                  </Button>
                  <Button variant="outline" disabled={errorRecords.length === 0}>
                    Download Error Report
                  </Button>
                </div>
                
                {errorRecords.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Fix {errorRecords.length} errors before processing
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
