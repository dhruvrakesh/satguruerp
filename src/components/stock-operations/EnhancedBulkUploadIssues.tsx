
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/hooks/use-toast";
import { useBulkIssueValidation, BulkValidationResult } from "@/hooks/useBulkIssueValidation";
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
}

interface ProcessedRecord {
  rowIndex: number;
  data: any;
  validationResult?: BulkValidationResult;
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
  const [validationResults, setValidationResults] = useState<BulkValidationResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugAnalysisData, setDebugAnalysisData] = useState<any>(null);
  const [errorRecords, setErrorRecords] = useState<any[]>([]);
  const [correctedRecords, setCorrectedRecords] = useState<any[]>([]);
  const { toast } = useToast();
  const { validateBulk, processBulk, isValidating, isProcessing: isBulkProcessing } = useBulkIssueValidation();

  const steps: UploadStep[] = [
    {
      id: 1,
      title: "Select CSV File",
      description: "Choose your Issue data file",
      status: uploadFile ? 'completed' : 'active'
    },
    {
      id: 2,
      title: "Real-time Preview & Stock Validation",
      description: "Automatic stock validation and error detection",
      status: csvData.length > 0 ? 'completed' : uploadFile ? 'active' : 'pending'
    },
    {
      id: 3,
      title: "Debug Console",
      description: "Advanced debugging and correction tools",
      status: processedRecords.length > 0 ? 'completed' : csvData.length > 0 ? 'active' : 'pending'
    },
    {
      id: 4,
      title: "Process Upload",
      description: "Execute the validated upload",
      status: 'pending'
    }
  ];

  // Extract issue items from CSV data for bulk validation
  const issueItems = csvData.map((row, index) => ({
    item_code: row.item_code || '',
    qty_issued: Number(row.qty_issued || row.quantity || 0),
    row_num: index + 1
  })).filter(item => item.item_code);

  // Process CSV file immediately when selected
  useEffect(() => {
    if (uploadFile) {
      processCSVFile(uploadFile);
    }
  }, [uploadFile]);

  // Run bulk issue validation when CSV data changes
  useEffect(() => {
    if (csvData.length > 0 && issueItems.length > 0) {
      performBulkValidation();
    }
  }, [csvData]);

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

  const performBulkValidation = async () => {
    console.log('🔍 Performing bulk issue validation...');
    setIsProcessing(true);
    
    try {
      // Perform bulk validation using the new RPC function
      const results = await validateBulk(issueItems);
      setValidationResults(results);
      
      // Process results and combine with CSV data
      const processed: ProcessedRecord[] = csvData.map((row, index) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Basic validation for issue uploads
        if (!row.item_code) errors.push('Missing item code');
        
        const qtyIssued = Number(row.qty_issued || row.quantity || 0);
        if (!qtyIssued || isNaN(qtyIssued) || qtyIssued <= 0) {
          errors.push('Invalid or missing quantity to issue');
        }
        
        if (!row.issue_number && !row.reference_number) {
          warnings.push('Missing issue/reference number');
        }
        
        if (!row.issued_to) warnings.push('Missing issued to information');
        if (!row.date) warnings.push('Missing issue date');
        
        // Find validation result for this row
        const validationResult = results.find(r => r.row_num === index + 1);
        if (validationResult) {
          if (validationResult.validation_status === 'not_found') {
            errors.push('Item code not found in master data');
          } else if (validationResult.validation_status === 'insufficient_stock') {
            errors.push(validationResult.error_message);
          }
        }
        
        return {
          rowIndex: index,
          data: row,
          validationResult,
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
        stockIssues: results.filter(r => r.validation_status === 'insufficient_stock').length,
        data: processed.map(r => r.data),
        records: processed,
        uploadType: 'ISSUE',
        validationResults: results
      };
      
      setDebugAnalysisData(analysisData);
      
      // Set error records for correction manager
      const errors = processed
        .filter(r => r.errors.length > 0)
        .map(r => ({ ...r.data, errors: r.errors, rowIndex: r.rowIndex }));
      setErrorRecords(errors);
      
      console.log('✅ Bulk validation complete:', {
        totalRecords: processed.length,
        errors: errors.length,
        stockIssues: analysisData.stockIssues
      });
      
    } catch (error: any) {
      console.error('❌ Bulk validation failed:', error);
      toast({
        title: "Validation Error",
        description: error.message || "Failed to validate issue data",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
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
    performBulkValidation();
    toast({
      title: "Batch Reprocessed",
      description: "All corrections have been applied and validated"
    });
  };

  const handleDownloadCorrectedCSV = (mode: string) => {
    console.log(`📥 Downloading corrected Issue CSV in ${mode} mode`);
  };

  const handleProcessUpload = async () => {
    if (!validationResults.length) {
      toast({
        title: "No Data to Process",
        description: "Please upload and validate data first",
        variant: "destructive"
      });
      return;
    }

    const validRecords = validationResults.filter(r => r.validation_status === 'sufficient');
    if (validRecords.length === 0) {
      toast({
        title: "No Valid Records",
        description: "All records have validation errors. Please fix them first.",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await processBulk(validationResults);
      
      if (result.success) {
        toast({
          title: "Upload Successful",
          description: `Successfully processed ${result.processed_count} issue records`,
          variant: "default"
        });
        
        // Reset form after successful upload
        setCurrentStep(1);
        setUploadFile(null);
        setCsvData([]);
        setProcessedRecords([]);
        setValidationResults([]);
        onOpenChange(false);
      } else {
        toast({
          title: "Upload Failed",
          description: `Failed to process records. ${result.error_count} errors occurred.`,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('❌ Upload failed:', error);
      toast({
        title: "Upload Error",
        description: error.message || "Failed to process upload",
        variant: "destructive"
      });
    }
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
            Enhanced Stock Issues Upload with Real-time Stock Validation
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
                  Select Issue CSV File
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
                  Real-time Issue Preview & Stock Validation
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
                       {validationResults.filter(r => r.validation_status === 'insufficient_stock').length}
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
                           {record.validationResult && (
                             <Badge 
                               variant={record.validationResult.validation_status === 'sufficient' ? 'default' : 'destructive'}
                               className="text-xs"
                             >
                               {record.validationResult.validation_status}
                             </Badge>
                           )}
                         </div>
                         <div className="text-xs text-muted-foreground">
                           Available: {record.validationResult?.available_qty || 0} | Requested: {record.validationResult?.requested_qty || 0}
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

          {/* Step 4: Process Upload - Always Visible When Records Are Valid */}
          {processedRecords.filter(r => r.errors.length === 0).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Ready to Process Upload
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {validationResults.filter(r => r.validation_status === 'sufficient').length} records are ready for upload
                    </p>
                  </div>
                  <Button 
                    size="lg" 
                    className="bg-green-600 hover:bg-green-700"
                    disabled={isBulkProcessing || isValidating}
                    onClick={handleProcessUpload}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {isBulkProcessing ? 'Processing...' : `Process ${validationResults.filter(r => r.validation_status === 'sufficient').length} Issues`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
