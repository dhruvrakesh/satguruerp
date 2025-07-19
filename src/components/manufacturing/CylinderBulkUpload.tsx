import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

interface CylinderBulkUploadProps {
  onClose: () => void;
}

interface UploadResult {
  successCount: number;
  errorCount: number;
  errors: Array<{
    rowNumber: number;
    data: any;
    error: string;
    category: string;
  }>;
}

export function CylinderBulkUpload({ onClose }: CylinderBulkUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const { toast } = useToast();

  const downloadTemplate = () => {
    const templateData = [
      {
        cylinder_code: "CYL-001-RED-2025-001",
        cylinder_name: "Red Cylinder 001",
        item_code: "FG001",
        colour: "RED",
        cylinder_size: "320",
        type: "GRAVURE",
        manufacturer: "Cylinder Corp",
        location: "STORE-A",
        mileage_m: "0",
        last_run: "2025-01-01",
        remarks: "New cylinder"
      }
    ];

    const csv = Papa.unparse(templateData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cylinder_upload_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "CSV template has been downloaded successfully.",
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setResult(null);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a valid CSV file.",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      // Parse CSV file
      const csvText = await file.text();
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          setProgress(25);

          if (results.errors.length > 0) {
            toast({
              title: "CSV Parse Error",
              description: "There were errors parsing the CSV file.",
              variant: "destructive",
            });
            setUploading(false);
            return;
          }

          setProgress(50);

          try {
            // Call the database function
            const { data, error } = await supabase.rpc('upsert_satguru_cylinders_from_csv', {
              csv_data: JSON.parse(JSON.stringify(results.data))
            });

            setProgress(100);

            if (error) {
              throw error;
            }

            const uploadResult = data as unknown as UploadResult;
            setResult(uploadResult);

            if (uploadResult.errorCount === 0) {
              toast({
                title: "Upload Successful",
                description: `Successfully uploaded ${uploadResult.successCount} cylinders.`,
              });
            } else {
              toast({
                title: "Upload Completed with Errors",
                description: `${uploadResult.successCount} cylinders uploaded, ${uploadResult.errorCount} failed.`,
                variant: "destructive",
              });
            }

          } catch (error) {
            console.error('Upload error:', error);
            toast({
              title: "Upload Failed",
              description: "Failed to upload cylinder data. Please try again.",
              variant: "destructive",
            });
          }

          setUploading(false);
        },
        error: (error) => {
          console.error('CSV parse error:', error);
          toast({
            title: "CSV Parse Error",
            description: "Failed to parse CSV file. Please check the format.",
            variant: "destructive",
          });
          setUploading(false);
        }
      });

    } catch (error) {
      console.error('File read error:', error);
      toast({
        title: "File Read Error",
        description: "Failed to read the selected file.",
        variant: "destructive",
      });
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Template Download */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Download Template
          </CardTitle>
          <CardDescription>
            Download the CSV template to see the required format and columns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={downloadTemplate} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Download CSV Template
          </Button>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload CSV File
          </CardTitle>
          <CardDescription>
            Select a CSV file containing cylinder data to upload.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </div>

          {file && (
            <Alert>
              <FileText className="w-4 h-4" />
              <AlertDescription>
                Selected file: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
              </AlertDescription>
            </Alert>
          )}

          {uploading && (
            <div className="space-y-2">
              <Label>Upload Progress</Label>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground">{progress}% complete</p>
            </div>
          )}

          <div className="flex justify-between">
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1 mr-2"
            >
              {uploading ? "Uploading..." : "Upload Cylinders"}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.errorCount === 0 ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600" />
              )}
              Upload Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{result.successCount}</div>
                <div className="text-sm text-muted-foreground">Successful</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{result.errorCount}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="space-y-2">
                <Label>Error Details</Label>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {result.errors.map((error, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>
                        <strong>Row {error.rowNumber}:</strong> {error.error}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}