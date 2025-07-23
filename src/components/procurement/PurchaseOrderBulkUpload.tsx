import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Download, Upload, CheckCircle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePurchaseOrderBulkUpload } from "@/hooks/usePurchaseOrderBulkUpload";

interface PurchaseOrderBulkUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseOrderBulkUpload({ open, onOpenChange }: PurchaseOrderBulkUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  
  const { uploadMutation, isProcessing, progress } = usePurchaseOrderBulkUpload();

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
      'Supplier_Name',
      'PO_Date',
      'Item_Code', 
      'Quantity',
      'Unit_Price',
      'Remarks',
      'Expected_Delivery_Date'
    ];
    
    const sampleData = [
      'ABC Suppliers Ltd',
      '2024-01-15',
      'RM_INK_001',
      '100',
      '50.00',
      'Urgent requirement',
      '2024-01-25'
    ];

    const csvContent = [headers.join(','), sampleData.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'purchase_order_bulk_upload_template.csv';
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
            <FileText className="h-5 w-5" />
            Purchase Order Bulk Upload
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
                  {isProcessing ? 'Processing...' : 'Upload Purchase Orders'}
                </Button>
              </div>

              {uploadResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Upload Complete</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{uploadResult.createdPOs?.length || 0}</div>
                      <div className="text-sm text-muted-foreground">POs Created</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{uploadResult.successCount}</div>
                      <div className="text-sm text-muted-foreground">Line Items</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{uploadResult.errorCount}</div>
                      <div className="text-sm text-muted-foreground">Errors</div>
                    </div>
                  </div>

                  {uploadResult.createdPOs && uploadResult.createdPOs.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Created Purchase Orders:</h4>
                      <div className="flex flex-wrap gap-1">
                        {uploadResult.createdPOs.map((poNumber: string) => (
                          <Badge key={poNumber} variant="secondary">
                            {poNumber}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

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
                  <div><strong>Supplier_Name:</strong> Must match existing supplier</div>
                  <div><strong>PO_Date:</strong> YYYY-MM-DD format</div>
                  <div><strong>Item_Code:</strong> Must exist in item master</div>
                  <div><strong>Quantity:</strong> Positive number</div>
                  <div><strong>Unit_Price:</strong> Positive number</div>
                  <div><strong>Remarks:</strong> Optional notes</div>
                  <div><strong>Expected_Delivery_Date:</strong> Optional, YYYY-MM-DD</div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="instructions" className="space-y-4">
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">How Bulk Upload Works:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Rows with same supplier and PO date are grouped into one Purchase Order</li>
                  <li>• Each row becomes a line item in the PO</li>
                  <li>• Supplier names must match existing suppliers exactly</li>
                  <li>• Item codes must exist in the item master</li>
                  <li>• PO numbers are auto-generated</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Data Validation:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Supplier existence check</li>
                  <li>• Item code validation</li>
                  <li>• Quantity and price validation (positive numbers)</li>
                  <li>• Date format validation</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Tips for Success:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Use the provided template</li>
                  <li>• Ensure supplier names are spelled correctly</li>
                  <li>• Verify item codes before upload</li>
                  <li>• Use YYYY-MM-DD date format</li>
                  <li>• Check for trailing spaces in text fields</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}