import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUpload } from '@/components/ui/file-upload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Download, Upload, AlertCircle } from 'lucide-react';
import { useVendorPriceListBulkUpload } from '@/hooks/useVendorPriceListBulkUpload';

interface VendorPriceListBulkUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VendorPriceListBulkUpload({ open, onOpenChange }: VendorPriceListBulkUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  
  const { uploadMutation, isProcessing, progress, downloadTemplate } = useVendorPriceListBulkUpload();

  const handleFileChange = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
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

  const resetUpload = () => {
    setFile(null);
    setUploadResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vendor Price List Bulk Upload</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">Upload CSV</TabsTrigger>
            <TabsTrigger value="template">Download Template</TabsTrigger>
            <TabsTrigger value="instructions">Instructions</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            {!uploadResult && (
              <div className="space-y-4">
                <FileUpload
                  onFilesSelected={handleFileChange}
                  accept=".csv"
                  className="min-h-[200px]"
                />

                {file && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        onClick={handleUpload}
                        disabled={isProcessing}
                        className="flex items-center gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        {isProcessing ? 'Processing...' : 'Upload'}
                      </Button>
                    </div>

                    {isProcessing && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Processing vendor price lists...</span>
                          <span className="text-sm font-medium">{progress}%</span>
                        </div>
                        <Progress value={progress} className="w-full" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {uploadResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 p-4 border rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">Successful</p>
                      <p className="text-2xl font-bold text-green-600">{uploadResult.successCount}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-4 border rounded-lg">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="font-medium">Failed</p>
                      <p className="text-2xl font-bold text-red-600">{uploadResult.errorCount}</p>
                    </div>
                  </div>
                </div>

                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-red-600">Errors Found:</h4>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {uploadResult.errors.slice(0, 10).map((error: any, index: number) => (
                        <Alert key={index} variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <span className="font-medium">Row {error.rowNumber}:</span> {error.error}
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

                <div className="flex gap-2">
                  <Button onClick={resetUpload} variant="outline">
                    Upload Another File
                  </Button>
                  <Button onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="template" className="space-y-4">
            <div className="text-center space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Download CSV Template</h3>
                <p className="text-muted-foreground">
                  Download the template file to see the required format for vendor price list upload.
                </p>
              </div>

              <Button onClick={downloadTemplate} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download Template
              </Button>

              <div className="mt-6 text-left">
                <h4 className="font-medium mb-3">Required Columns:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">supplier_name</Badge>
                    <span className="text-red-500">*</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">supplier_code</Badge>
                    <span className="text-gray-500">(alternative to supplier_name)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">item_code</Badge>
                    <span className="text-red-500">*</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">unit_price</Badge>
                    <span className="text-red-500">*</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">currency</Badge>
                    <span className="text-gray-500">(default: INR)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">effective_from</Badge>
                    <span className="text-gray-500">(YYYY-MM-DD format)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">effective_to</Badge>
                    <span className="text-gray-500">(optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">minimum_order_quantity</Badge>
                    <span className="text-gray-500">(default: 1)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">lead_time_days</Badge>
                    <span className="text-gray-500">(default: 7)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">discount_percentage</Badge>
                    <span className="text-gray-500">(optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">payment_terms</Badge>
                    <span className="text-gray-500">(optional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">validity_days</Badge>
                    <span className="text-gray-500">(default: 30)</span>
                  </div>
                </div>
                <p className="text-sm text-red-500 mt-2">* Required fields</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="instructions" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Vendor Price List Upload Instructions</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Upload vendor pricing information for items in bulk using CSV files</p>
                  <p>• The system will automatically link items to existing suppliers in the database</p>
                  <p>• Existing price records will be updated based on supplier, item code, and effective date</p>
                  <p>• Use either supplier_name or supplier_code to identify suppliers</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Data Validation:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Supplier must exist in the system</li>
                  <li>• Item code is required and cannot be empty</li>
                  <li>• Unit price must be a valid positive number</li>
                  <li>• Dates must be in YYYY-MM-DD format</li>
                  <li>• Effective from date cannot be in the past</li>
                  <li>• Minimum order quantity must be a positive number</li>
                  <li>• Lead time must be a positive integer</li>
                  <li>• Discount percentage must be between 0 and 100</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Best Practices:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Keep file size under 5MB for optimal performance</li>
                  <li>• Use the template file to ensure correct format</li>
                  <li>• Validate data before uploading to avoid errors</li>
                  <li>• Set appropriate effective dates for pricing</li>
                  <li>• Include payment terms for better vendor management</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}