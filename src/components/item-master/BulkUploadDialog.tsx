
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle, Info, ArrowRight } from "lucide-react";
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
    const csvContent = `Item_Code,Item_Name,Category_Name,Qualifier,GSM,Size_MM,UOM,Usage_Type,Specifications
BOPP-FILM-20-20,BOPP Film 20 Micron,Raw Materials,Premium,20,1000mm,KG,RAW_MATERIAL,High clarity BOPP film for lamination
PE-WRAP-80,PE Wrapper Film,Raw Materials,Standard,80,,MTR,RAW_MATERIAL,Low density polyethylene wrapper
ADH-LAM-IND,Lamination Adhesive,Chemicals,Industrial,,5L,LTR,CONSUMABLE,Two-component polyurethane adhesive
PKG-BOX-200,Packaging Box,Packaging,,200,300x200x100mm,PCS,PACKAGING,Corrugated cardboard shipping box
CYL-PEG-STD,Cylinder Peg Coating,Consumables,Standard,,"1125X518",PCS,CONSUMABLE,Peg coating for cylinders
DOC-BLD-015,Doctor Blades,Consumables,,"0.15",0.15MM,PCS,CONSUMABLE,Precision doctor blades
COR-BOX-235,Corrugated Box,Packaging,,"235","235PCS",BOX,PACKAGING,Corrugated boxes for shipping`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'item_master_bulk_upload_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const validateFile = (selectedFile: File): boolean => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please select a CSV file",
        variant: "destructive"
      });
      return false;
    }

    if (selectedFile.size > 50 * 1024 * 1024) { // 50MB limit
      toast({
        title: "File too large",
        description: "Please select a file smaller than 50MB",
        variant: "destructive"
      });
      return false;
    }

    if (selectedFile.size === 0) {
      toast({
        title: "Empty file",
        description: "The selected file appears to be empty",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && validateFile(selectedFile)) {
      setFile(selectedFile);
      toast({
        title: "File selected",
        description: `${selectedFile.name} is ready for upload`,
      });
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Items</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Enhanced Data Format Guide */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p><strong>✨ Smart Data Transformation:</strong> This system automatically transforms your data:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-sm">
                  <div className="space-y-2">
                    <p className="font-medium text-green-700">📦 UOM Transformations:</p>
                    <ul className="space-y-1 text-xs">
                      <li><code>nos/Nos</code> <ArrowRight className="w-3 h-3 inline mx-1" /> <Badge variant="outline" className="text-xs">PCS</Badge></li>
                      <li><code>boxes/Boxes</code> <ArrowRight className="w-3 h-3 inline mx-1" /> <Badge variant="outline" className="text-xs">BOX</Badge></li>
                      <li><code>metre/Metre</code> <ArrowRight className="w-3 h-3 inline mx-1" /> <Badge variant="outline" className="text-xs">MTR</Badge></li>
                      <li><code>kg</code> <ArrowRight className="w-3 h-3 inline mx-1" /> <Badge variant="outline" className="text-xs">KG</Badge></li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-blue-700">🏷️ Usage Type Mappings:</p>
                    <ul className="space-y-1 text-xs">
                      <li><code>Hot Melt</code> <ArrowRight className="w-3 h-3 inline mx-1" /> <Badge variant="secondary" className="text-xs">RAW_MATERIAL</Badge></li>
                      <li><code>General</code> <ArrowRight className="w-3 h-3 inline mx-1" /> <Badge variant="secondary" className="text-xs">CONSUMABLE</Badge></li>
                      <li><code>Wrapper</code> <ArrowRight className="w-3 h-3 inline mx-1" /> <Badge variant="secondary" className="text-xs">RAW_MATERIAL</Badge></li>
                      <li><code>Packaging</code> <ArrowRight className="w-3 h-3 inline mx-1" /> <Badge variant="secondary" className="text-xs">PACKAGING</Badge></li>
                    </ul>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <strong>📝 GSM Parsing:</strong> Extracts numbers from mixed values (e.g., "20GSM" → 20, "0.15MM" → 0.15)
                </p>
              </div>
            </AlertDescription>
          </Alert>

          {/* Template Download */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Step 1: Download Enhanced Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Download the CSV template for manual item code upload. You provide the Item_Code, and the system will use it directly without auto-generation.
              </p>
              <div className="space-y-4">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Enhanced CSV Template
                </Button>
                
                {/* Enhanced Field Guide */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs border-t pt-4">
                  <div>
                    <h4 className="font-medium mb-2">Required Fields:</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• <strong>Item_Code:</strong> Your unique code (e.g., "BOPP-FILM-20-20")</li>
                      <li>• <strong>Item_Name:</strong> Product name (e.g., "BOPP Film 20 Micron")</li>
                      <li>• <strong>Category_Name:</strong> Category (auto-created if new)</li>
                      <li>• <strong>UOM:</strong> Use PCS, KG, MTR, BOX, etc.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Smart Processing:</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• <strong>Duplicates:</strong> Automatically detected and skipped</li>
                      <li>• <strong>Case insensitive:</strong> nos = Nos = NOS</li>
                      <li>• <strong>Categories:</strong> Auto-created when missing</li>
                      <li>• <strong>Error suggestions:</strong> Helpful hints for fixes</li>
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
                Step 2: Upload Your CSV File
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Input
                  type="file"
                  accept=".csv,text/csv,application/csv"
                  onChange={handleFileSelect}
                  disabled={isProcessing}
                />
                {file && (
                  <div className="mt-2 p-3 bg-muted rounded text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p><strong>Selected:</strong> {file.name}</p>
                        <p className="text-muted-foreground">Size: {(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <Badge variant="outline" className="ml-2">Ready to upload</Badge>
                    </div>
                  </div>
                )}
              </div>

              {file && !results && (
                <Button 
                  onClick={handleUpload} 
                  disabled={isProcessing || uploadMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing || uploadMutation.isPending ? (
                    <>Processing with smart transformations...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload and Process with Smart Mapping
                    </>
                  )}
                </Button>
              )}

              {(isProcessing || uploadMutation.isPending) && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-muted-foreground">
                    Processing file with smart transformations... {Math.round(progress)}%
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
                  <Badge variant="default" className="text-sm px-3 py-1">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {results.successCount} Successful
                  </Badge>
                  {results.errorCount > 0 && (
                    <Badge variant="destructive" className="text-sm px-3 py-1">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {results.errorCount} Need Attention
                    </Badge>
                  )}
                </div>

                {results.errors && results.errors.length > 0 && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    <h4 className="font-medium text-sm">Items that need attention:</h4>
                    <div className="space-y-2">
                      {results.errors.map((error: BulkUploadError, index: number) => (
                        <Alert key={index} variant="destructive" className="text-xs">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="space-y-1">
                              <p><strong>Row {error.rowNumber}:</strong> {error.reason}</p>
                              <div className="grid grid-cols-2 gap-2 text-muted-foreground mt-2">
                                {error.data?.item_name && (
                                  <p><strong>Item:</strong> {error.data.item_name}</p>
                                )}
                                {error.data?.uom && (
                                  <p><strong>UOM:</strong> {error.data.uom}</p>
                                )}
                                {error.data?.usage_type && (
                                  <p><strong>Usage Type:</strong> {error.data.usage_type}</p>
                                )}
                                {error.data?.category_name && (
                                  <p><strong>Category:</strong> {error.data.category_name}</p>
                                )}
                              </div>
                            </div>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
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
