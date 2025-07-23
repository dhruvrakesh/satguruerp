import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Download, Upload, CheckCircle, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupplierBulkUpload } from "@/hooks/useSupplierBulkUpload";

interface SupplierBulkUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierBulkUpload({ open, onOpenChange }: SupplierBulkUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  
  const { uploadMutation, isProcessing, progress } = useSupplierBulkUpload();

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
      'Contact_Person',
      'Email',
      'Phone',
      'Address',
      'City',
      'State',
      'Pincode',
      'GSTIN',
      'PAN',
      'Payment_Terms',
      'Credit_Limit',
      'Material_Categories'
    ];
    
    const sampleData = [
      'ABC Chemicals Ltd',
      'Rajesh Kumar',
      'rajesh@abcchemicals.com',
      '+91-9876543210',
      '123 Industrial Area, Sector 5',
      'Mumbai',
      'Maharashtra',
      '400001',
      '27AABCA1234F1Z5',
      'AABCA1234F',
      'NET_30',
      '100000',
      'Inks, Adhesives, Solvents'
    ];

    const csvContent = [headers.join(','), sampleData.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'supplier_bulk_upload_template.csv';
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
            <Users className="h-5 w-5" />
            Supplier Bulk Upload
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
                  {isProcessing ? 'Processing...' : 'Upload Suppliers'}
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
                      <div className="text-sm text-muted-foreground">Suppliers Added</div>
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
                <h4 className="font-medium">Required Fields:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Supplier_Name:</strong> Unique supplier name</div>
                  <div><strong>Contact_Person:</strong> Primary contact</div>
                  <div><strong>Email:</strong> Valid email address</div>
                  <div><strong>Phone:</strong> Contact number</div>
                  <div><strong>Address:</strong> Business address</div>
                </div>
                
                <h4 className="font-medium mt-4">Optional Fields:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>City:</strong> City name</div>
                  <div><strong>State:</strong> State name</div>
                  <div><strong>Pincode:</strong> Postal code</div>
                  <div><strong>GSTIN:</strong> GST number</div>
                  <div><strong>PAN:</strong> PAN number</div>
                  <div><strong>Payment_Terms:</strong> NET_30, NET_15, etc.</div>
                  <div><strong>Credit_Limit:</strong> Numeric value</div>
                  <div><strong>Material_Categories:</strong> Comma-separated</div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="instructions" className="space-y-4">
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">How Bulk Upload Works:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Each row creates a new supplier</li>
                  <li>• Supplier codes are auto-generated</li>
                  <li>• Duplicate names and emails are prevented</li>
                  <li>• All suppliers are set to ACTIVE status</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Data Validation:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Email format validation</li>
                  <li>• Phone number format validation</li>
                  <li>• Duplicate supplier name check</li>
                  <li>• Duplicate email address check</li>
                  <li>• Credit limit numeric validation</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Tips for Success:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Use the provided template</li>
                  <li>• Ensure email addresses are valid</li>
                  <li>• Include country code for phone numbers</li>
                  <li>• Remove any trailing spaces</li>
                  <li>• Use comma-separated values for material categories</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}