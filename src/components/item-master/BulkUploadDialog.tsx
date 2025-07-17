import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkUploadDialog({ open, onOpenChange }: BulkUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);

  const downloadTemplate = () => {
    const csvContent = `item_name,category_name,qualifier,gsm,size_mm,uom,usage_type,specifications
Sample Film,Raw Materials,Premium,80,100x150,MTR,RAW_MATERIAL,High quality flexible film
Packaging Box,Packaging,,200,200x300x100,PCS,PACKAGING,Corrugated cardboard box
Industrial Adhesive,Consumables,Standard,,1000ml,LTR,CONSUMABLE,High strength adhesive`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'item_master_template.csv';
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

    setUploading(true);
    setProgress(0);

    try {
      // Simulate upload progress
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      clearInterval(interval);
      setProgress(100);

      // Mock results
      setResults({
        successCount: 45,
        errorCount: 5,
        errors: [
          { rowNumber: 2, reason: "Invalid category name", data: { item_name: "Test Item" } },
          { rowNumber: 5, reason: "GSM value too high", data: { item_name: "Another Item" } },
          { rowNumber: 12, reason: "Missing required field: UOM", data: { item_name: "Third Item" } }
        ]
      });

      toast({
        title: "Upload completed",
        description: "45 items uploaded successfully, 5 errors found"
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "An error occurred during upload",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setProgress(0);
    setResults(null);
    setUploading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bulk Upload Items</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
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
                Download the CSV template with the correct format and example data.
              </p>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download CSV Template
              </Button>
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
                  disabled={uploading}
                />
                {file && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {file && !results && (
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload and Process
                    </>
                  )}
                </Button>
              )}

              {uploading && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-muted-foreground">
                    Processing file... {progress}%
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
                <div className="flex gap-4">
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
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {results.errors.map((error: any, index: number) => (
                        <Alert key={index} variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Row {error.rowNumber}: {error.reason}
                            {error.data?.item_name && ` (${error.data.item_name})`}
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