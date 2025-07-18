
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useBulkUpload } from "@/hooks/useBulkUpload";
import { BulkUploadError } from "@/types";

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkUploadDialog({ open, onOpenChange }: BulkUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<any>(null);
  const { uploadMutation, isProcessing, progress } = useBulkUpload();

  const downloadTemplate = () => {
    const csvContent = `item_name,category_name,qualifier,gsm,size_mm,uom,usage_type,specifications
BOPP Film 20 Micron,Raw Materials,Premium,20,1000mm,KG,Raw Material,High clarity BOPP film for lamination
PE Wrapper Film,Raw Materials,Standard,80,,MTR,Wrapper,Low density polyethylene wrapper
Lamination Adhesive,Chemicals,Industrial,,5L,LTR,Consumable,Two-component polyurethane adhesive
Packaging Box,Packaging,,200,300x200x100mm,PCS,Packaging,Corrugated cardboard shipping box`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'item_master_bulk_upload_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Invalid file type",
          description: "Please select a CSV file",
          variant: "destructive"
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      const result = await uploadMutation.mutateAsync(file);
      setResults(result);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const resetUpload = () => {
    setFile(null);
    setResults(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Items</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Data Format Guide */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> This system automatically transforms your data:
              <ul className="mt-2 ml-4 list-disc text-sm">
                <li><strong>UOM:</strong> Converts kg→KG, pcs→PCS, mtr→MTR, etc.</li>
                <li><strong>Usage Type:</strong> Maps "Wrapper"→RAW_MATERIAL, "Packaging"→PACKAGING</li>
                <li><strong>GSM:</strong> Extracts numbers from mixed values (e.g., "20GSM" → 20)</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Template Download */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Step 1: Download Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Download the CSV template with the correct format and example data. The template includes samples for different item types.
              </p>
              <div className="space-y-4">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV Template
                </Button>
                
                {/* Field Guide */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <h4 className="font-medium mb-2">Required Fields:</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• <strong>item_name:</strong> Product name</li>
                      <li>• <strong>category_name:</strong> Category (auto-created if new)</li>
                      <li>• <strong>uom:</strong> kg, pcs, mtr, sqm, ltr, box, roll</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Optional Fields:</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• <strong>qualifier:</strong> Grade/quality</li>
                      <li>• <strong>gsm:</strong> Thickness/weight</li>
                      <li>• <strong>size_mm:</strong> Dimensions</li>
                      <li>• <strong>usage_type:</strong> Raw Material, Packaging, etc.</li>
                      <li>• <strong>specifications:</strong> Additional details</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Step 2: Upload Your File
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  disabled={isProcessing}
                />
                {file && (
                  <div className="mt-2 p-2 bg-muted rounded text-sm">
                    <p><strong>Selected:</strong> {file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
                  </div>
                )}
              </div>

              {file && !results && (
                <Button 
                  onClick={handleUpload} 
                  disabled={isProcessing || uploadMutation.isPending}
                  className="w-full"
                >
                  {isProcessing || uploadMutation.isPending ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload and Process
                    </>
                  )}
                </Button>
              )}

              {(isProcessing || uploadMutation.isPending) && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-muted-foreground">
                    Processing file... {Math.round(progress)}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {results && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Upload Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 flex-wrap">
                  <Badge variant="default" className="text-sm">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {results.successCount} Successful
                  </Badge>
                  {results.errorCount > 0 && (
                    <Badge variant="destructive" className="text-sm">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {results.errorCount} Errors
                    </Badge>
                  )}
                </div>

                {results.errors && results.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Errors found:</h4>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {results.errors.map((error: BulkUploadError, index: number) => (
                        <Alert key={index} variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            <div className="space-y-1">
                              <p><strong>Row {error.rowNumber}:</strong> {error.reason}</p>
                              {error.data?.item_name && (
                                <p className="text-muted-foreground">Item: {error.data.item_name}</p>
                              )}
                              {error.data?.uom && (
                                <p className="text-muted-foreground">UOM: {error.data.uom}</p>
                              )}
                              {error.data?.usage_type && (
                                <p className="text-muted-foreground">Usage Type: {error.data.usage_type}</p>
                              )}
                            </div>
                          </AlertDescription>
                        </Alert>
                      ))}
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
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
