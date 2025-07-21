
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  AlertCircle, 
  CheckCircle, 
  TrendingDown, 
  Edit3,
  Download,
  Eye,
  Activity
} from "lucide-react";
import { useBulkIssueValidation } from "@/hooks/useBulkIssueValidation";

interface IssueDebugRecord {
  rowIndex: number;
  originalData: any;
  correctedData?: any;
  errors: string[];
  warnings: string[];
  stockStatus?: 'sufficient' | 'insufficient' | 'critical' | 'unknown';
  availableStock?: number;
  requiredStock?: number;
  status: 'pending' | 'processing' | 'corrected' | 'failed' | 'success';
  validationResult?: any;
}

interface IssueDebugAnalysis {
  totalRecords: number;
  validRecords: number;
  errorRecords: number;
  warningRecords: number;
  stockIssues: number;
  correctedRecords: number;
  processingProgress: number;
  records: IssueDebugRecord[];
  stockAnalysis: {
    totalItemsChecked: number;
    sufficientStock: number;
    insufficientStock: number;
    criticalStock: number;
  };
}

interface IssueUploadDebuggerProps {
  csvData: any[];
  onRecordCorrection: (rowIndex: number, correctedData: any) => void;
  onBatchReprocess: (correctedRecords: any[]) => void;
  onDownloadCorrectedCSV: (mode: 'errors' | 'corrections' | 'retry-ready') => void;
  isProcessing?: boolean;
}

export function IssueUploadDebugger({ 
  csvData,
  onRecordCorrection, 
  onBatchReprocess,
  onDownloadCorrectedCSV,
  isProcessing = false 
}: IssueUploadDebuggerProps) {
  const [debugAnalysis, setDebugAnalysis] = useState<IssueDebugAnalysis | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<IssueDebugRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<number | null>(null);
  const [correctionData, setCorrectionData] = useState<any>({});
  const [activeTab, setActiveTab] = useState("overview");

  const { 
    validateBulk, 
    isValidating, 
    getCorrectedQuantity, 
    getCorrectedRecordsCount,
    getProcessableRecords,
    getErrorRecordsAfterCorrections,
    applyCorrectedQuantity,
    applyCorrectionsToValidationResults 
  } = useBulkIssueValidation();

  useEffect(() => {
    if (csvData?.length > 0) {
      performIssueDebugAnalysis();
    }
  }, [csvData, getCorrectedRecordsCount()]); // Re-run when corrections change

  const performIssueDebugAnalysis = async () => {
    console.log('🔧 Starting Issue upload debug analysis for', csvData.length, 'records...');
    
    try {
      // Prepare items for bulk validation - PROCESS ALL RECORDS
      const issueItems = csvData.map((row, index) => ({
        item_code: row.item_code || '',
        qty_issued: Number(row.qty_issued || row.quantity || 0),
        row_num: index + 1
      })).filter(item => item.item_code);

      console.log('📊 Validating ALL', issueItems.length, 'issue items for debug analysis...');
      
      // Perform bulk validation - ENSURE ALL RECORDS ARE PROCESSED
      const validationResults = await validateBulk(issueItems);
      console.log('✅ Debug validation complete:', validationResults.length, 'results for', issueItems.length, 'items');
      
      // Get processable records (with corrections applied)
      const processableRecords = getProcessableRecords(validationResults);
      
      // Get corrected results for analysis
      const correctedResults = applyCorrectionsToValidationResults(validationResults);
      
      // Process results and combine with CSV data
      const records: IssueDebugRecord[] = csvData.map((row, index) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Issue-specific validation
        if (!row.item_code) errors.push('Missing item code');
        
        const qtyIssued = Number(row.qty_issued || row.quantity || 0);
        if (!qtyIssued || isNaN(qtyIssued) || qtyIssued <= 0) {
          errors.push('Invalid or missing quantity to issue');
        }
        
        if (!row.date) warnings.push('Missing issue date');
        if (!row.issued_to && !row.purpose) warnings.push('Missing issued to/purpose information');
        
        // Find validation result for this row
        const validationResult = correctedResults.find(r => r.row_num === index + 1);
        let stockStatus: IssueDebugRecord['stockStatus'] = 'unknown';
        let availableStock = 0;
        let requiredStock = qtyIssued;
        
        if (validationResult) {
          availableStock = validationResult.available_qty || 0;
          requiredStock = validationResult.requested_qty;
          
          if (validationResult.validation_status === 'not_found') {
            errors.push('Item code not found in master data');
          } else if (validationResult.validation_status === 'insufficient_stock') {
            errors.push(validationResult.error_message);
            stockStatus = availableStock > requiredStock * 0.5 ? 'insufficient' : 'critical';
          } else if (validationResult.validation_status === 'sufficient') {
            stockStatus = 'sufficient';
          }
        }

        // Check if this record has been corrected
        const hasCorrectedQty = getCorrectedQuantity(index) !== null;
        const isProcessable = processableRecords.some(p => p.row_num === index + 1);
        
        return {
          rowIndex: index,
          originalData: row,
          validationResult,
          errors,
          warnings,
          stockStatus,
          availableStock,
          requiredStock,
          status: hasCorrectedQty ? 'corrected' : isProcessable ? 'success' : (errors.length > 0 ? 'failed' : warnings.length > 0 ? 'pending' : 'success')
        };
      });
      
      // Calculate summary statistics using centralized counts
      const centralizedCorrectedCount = getCorrectedRecordsCount();
      
      const analysis: IssueDebugAnalysis = {
        totalRecords: records.length,
        validRecords: processableRecords.length,
        errorRecords: records.filter(r => r.status === 'failed').length,
        warningRecords: records.filter(r => r.status === 'pending').length,
        stockIssues: records.filter(r => r.stockStatus === 'insufficient' || r.stockStatus === 'critical').length,
        correctedRecords: centralizedCorrectedCount, // Use centralized count
        processingProgress: 100, // Complete after bulk validation
        records,
        stockAnalysis: {
          totalItemsChecked: validationResults.length,
          sufficientStock: records.filter(r => r.stockStatus === 'sufficient').length,
          insufficientStock: records.filter(r => r.stockStatus === 'insufficient').length,
          criticalStock: records.filter(r => r.stockStatus === 'critical').length,
        }
      };
      
      setDebugAnalysis(analysis);
      console.log('✅ Issue debug analysis complete for ALL records:', analysis);
      
    } catch (error) {
      console.error('💥 Issue debug analysis failed:', error);
    }
  };

  const handleRecordEdit = (rowIndex: number) => {
    const record = debugAnalysis?.records[rowIndex];
    if (record) {
      setEditingRecord(rowIndex);
      setCorrectionData({ ...record.originalData });
      setSelectedRecord(record);
    }
  };

  const handleSaveCorrection = () => {
    if (editingRecord !== null && debugAnalysis && selectedRecord) {
      const correctedQty = Number(correctionData.qty_issued || correctionData.quantity || 0);
      const originalQty = Number(selectedRecord.originalData.qty_issued || selectedRecord.originalData.quantity || 0);
      const availableQty = selectedRecord.availableStock || 0;
      
      // Apply correction using the centralized hook
      applyCorrectedQuantity(
        editingRecord, 
        selectedRecord.originalData.item_code,
        originalQty,
        correctedQty,
        availableQty
      );
      
      // Call the parent callback for any additional handling
      onRecordCorrection(editingRecord, correctionData);
      
      setEditingRecord(null);
      setCorrectionData({});
      setSelectedRecord(null);
      
      // Trigger re-analysis to update UI
      performIssueDebugAnalysis();
    }
  };

  const getStatusColor = (status: IssueDebugRecord['status']) => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'pending': return 'bg-yellow-500';
      case 'corrected': return 'bg-blue-500';
      case 'processing': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getStockStatusColor = (status: IssueDebugRecord['stockStatus']) => {
    switch (status) {
      case 'sufficient': return 'text-green-600 bg-green-50';
      case 'insufficient': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const handleDownloadCorrectedCSV = (mode: 'errors' | 'corrections' | 'retry-ready') => {
    onDownloadCorrectedCSV(mode);
  };

  if (!debugAnalysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 animate-spin" />
            Analyzing Issue Upload Data...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={isValidating ? 50 : 100} />
            <p className="text-sm text-muted-foreground">
              {isValidating ? 'Validating stock levels...' : 'Processing validation results...'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Issue Upload Debug Console
          {debugAnalysis && debugAnalysis.correctedRecords > 0 && (
            <Badge variant="outline" className="bg-blue-50">
              {debugAnalysis.correctedRecords} Corrected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="records">Records</TabsTrigger>
            <TabsTrigger value="stock">Stock Analysis</TabsTrigger>
            <TabsTrigger value="corrections">Corrections</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{debugAnalysis?.totalRecords || 0}</div>
                <div className="text-sm text-blue-700">Total Records</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{debugAnalysis?.validRecords || 0}</div>
                <div className="text-sm text-green-700">Ready to Process</div>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{debugAnalysis?.errorRecords || 0}</div>
                <div className="text-sm text-red-700">Error Records</div>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{debugAnalysis?.warningRecords || 0}</div>
                <div className="text-sm text-yellow-700">Warning Records</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{debugAnalysis?.correctedRecords || 0}</div>
                <div className="text-sm text-purple-700">Corrected Records</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Quick Actions</h4>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDownloadCorrectedCSV('errors')}
                  disabled={!debugAnalysis || debugAnalysis.errorRecords === 0}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download Errors ({debugAnalysis?.errorRecords || 0})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDownloadCorrectedCSV('corrections')}
                  disabled={!debugAnalysis || debugAnalysis.correctedRecords === 0}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download Corrections ({debugAnalysis?.correctedRecords || 0})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDownloadCorrectedCSV('retry-ready')}
                  disabled={!debugAnalysis || debugAnalysis.validRecords === 0}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download Retry-Ready CSV ({debugAnalysis?.validRecords || 0})
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="records" className="space-y-4">
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {debugAnalysis.records.map((record, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(record.status)}`} />
                        <span className="font-medium">Row {record.rowIndex + 1}</span>
                        <Badge variant="outline">{record.originalData.item_code}</Badge>
                        {record.stockStatus && (
                          <Badge className={getStockStatusColor(record.stockStatus)}>
                            {record.stockStatus}
                          </Badge>
                        )}
                        {record.status === 'corrected' && (
                          <Badge variant="outline" className="bg-blue-50">
                            Corrected
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRecordEdit(index)}
                        disabled={isProcessing}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {record.errors.length > 0 && (
                      <Alert variant="destructive" className="mb-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <ul className="list-disc list-inside text-xs">
                            {record.errors.map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {record.warnings.length > 0 && (
                      <Alert className="mb-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <ul className="list-disc list-inside text-xs">
                            {record.warnings.map((warning, i) => (
                              <li key={i}>{warning}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="text-xs text-muted-foreground">
                      Item: {record.originalData.item_code} | 
                      Qty: {getCorrectedQuantity(record.rowIndex) || record.originalData.qty_issued || record.originalData.quantity}
                      {record.stockStatus !== 'unknown' && (
                        <> | Stock: {record.availableStock}/{record.requiredStock}</>
                      )}
                      {getCorrectedQuantity(record.rowIndex) !== null && (
                        <> | Original: {record.originalData.qty_issued || record.originalData.quantity}</>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="stock" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{debugAnalysis.stockAnalysis.totalItemsChecked}</div>
                <div className="text-sm text-blue-700">Items Checked</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{debugAnalysis.stockAnalysis.sufficientStock}</div>
                <div className="text-sm text-green-700">Sufficient Stock</div>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{debugAnalysis.stockAnalysis.insufficientStock}</div>
                <div className="text-sm text-yellow-700">Insufficient Stock</div>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{debugAnalysis.stockAnalysis.criticalStock}</div>
                <div className="text-sm text-red-700">Critical Stock</div>
              </div>
            </div>
            
            {debugAnalysis.stockAnalysis.insufficientStock > 0 && (
              <Alert>
                <TrendingDown className="h-4 w-4" />
                <AlertDescription>
                  {debugAnalysis.stockAnalysis.insufficientStock} items have insufficient stock levels. 
                  Use the Stock Correction feature to adjust quantities before processing.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="corrections" className="space-y-4">
            {editingRecord !== null && selectedRecord && (
              <Card>
                <CardHeader>
                  <CardTitle>Edit Issue Record {editingRecord + 1}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="item-code">Item Code</Label>
                      <Input
                        id="item-code"
                        value={correctionData.item_code || ''}
                        onChange={(e) => setCorrectionData({
                          ...correctionData,
                          item_code: e.target.value
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="quantity">Quantity to Issue</Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={correctionData.qty_issued || correctionData.quantity || ''}
                        onChange={(e) => setCorrectionData({
                          ...correctionData,
                          qty_issued: e.target.value
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="date">Issue Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={correctionData.date || ''}
                        onChange={(e) => setCorrectionData({
                          ...correctionData,
                          date: e.target.value
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="purpose">Purpose/Issued To</Label>
                      <Input
                        id="purpose"
                        value={correctionData.purpose || correctionData.issued_to || ''}
                        onChange={(e) => setCorrectionData({
                          ...correctionData,
                          purpose: e.target.value
                        })}
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={handleSaveCorrection}>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Save Correction
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setEditingRecord(null);
                        setCorrectionData({});
                        setSelectedRecord(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <div className="text-sm text-muted-foreground">
              {debugAnalysis.correctedRecords} records have been corrected and are ready for reprocessing.
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
