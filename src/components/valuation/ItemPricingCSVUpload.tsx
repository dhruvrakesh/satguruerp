import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw,
  Eye,
  ThumbsUp,
  ThumbsDown,
  FileSpreadsheet,
  Loader2
} from "lucide-react";
import { useDropzone } from 'react-dropzone';
import { toast } from "@/hooks/use-toast";
import { useItemPricingBulkUpload, PricingUploadRecord } from "@/hooks/useItemPricingBulkUpload";

interface ItemPricingCSVUploadProps {
  onUploadComplete?: () => void;
}

export function ItemPricingCSVUpload({ onUploadComplete }: ItemPricingCSVUploadProps) {
  const [reviewRecord, setReviewRecord] = useState<PricingUploadRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  
  const {
    uploadSession,
    uploadRecords,
    progress,
    isUploading,
    processCSVFile,
    downloadTemplate,
    approveRecord,
    rejectRecord,
    bulkApproveAll,
    resetUpload
  } = useItemPricingBulkUpload();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file only.",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive"
      });
      return;
    }

    processCSVFile(file);
  }, [processCSVFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    multiple: false,
    disabled: isUploading
  });

  const handleApproveRecord = async () => {
    if (!reviewRecord?.id) return;
    
    await approveRecord(reviewRecord.id, reviewNotes);
    setReviewRecord(null);
    setReviewNotes('');
  };

  const handleRejectRecord = async () => {
    if (!reviewRecord?.id || !reviewNotes.trim()) {
      toast({
        title: "Review Notes Required",
        description: "Please provide a reason for rejection.",
        variant: "destructive"
      });
      return;
    }
    
    await rejectRecord(reviewRecord.id, reviewNotes);
    setReviewRecord(null);
    setReviewNotes('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="default" className="gap-1"><CheckCircle className="w-3 h-3" />Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Rejected</Badge>;
      case 'REQUIRES_REVIEW':
        return <Badge variant="secondary" className="gap-1"><AlertTriangle className="w-3 h-3" />Review</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><RefreshCw className="w-3 h-3" />Pending</Badge>;
    }
  };

  const getPriceChangeIndicator = (percentage?: number) => {
    if (!percentage) return null;
    
    const isIncrease = percentage > 0;
    const color = Math.abs(percentage) > 100 ? 'text-red-500' : 
                  Math.abs(percentage) > 50 ? 'text-orange-500' : 
                  'text-green-500';
    
    return (
      <span className={`text-sm font-medium ${color}`}>
        {isIncrease ? '↗' : '↘'} {Math.abs(percentage).toFixed(1)}%
      </span>
    );
  };

  if (!uploadSession && !progress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Bulk Price Upload
          </CardTitle>
          <CardDescription>
            Upload CSV files to update item prices in bulk with enterprise-grade validation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Area */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg font-medium">Drop your CSV file here...</p>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-medium">Drag & drop your CSV file here</p>
                <p className="text-muted-foreground">or click to browse</p>
                <p className="text-sm text-muted-foreground">Maximum file size: 10MB</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download Template
            </Button>
            <Button
              variant="outline"
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              View Instructions
            </Button>
          </div>

          {/* Instructions */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>CSV Format Requirements:</strong>
              <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                <li>Required columns: Item Code, Proposed Price</li>
                <li>Optional columns: Cost Category, Supplier, Effective Date, Change Reason</li>
                <li>Price changes exceeding 50% will require manual review</li>
                <li>All item codes must exist in the item master</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (progress && progress.stage !== 'COMPLETED') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing Upload
          </CardTitle>
          <CardDescription>{progress.message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progress.percentage} className="w-full" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{progress.stage}</span>
            <span>{progress.percentage.toFixed(0)}%</span>
          </div>
          {progress.currentRecord && progress.totalRecords && (
            <div className="text-sm text-muted-foreground">
              Processing record {progress.currentRecord} of {progress.totalRecords}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Upload Complete
            </CardTitle>
            <Button variant="outline" size="sm" onClick={resetUpload}>
              Upload New File
            </Button>
          </div>
          <CardDescription>
            File: {uploadSession?.filename} • {uploadSession?.total_records} records processed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{uploadSession?.approved_records}</div>
              <div className="text-sm text-green-600">Auto-Approved</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{uploadSession?.pending_records}</div>
              <div className="text-sm text-orange-600">Needs Review</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{uploadSession?.rejected_records}</div>
              <div className="text-sm text-red-600">Rejected</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{uploadSession?.total_records}</div>
              <div className="text-sm text-blue-600">Total Records</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {uploadRecords.filter(r => r.validation_status === 'REQUIRES_REVIEW').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bulk Actions</CardTitle>
            <CardDescription>
              Manage records that require review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button onClick={bulkApproveAll} className="gap-2">
                <ThumbsUp className="w-4 h-4" />
                Approve All Pending
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Results</CardTitle>
          <CardDescription>
            Review and manage individual price update records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Item Code</TableHead>
                <TableHead>Current Price</TableHead>
                <TableHead>Proposed Price</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploadRecords.map((record) => (
                <TableRow key={record.id || record.row_number}>
                  <TableCell>{record.row_number}</TableCell>
                  <TableCell className="font-medium">{record.item_code}</TableCell>
                  <TableCell>₹{record.current_price?.toFixed(2) || 'N/A'}</TableCell>
                  <TableCell>₹{record.proposed_price.toFixed(2)}</TableCell>
                  <TableCell>
                    {getPriceChangeIndicator(record.price_change_percentage)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(record.validation_status)}
                  </TableCell>
                  <TableCell>
                    {record.validation_errors && record.validation_errors.length > 0 && (
                      <Badge variant="destructive" className="mr-1">
                        {record.validation_errors.length} Error(s)
                      </Badge>
                    )}
                    {record.validation_warnings && record.validation_warnings.length > 0 && (
                      <Badge variant="secondary">
                        {record.validation_warnings.length} Warning(s)
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" onClick={() => setReviewRecord(record)}>
                            <Eye className="w-3 h-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Review Price Update</DialogTitle>
                            <DialogDescription>
                              Row {record.row_number}: {record.item_code}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Current Price</Label>
                                <div className="text-lg font-medium">₹{record.current_price?.toFixed(2) || 'N/A'}</div>
                              </div>
                              <div>
                                <Label>Proposed Price</Label>
                                <div className="text-lg font-medium">₹{record.proposed_price.toFixed(2)}</div>
                              </div>
                            </div>
                            
                            {record.price_change_percentage && (
                              <div>
                                <Label>Price Change</Label>
                                <div className="text-lg font-medium">
                                  {getPriceChangeIndicator(record.price_change_percentage)}
                                </div>
                              </div>
                            )}

                            {record.validation_errors && record.validation_errors.length > 0 && (
                              <div>
                                <Label className="text-red-600">Validation Errors</Label>
                                <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                                  {record.validation_errors.map((error, i) => (
                                    <li key={i}>{error}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {record.validation_warnings && record.validation_warnings.length > 0 && (
                              <div>
                                <Label className="text-orange-600">Warnings</Label>
                                <ul className="list-disc list-inside text-sm text-orange-600 space-y-1">
                                  {record.validation_warnings.map((warning, i) => (
                                    <li key={i}>{warning}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {record.validation_status === 'REQUIRES_REVIEW' && (
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="reviewNotes">Review Notes</Label>
                                  <Textarea
                                    id="reviewNotes"
                                    placeholder="Enter review notes..."
                                    value={reviewNotes}
                                    onChange={(e) => setReviewNotes(e.target.value)}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    onClick={handleApproveRecord}
                                    className="gap-2"
                                  >
                                    <ThumbsUp className="w-4 h-4" />
                                    Approve
                                  </Button>
                                  <Button 
                                    variant="destructive"
                                    onClick={handleRejectRecord}
                                    className="gap-2"
                                  >
                                    <ThumbsDown className="w-4 h-4" />
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}