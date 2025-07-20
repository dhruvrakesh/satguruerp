
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
  Clock, 
  TrendingDown, 
  TrendingUp, 
  Edit3,
  Download,
  RefreshCw,
  Eye,
  Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DebugRecord {
  rowIndex: number;
  originalData: any;
  correctedData?: any;
  errors: string[];
  warnings: string[];
  stockStatus?: 'sufficient' | 'insufficient' | 'critical' | 'unknown';
  availableStock?: number;
  requiredStock?: number;
  status: 'pending' | 'processing' | 'corrected' | 'failed' | 'success';
}

interface DebugAnalysis {
  totalRecords: number;
  validRecords: number;
  errorRecords: number;
  warningRecords: number;
  stockIssues: number;
  duplicateRecords: number;
  processingProgress: number;
  records: DebugRecord[];
  stockAnalysis: {
    totalItemsChecked: number;
    sufficientStock: number;
    insufficientStock: number;
    criticalStock: number;
  };
}

interface GRNUploadDebuggerProps {
  analysisData: any;
  onRecordCorrection: (rowIndex: number, correctedData: any) => void;
  onBatchReprocess: (correctedRecords: any[]) => void;
  onDownloadCorrectedCSV: (mode: 'errors' | 'corrections' | 'retry-ready') => void;
  isProcessing?: boolean;
}

export function GRNUploadDebugger({ 
  analysisData, 
  onRecordCorrection, 
  onBatchReprocess,
  onDownloadCorrectedCSV,
  isProcessing = false 
}: GRNUploadDebuggerProps) {
  const [debugAnalysis, setDebugAnalysis] = useState<DebugAnalysis | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<DebugRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<number | null>(null);
  const [correctionData, setCorrectionData] = useState<any>({});
  const [activeTab, setActiveTab] = useState("overview");
  const [stockCheckProgress, setStockCheckProgress] = useState(0);

  useEffect(() => {
    if (analysisData) {
      performDebugAnalysis();
    }
  }, [analysisData]);

  const performDebugAnalysis = async () => {
    console.log('🔧 Starting debug analysis...');
    
    try {
      const records: DebugRecord[] = [];
      let stockCheckCount = 0;
      
      // Process each record for detailed analysis
      for (let i = 0; i < analysisData.data?.length || 0; i++) {
        const row = analysisData.data[i];
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Validate record data
        if (!row.item_code) errors.push('Missing item code');
        if (!row.grn_number) errors.push('Missing GRN number');
        if (!row.qty_received || isNaN(Number(row.qty_received))) {
          errors.push('Invalid quantity');
        }
        
        // Check stock availability
        let stockStatus: DebugRecord['stockStatus'] = 'unknown';
        let availableStock = 0;
        
        if (row.item_code) {
          try {
            const { data: stockData } = await supabase
              .from('satguru_stock')
              .select('current_qty')
              .eq('item_code', row.item_code)
              .single();
            
            availableStock = stockData?.current_qty || 0;
            const requiredStock = Number(row.qty_received) || 0;
            
            if (availableStock >= requiredStock) {
              stockStatus = 'sufficient';
            } else if (availableStock > requiredStock * 0.5) {
              stockStatus = 'insufficient';
              warnings.push(`Only ${availableStock} available, ${requiredStock} required`);
            } else {
              stockStatus = 'critical';
              errors.push(`Critical stock shortage: ${availableStock} available, ${requiredStock} required`);
            }
          } catch (error) {
            warnings.push('Could not verify stock levels');
          }
          
          stockCheckCount++;
          setStockCheckProgress((stockCheckCount / (analysisData.data?.length || 1)) * 100);
        }
        
        records.push({
          rowIndex: i,
          originalData: row,
          errors,
          warnings,
          stockStatus,
          availableStock,
          requiredStock: Number(row.qty_received) || 0,
          status: errors.length > 0 ? 'failed' : warnings.length > 0 ? 'pending' : 'success'
        });
      }
      
      // Calculate summary statistics
      const analysis: DebugAnalysis = {
        totalRecords: records.length,
        validRecords: records.filter(r => r.status === 'success').length,
        errorRecords: records.filter(r => r.status === 'failed').length,
        warningRecords: records.filter(r => r.status === 'pending').length,
        stockIssues: records.filter(r => r.stockStatus === 'insufficient' || r.stockStatus === 'critical').length,
        duplicateRecords: analysisData.duplicateAnalysis?.duplicateRows?.length || 0,
        processingProgress: 0,
        records,
        stockAnalysis: {
          totalItemsChecked: stockCheckCount,
          sufficientStock: records.filter(r => r.stockStatus === 'sufficient').length,
          insufficientStock: records.filter(r => r.stockStatus === 'insufficient').length,
          criticalStock: records.filter(r => r.stockStatus === 'critical').length,
        }
      };
      
      setDebugAnalysis(analysis);
      console.log('🔧 Debug analysis complete:', analysis);
      
    } catch (error) {
      console.error('💥 Debug analysis failed:', error);
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
    if (editingRecord !== null && debugAnalysis) {
      const updatedRecords = [...debugAnalysis.records];
      updatedRecords[editingRecord] = {
        ...updatedRecords[editingRecord],
        correctedData: correctionData,
        status: 'corrected'
      };
      
      setDebugAnalysis({
        ...debugAnalysis,
        records: updatedRecords
      });
      
      onRecordCorrection(editingRecord, correctionData);
      setEditingRecord(null);
      setCorrectionData({});
    }
  };

  const getStatusColor = (status: DebugRecord['status']) => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'pending': return 'bg-yellow-500';
      case 'corrected': return 'bg-blue-500';
      case 'processing': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getStockStatusColor = (status: DebugRecord['stockStatus']) => {
    switch (status) {
      case 'sufficient': return 'text-green-600 bg-green-50';
      case 'insufficient': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (!debugAnalysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 animate-spin" />
            Analyzing Upload Data...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={stockCheckProgress} />
            <p className="text-sm text-muted-foreground">
              Checking stock levels and validating data... {Math.round(stockCheckProgress)}%
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
          <Eye className="h-5 w-5" />
          Upload Debug Console
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{debugAnalysis.totalRecords}</div>
                <div className="text-sm text-blue-700">Total Records</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{debugAnalysis.validRecords}</div>
                <div className="text-sm text-green-700">Valid Records</div>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{debugAnalysis.errorRecords}</div>
                <div className="text-sm text-red-700">Error Records</div>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{debugAnalysis.warningRecords}</div>
                <div className="text-sm text-yellow-700">Warning Records</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Quick Actions</h4>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onDownloadCorrectedCSV('errors')}
                  disabled={debugAnalysis.errorRecords === 0}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download Errors ({debugAnalysis.errorRecords})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onDownloadCorrectedCSV('corrections')}
                  disabled={debugAnalysis.records.filter(r => r.status === 'corrected').length === 0}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download Corrections ({debugAnalysis.records.filter(r => r.status === 'corrected').length})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onDownloadCorrectedCSV('retry-ready')}
                  disabled={debugAnalysis.validRecords + debugAnalysis.records.filter(r => r.status === 'corrected').length === 0}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download Retry-Ready CSV
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
                        <span className="font-medium">Row {record.rowIndex + 2}</span>
                        <Badge variant="outline">{record.originalData.item_code}</Badge>
                        {record.stockStatus && (
                          <Badge className={getStockStatusColor(record.stockStatus)}>
                            {record.stockStatus}
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
                      GRN: {record.originalData.grn_number} | Qty: {record.originalData.qty_received}
                      {record.stockStatus !== 'unknown' && (
                        <> | Stock: {record.availableStock}/{record.requiredStock}</>
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
                  Consider updating stock levels or adjusting quantities before processing.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="corrections" className="space-y-4">
            {editingRecord !== null && selectedRecord && (
              <Card>
                <CardHeader>
                  <CardTitle>Edit Record {editingRecord + 1}</CardTitle>
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
                      <Label htmlFor="grn-number">GRN Number</Label>
                      <Input
                        id="grn-number"
                        value={correctionData.grn_number || ''}
                        onChange={(e) => setCorrectionData({
                          ...correctionData,
                          grn_number: e.target.value
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={correctionData.qty_received || ''}
                        onChange={(e) => setCorrectionData({
                          ...correctionData,
                          qty_received: e.target.value
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="vendor">Vendor</Label>
                      <Input
                        id="vendor"
                        value={correctionData.vendor || ''}
                        onChange={(e) => setCorrectionData({
                          ...correctionData,
                          vendor: e.target.value
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
              {debugAnalysis.records.filter(r => r.status === 'corrected').length} records have been corrected and are ready for reprocessing.
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
