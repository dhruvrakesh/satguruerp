import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useBOMBulkUpload } from "@/hooks/useBOMBulkUpload";
import { useToast } from "@/components/ui/use-toast";

interface BOMBulkUploadDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export const BOMBulkUploadDialog: React.FC<BOMBulkUploadDialogProps> = ({
  trigger,
  onSuccess
}) => {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customerCode, setCustomerCode] = useState<string>("");
  const [bomVersion, setBomVersion] = useState<string>("1");
  const [notes, setNotes] = useState<string>("");
  
  const { uploadBOM, isUploading, uploadResult } = useBOMBulkUpload();
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a valid CSV file",
        variant: "destructive"
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to upload",
        variant: "destructive"
      });
      return;
    }

    try {
      await uploadBOM({
        file: selectedFile,
        customerCode: customerCode || undefined,
        bomVersion: parseInt(bomVersion),
        notes: notes || undefined
      });

      if (uploadResult?.successCount > 0) {
        toast({
          title: "Upload Successful",
          description: `Successfully uploaded ${uploadResult.successCount} BOM entries`,
        });
        setOpen(false);
        onSuccess?.();
      }
    } catch (error) {
      console.error('BOM upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload BOM data. Please check your file format.",
        variant: "destructive"
      });
    }
  };

  const downloadTemplate = () => {
    const csvContent = `fg_item_code,rm_item_code,quantity_required,unit_of_measure,gsm_contribution,percentage_contribution,consumption_rate,wastage_percentage,customer_code,notes
FG_WRP_001,RM_PET_001,14,KG,14,19,1,5,GCPL,PET Film Layer
FG_WRP_001,RM_PAPER_001,40,KG,40,55,1,3,GCPL,Paper Base Layer
FG_WRP_001,RM_CHEM_001,5.2,KG,5.2,7,1,2,GCPL,Chemical Additive
FG_WRP_001,RM_INK_001,1,KG,1,1,1,1,GCPL,Orange Ink
FG_WRP_001,RM_ADH_001,2,KG,2,3,1,2,GCPL,Adhesive
FG_WRP_001,RM_GRAN_001,10,KG,10,14,1,5,GCPL,HMA Granules`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bom_upload_template.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload BOM
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload BOM Data</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Form */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upload Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="file-upload">CSV File</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="mt-1"
                  />
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="customer-code">Customer Code (Optional)</Label>
                  <Select value={customerCode} onValueChange={setCustomerCode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer or leave blank for generic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GCPL">GCPL</SelectItem>
                      <SelectItem value="RB">Reckitt Benckiser</SelectItem>
                      <SelectItem value="HUL">Hindustan Unilever</SelectItem>
                      <SelectItem value="ITC">ITC Limited</SelectItem>
                      <SelectItem value="PATANJALI">Patanjali</SelectItem>
                      <SelectItem value="ANCHOR">Anchor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="bom-version">BOM Version</Label>
                  <Input
                    id="bom-version"
                    type="number"
                    value={bomVersion}
                    onChange={(e) => setBomVersion(e.target.value)}
                    min="1"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes about this BOM upload..."
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || isUploading}
                    className="flex-1"
                  >
                    {isUploading ? "Uploading..." : "Upload BOM Data"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={downloadTemplate}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Template
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Upload Results */}
            {uploadResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Upload Results
                    {uploadResult.errorCount === 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 mb-4">
                    <Badge variant="outline" className="bg-green-50">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Success: {uploadResult.successCount}
                    </Badge>
                    {uploadResult.errorCount > 0 && (
                      <Badge variant="outline" className="bg-red-50">
                        <XCircle className="h-3 w-3 mr-1" />
                        Errors: {uploadResult.errorCount}
                      </Badge>
                    )}
                  </div>

                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {uploadResult.errors.slice(0, 5).map((error, index) => (
                        <Alert key={index} variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Row {error.rowNumber}: {error.reason}
                          </AlertDescription>
                        </Alert>
                      ))}
                      {uploadResult.errors.length > 5 && (
                        <p className="text-sm text-muted-foreground">
                          ...and {uploadResult.errors.length - 5} more errors
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Instructions */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">CSV Format Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Required Columns:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• <strong>fg_item_code</strong> - Must exist in Item Master</li>
                    <li>• <strong>rm_item_code</strong> - Must exist in Item Master</li>
                    <li>• <strong>quantity_required</strong> - Numeric value</li>
                    <li>• <strong>unit_of_measure</strong> - KG, MT, PCS, etc.</li>
                    <li>• <strong>gsm_contribution</strong> - GSM contribution of RM</li>
                    <li>• <strong>percentage_contribution</strong> - % of total GSM</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Optional Columns:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• <strong>consumption_rate</strong> - Default: 1</li>
                    <li>• <strong>wastage_percentage</strong> - Default: 0</li>
                    <li>• <strong>customer_code</strong> - Customer specific variant</li>
                    <li>• <strong>notes</strong> - Additional notes</li>
                  </ul>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Make sure all FG and RM item codes exist in your Item Master before uploading.
                    The system will validate all codes and reject invalid entries.
                  </AlertDescription>
                </Alert>

                <div>
                  <h4 className="font-medium mb-2">Validation Rules:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Total percentage contribution should be 95-105%</li>
                    <li>• GSM contributions should match percentages</li>
                    <li>• No duplicate RM items per FG-customer combination</li>
                    <li>• All quantities must be positive numbers</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};