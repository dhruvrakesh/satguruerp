import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Download, Upload, CheckCircle, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReorderRulesBulkUpload } from "@/hooks/useReorderRulesBulkUpload";

interface ReorderRulesBulkUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReorderRulesBulkUpload({ open, onOpenChange }: ReorderRulesBulkUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  
  const { uploadMutation, isProcessing, progress } = useReorderRulesBulkUpload();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      const result = await uploadMutation.mutateAsync(file);
      setUploadResult(result);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'Item_Code',
      'Supplier_Name',
      'Minimum_Stock_Level',
      'Reorder_Quantity',
      'Safety_Stock_Level',
      'Consumption_Rate_Per_Day',
      'Lead_Time_Days'
    ];
    
    const sampleData = [
      'RM_INK_001',
      'ABC Chemicals Ltd',
      '100',
      '500',
      '50',
      '10',
      '7'
    ];

    const csvContent = [headers.join(','), sampleData.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reorder_rules_bulk_upload_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Reorder Rules Bulk Upload
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">Upload CSV</TabsTrigger>
            <TabsTrigger value="template">Download Template</TabsTrigger>
            <TabsTrigger value="instructions">Instructions</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="csvFile">Select CSV File</Label>
                <Input
                  id="csvFile"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                />
              </div>

              {file && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Selected file: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </AlertDescription>
                </Alert>
              )}

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Processing...</span>
                    <span className="text-sm text-muted-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={handleUpload}
                  disabled={!file || isProcessing}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isProcessing ? 'Processing...' : 'Upload Reorder Rules'}
                </Button>
              </div>

              {uploadResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Upload Complete</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{uploadResult.successCount}</div>
                      <div className="text-sm text-muted-foreground">Rules Created</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{uploadResult.errorCount}</div>
                      <div className="text-sm text-muted-foreground">Errors</div>
                    </div>
                  </div>

                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Errors Found:</h4>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {uploadResult.errors.slice(0, 10).map((error: any, index: number) => (
                          <Alert key={index} variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Row {error.rowNumber}: {error.reason}
                            </AlertDescription>
                          </Alert>
                        ))}
                        {uploadResult.errors.length > 10 && (
                          <p className="text-sm text-muted-foreground">
                            ... and {uploadResult.errors.length - 10} more errors
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="template" className="space-y-4">
            <div className="space-y-4">
              <Alert>
                <Download className="h-4 w-4" />
                <AlertDescription>
                  Download the CSV template to ensure your data is formatted correctly for bulk upload.
                </AlertDescription>
              </Alert>
              
              <Button onClick={downloadTemplate} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>

              <div className="space-y-2">
                <h4 className="font-medium">Template Columns:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Item_Code:</strong> Must exist in item master</div>
                  <div><strong>Supplier_Name:</strong> Must match existing supplier</div>
                  <div><strong>Minimum_Stock_Level:</strong> Positive number</div>
                  <div><strong>Reorder_Quantity:</strong> Positive number</div>
                  <div><strong>Safety_Stock_Level:</strong> Optional, positive number</div>
                  <div><strong>Consumption_Rate_Per_Day:</strong> Optional, positive number</div>
                  <div><strong>Lead_Time_Days:</strong> Positive integer</div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="instructions" className="space-y-4">
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">How Reorder Rules Work:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Automatically trigger purchase orders when stock falls below minimum level</li>
                  <li>• Each item-supplier combination gets one reorder rule</li>
                  <li>• Safety stock provides buffer for demand fluctuations</li>
                  <li>• Lead time affects when reorder is triggered</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Data Validation:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Item code must exist in item master</li>
                  <li>• Supplier must exist and be active</li>
                  <li>• All quantities must be positive numbers</li>
                  <li>• Lead time must be positive integer</li>
                  <li>• Reorder quantity should be greater than minimum stock level</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Best Practices:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Set minimum stock level to cover lead time demand</li>
                  <li>• Add safety stock for critical items</li>
                  <li>• Review consumption rates monthly</li>
                  <li>• Consider seasonal demand variations</li>
                  <li>• Match supplier lead times with actual delivery performance</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}