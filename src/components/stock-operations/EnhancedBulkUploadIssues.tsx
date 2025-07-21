
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
import { supabase } from "@/integrations/supabase/client";
import { IssueCSVCorrectionManager } from "./IssueCSVCorrectionManager";
import { IssueUploadDebugger } from "./IssueUploadDebugger";
import { StockCorrectionModal } from "./StockCorrectionModal";
import { 
  Upload, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Activity,
  TrendingDown,
  Eye,
  Download,
  Edit3
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

interface DuplicateCheckResult {
  total_checked: number;
  total_duplicates: number;
  has_duplicates: boolean;
  duplicates: any[];
  upload_type: string;
  check_timestamp: string;
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
  const [errorRecords, setErrorRecords] = useState<any[]>([]);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<DuplicateCheckResult | null>(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const { toast } = useToast();
  const { 
    validateBulk, 
    processBulk, 
    isValidating, 
    isProcessing: isBulkProcessing,
    correctedRecords,
    applyCorrectedQuantity,
    getCorrectedQuantity,
    getProcessableRecords
  } = useBulkIssueValidation();

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
      title: "Debug Console & Corrections",
      description: "Advanced debugging and stock correction tools",
      status: processedRecords.length > 0 ? 'completed' : csvData.length > 0 ? 'active' : 'pending'
    },
    {
      id: 4,
      title: "Process Upload",
      description: "Execute the validated upload",
      status: 'pending'
    }
  ];

  // Process CSV file immediately when selected
  useEffect(() => {
    if (uploadFile) {
      processCSVFile(uploadFile);
    }
  }, [uploadFile]);

  // Run duplicate check and bulk validation when CSV data changes
  useEffect(() => {
    if (csvData.length > 0) {
      checkForDuplicates();
    }
  }, [csvData]);

  const checkForDuplicates = async () => {
    console.log('🔍 Checking for duplicates in', csvData.length, 'records...');
    setIsProcessing(true);
    
    try {
      // For now, simulate no duplicates (duplicate prevention will be implemented after types update)
      const simulatedResult: DuplicateCheckResult = {
        total_checked: csvData.length,
        total_duplicates: 0,
        has_duplicates: false,
        duplicates: [],
        upload_type: 'ISSUE',
        check_timestamp: new Date().toISOString()
      };

      console.log('✅ Duplicate check result (simulated - no duplicates):', simulatedResult);
      setDuplicateCheckResult(simulatedResult);
      setShowDuplicateWarning(false);
      
      // Proceed with validation since no duplicates detected
      performBulkValidation();
    } catch (error: any) {
      console.error('❌ Duplicate check error:', error);
      performBulkValidation(); // Proceed with validation on error
    } finally {
      setIsProcessing(false);
    }
  };

  const proceedWithValidation = () => {
    setShowDuplicateWarning(false);
    performBulkValidation();
  };

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
    console.log('🔍 Performing bulk issue validation for', csvData.length, 'records...');
    setIsProcessing(true);
    
    try {
      // Apply corrections to CSV data before validation
      const correctedCsvData = csvData.map((row, index) => {
        const correctedQty = getCorrectedQuantity(index);
        if (correctedQty !== null) {
          return {
            ...row,
            qty_issued: correctedQty,
            quantity: correctedQty
          };
        }
        return row;
      });

      // Extract issue items from CSV data for bulk validation - PROCESS ALL RECORDS
      const issueItems = correctedCsvData.map((row, index) => ({
        item_code: row.item_code || '',
        qty_issued: Number(row.qty_issued || row.quantity || 0),
        requested_qty: Number(row.qty_issued || row.quantity || 0), // Add both field names for backend compatibility
        row_num: index + 1
      })).filter(item => item.item_code && item.qty_issued > 0);

      console.log('📊 Validating ALL', issueItems.length, 'items (no limits applied)...');
      
      // Perform bulk validation using the RPC function - PROCESS ALL RECORDS
      const results = await validateBulk(issueItems);
      console.log('✅ Validation results received:', results.length, 'records for', issueItems.length, 'input items');
      
      // Store ALL validation results (ensure no truncation)
      setValidationResults(results);
      
      // Process results and combine with CSV data
      const processed: ProcessedRecord[] = correctedCsvData.map((row, index) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Basic validation for issue uploads with null checks
        if (!row.item_code || row.item_code.trim() === '') {
          errors.push('Missing or empty item code');
        }
        
        const qtyIssued = Number(row.qty_issued || row.quantity || 0);
        if (!qtyIssued || isNaN(qtyIssued) || qtyIssued <= 0 || qtyIssued === null || qtyIssued === undefined) {
          errors.push('Invalid or missing quantity to issue - must be a positive number');
        }
        
        if (!row.date) warnings.push('Missing issue date');
        if (!row.issued_to && !row.purpose) warnings.push('Missing issued to/purpose information');
        
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
      
      // Set error records for correction manager
      const errors = processed
        .filter(r => r.errors.length > 0)
        .map(r => ({ ...r.data, errors: r.errors, rowIndex: r.rowIndex }));
      setErrorRecords(errors);
      
      console.log('✅ Bulk validation complete:', {
        totalRecords: processed.length,
        validRecords: processed.filter(r => r.errors.length === 0).length,
        errorRecords: errors.length,
        stockIssues: results.filter(r => r.validation_status === 'insufficient_stock').length,
        validationResultsStored: results.length
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
    // Update CSV data with corrections
    const updatedCsvData = [...csvData];
    updatedCsvData[rowIndex] = correctedData;
    setCsvData(updatedCsvData);
    
    // Re-run validation
    performBulkValidation();
    
    toast({
      title: "Record Corrected",
      description: `Row ${rowIndex + 1} has been corrected and re-validated`
    });
  };

  const handleBatchReprocess = async () => {
    // Reprocess with all corrections
    await performBulkValidation();
    toast({
      title: "Batch Reprocessed",
      description: "All corrections have been applied and validated"
    });
  };

  const handleDownloadCorrectedCSV = (mode: 'errors' | 'corrections' | 'retry-ready') => {
    console.log(`📥 Downloading Issue CSV in ${mode} mode...`);
    
    let csvData: any[] = [];
    let filename = '';
    
    switch (mode) {
      case 'errors':
        csvData = errorRecords;
        filename = 'issue_upload_errors.csv';
        break;
      case 'corrections':
        csvData = correctedRecords.map(corr => {
          const originalRecord = processedRecords.find(r => r.rowIndex === corr.rowIndex)?.data;
          return {
            ...originalRecord,
            qty_issued: corr.corrected_qty,
            quantity: corr.corrected_qty
          };
        });
        filename = 'issue_upload_corrections.csv';
        break;
      case 'retry-ready':
        // Generate retry-ready CSV with all valid records (including corrected ones)
        const processableRecords = getProcessableRecords(validationResults);
        csvData = processableRecords.map(record => {
          const originalRecord = processedRecords.find(r => r.rowIndex === record.row_num - 1)?.data;
          return {
            ...originalRecord,
            qty_issued: record.requested_qty,
            quantity: record.requested_qty
          };
        });
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

  const handleOpenStockCorrection = () => {
    setCorrectionModalOpen(true);
  };

  const handleApplyStockCorrections = (corrections: any[]) => {
    // Apply corrections via the hook
    corrections.forEach(correction => {
      applyCorrectedQuantity(
        correction.rowIndex,
        correction.item_code,
        correction.original_qty,
        correction.corrected_qty,
        correction.available_qty
      );
    });
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

    console.log('🚀 Processing upload with', validationResults.length, 'total validation results');

    try {
      // Get processable records (applies corrections and filters for sufficient stock)
      const processableRecords = getProcessableRecords(validationResults);
      console.log('📊 Processable records after corrections:', processableRecords.length);
      
      if (processableRecords.length === 0) {
        toast({
          title: "No Valid Records",
          description: "All records have validation errors. Please fix them first using the correction tools.",
          variant: "destructive"
        });
        return;
      }

      console.log('🔄 Processing', processableRecords.length, 'valid records...');
      const result = await processBulk(validationResults);
      
      if (result.success) {
        toast({
          title: "Upload Successful",
          description: `Successfully processed ${result.processed_count} issue records${correctedRecords.length > 0 ? ` (including ${correctedRecords.length} corrected items)` : ''}`,
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

  // Calculate counts based on validation results with corrections applied
  const processableRecords = validationResults.length > 0 ? getProcessableRecords(validationResults) : [];
  const validRecordsCount = processableRecords.length;
  const insufficientStockCount = validationResults.filter(r => {
    const correction = correctedRecords.find(c => c.rowIndex === r.row_num - 1);
    if (correction) {
      return correction.corrected_qty > r.available_qty;
    }
    return r.validation_status === 'insufficient_stock';
  }).length;
  const insufficientStockItems = validationResults.filter(r => r.validation_status === 'insufficient_stock');

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
          {/* Duplicate Warning Alert */}
          {showDuplicateWarning && duplicateCheckResult && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <div className="font-semibold text-red-800">
                    🚨 CRITICAL: Duplicate Records Detected
                  </div>
                  <div className="text-sm text-red-700">
                    Found <strong>{duplicateCheckResult.total_duplicates}</strong> potential duplicates out of{' '}
                    <strong>{duplicateCheckResult.total_checked}</strong> records. 
                    Re-uploading this file will create duplicate entries in the database.
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={proceedWithValidation}
                    >
                      Force Upload (Create Duplicates)
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setUploadFile(null);
                        setCsvData([]);
                        setShowDuplicateWarning(false);
                        setCurrentStep(1);
                      }}
                    >
                      Cancel & Choose Different File
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => handleDownloadCorrectedCSV('retry-ready')}
                    >
                      Download Non-Duplicate Records Only
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Progress Steps */}
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

          {/* Step 2: Real-time Preview & Validation */}
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
                    <div className="text-2xl font-bold text-blue-600">{csvData.length}</div>
                    <div className="text-sm text-blue-700">Total Records</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{validRecordsCount}</div>
                    <div className="text-sm text-green-700">Ready to Process</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {processedRecords.filter(r => r.errors.length > 0).length}
                    </div>
                    <div className="text-sm text-red-700">Error Records</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{insufficientStockCount}</div>
                    <div className="text-sm text-yellow-700">Insufficient Stock</div>
                  </div>
                </div>

                {/* Stock Correction Actions */}
                {insufficientStockCount > 0 && (
                  <div className="mb-4">
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between">
                        <span>
                          <strong>{insufficientStockCount} items</strong> have insufficient stock levels that need correction.
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleOpenStockCorrection}
                          className="ml-4"
                        >
                          <Edit3 className="w-4 h-4 mr-2" />
                          Fix Stock Issues
                        </Button>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

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
                          {getCorrectedQuantity(record.rowIndex) !== null && (
                            <Badge variant="outline" className="text-xs bg-blue-50">
                              Corrected
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Available: {record.validationResult?.available_qty || 0} | 
                          Requested: {getCorrectedQuantity(record.rowIndex) || record.validationResult?.requested_qty || 0}
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

          {/* Step 3: Debug Console */}
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
                <IssueUploadDebugger
                  csvData={csvData}
                  onRecordCorrection={handleRecordCorrection}
                  onBatchReprocess={handleBatchReprocess}
                  onDownloadCorrectedCSV={handleDownloadCorrectedCSV}
                  isProcessing={isProcessing}
                />
              </TabsContent>

              <TabsContent value="corrections">
                <IssueCSVCorrectionManager
                  records={csvData}
                  errorRecords={errorRecords}
                  correctedRecords={correctedRecords}
                  onDownload={handleDownloadCorrectedCSV}
                  onReupload={handleProcessUpload}
                />
              </TabsContent>
            </Tabs>
          )}

          {/* Critical Errors Alert */}
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
          {validRecordsCount > 0 && (
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
                      {validRecordsCount} records are ready for upload out of {validationResults.length} total
                      {correctedRecords.length > 0 && (
                        <span className="text-blue-600"> (including {correctedRecords.length} corrected)</span>
                      )}
                    </p>
                  </div>
                  <Button 
                    size="lg" 
                    className="bg-green-600 hover:bg-green-700"
                    disabled={isBulkProcessing || isValidating}
                    onClick={handleProcessUpload}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {isBulkProcessing ? 'Processing...' : `Process ${validRecordsCount} Issues`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Stock Correction Modal */}
        <StockCorrectionModal
          open={correctionModalOpen}
          onOpenChange={setCorrectionModalOpen}
          insufficientStockItems={insufficientStockItems}
          onApplyCorrections={handleApplyStockCorrections}
          onRevalidate={performBulkValidation}
          existingCorrections={correctedRecords}
        />
      </DialogContent>
    </Dialog>
  );
}
