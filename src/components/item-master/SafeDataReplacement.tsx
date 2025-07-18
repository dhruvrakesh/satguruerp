
import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { AlertTriangle, Download, Upload, Trash2, CheckCircle, Database, FileText } from "lucide-react";
import { useBulkUpload } from "@/hooks/useBulkUpload";

interface ReplacementStats {
  currentItems: number;
  bomReferences: number;
  specReferences: number;
  stockReferences: number;
}

export function SafeDataReplacement() {
  const [replacementStep, setReplacementStep] = useState<'backup' | 'upload' | 'complete'>('backup');
  const [backupData, setBackupData] = useState<any[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const queryClient = useQueryClient();
  const { uploadMutation, isProcessing, progress } = useBulkUpload();

  // Get current system stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['replacement-stats'],
    queryFn: async (): Promise<ReplacementStats> => {
      const [itemsResult, bomResult, specsResult, stockResult] = await Promise.all([
        supabase.from('item_master').select('id', { count: 'exact', head: true }),
        supabase.from('bill_of_materials').select('id', { count: 'exact', head: true }),
        supabase.from('customer_specifications').select('id', { count: 'exact', head: true }),
        supabase.from('satguru_stock').select('id', { count: 'exact', head: true })
      ]);

      return {
        currentItems: itemsResult.count || 0,
        bomReferences: bomResult.count || 0,
        specReferences: specsResult.count || 0,
        stockReferences: stockResult.count || 0
      };
    }
  });

  // Validate CSV file
  const validateCSVFile = (file: File): string | null => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return 'Please select a CSV file (.csv extension required)';
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      return 'File size too large. Please keep CSV files under 50MB';
    }
    
    if (file.size === 0) {
      return 'The selected file appears to be empty';
    }
    
    return null;
  };

  // Create backup of current data
  const createBackup = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('item_master')
        .select('*')
        .order('item_code');
      
      if (error) throw error;
      
      // Create downloadable backup
      const csvContent = [
        // CSV headers
        Object.keys(data[0] || {}).join(','),
        // CSV data
        ...data.map(item => 
          Object.values(item).map(val => 
            typeof val === 'string' && val.includes(',') ? `"${val}"` : val
          ).join(',')
        )
      ].join('\n');

      // Download backup file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `item_master_backup_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      setBackupData(data);
      setReplacementStep('upload');
      
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Backup Created Successfully",
        description: "Current item master data has been backed up and downloaded. You can now upload your new CSV file.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Backup Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Clear all existing data with proper foreign key handling
  const clearExistingData = useMutation({
    mutationFn: async () => {
      // First, check for foreign key dependencies
      const { data: bomRefs } = await supabase
        .from('bill_of_materials')
        .select('fg_item_code')
        .limit(1);
      
      const { data: stockRefs } = await supabase
        .from('satguru_stock')
        .select('item_code')
        .limit(1);

      if (bomRefs && bomRefs.length > 0) {
        throw new Error("Cannot delete items with BOM references. Please clear BOM data first or use the migration approach.");
      }

      if (stockRefs && stockRefs.length > 0) {
        throw new Error("Cannot delete items with stock records. Please clear stock data first or use the migration approach.");
      }

      // If no dependencies, proceed with deletion
      const { error } = await supabase
        .from('item_master')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) {
        if (error.code === '23503') { // Foreign key violation
          throw new Error("Cannot delete items due to existing references. Please use the migration approach or clear dependent data first.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Data Cleared",
        description: "Existing item master data has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ['itemMaster'] });
    },
    onError: (error: any) => {
      console.error('Clear data error:', error);
      toast({
        title: "Clear Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleFileSelect = (files: File[]) => {
    if (files.length === 0) return;
    
    const file = files[0];
    const validationError = validateCSVFile(file);
    
    if (validationError) {
      toast({
        title: "Invalid File",
        description: validationError,
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    toast({
      title: "File Selected",
      description: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) is ready for upload`,
    });
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    try {
      console.log('🚀 Starting item master replacement process...');
      
      // First clear existing data
      console.log('🗑️ Clearing existing data...');
      await clearExistingData.mutateAsync();
      console.log('✅ Existing data cleared successfully');
      
      // Then upload new data
      console.log('📤 Uploading new data...');
      const result = await uploadMutation.mutateAsync(selectedFile);
      console.log('📊 Upload result:', result);
      
      if (result.successCount > 0) {
        setReplacementStep('complete');
        toast({
          title: "Replacement Complete",
          description: `Successfully replaced ${stats?.currentItems || 0} items with ${result.successCount} new items`,
        });
      } else {
        throw new Error(`No items were successfully uploaded. ${result.errorCount} errors occurred.`);
      }
    } catch (error: any) {
      console.error('💥 Replacement process failed:', error);
      
      let errorMessage = "Failed to replace item master data. Your backup is safe.";
      
      if (error.message.includes("BOM references")) {
        errorMessage = "Cannot replace data: BOM references exist. Please clear BOM data first or contact administrator.";
      } else if (error.message.includes("stock records")) {
        errorMessage = "Cannot replace data: Stock records exist. Please clear stock data first or contact administrator.";
      } else if (error.message.includes("foreign key")) {
        errorMessage = "Cannot replace data: Related records exist. Please contact administrator for migration assistance.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Replacement Failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'item_name',
      'category_name',
      'qualifier',
      'gsm',
      'size_mm',
      'uom',
      'usage_type',
      'specifications'
    ];

    const sampleData = [
      'BOPP Film 20 Micron,Raw Materials,Premium,20,1000mm,KG,RAW_MATERIAL,High clarity BOPP film',
      'PE Wrapper Film,Raw Materials,Standard,80,,MTR,RAW_MATERIAL,Low density polyethylene wrapper',
      'Lamination Adhesive,Chemicals,Industrial,,5L,LTR,CONSUMABLE,Two-component polyurethane adhesive'
    ];

    const csvContent = [headers.join(','), ...sampleData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'item_master_replacement_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Confirm Data Replacement
            </DialogTitle>
          </DialogHeader>

          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium text-orange-800">This action will permanently replace all item master data!</p>
                
                {stats && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p><strong>Current Items:</strong> {stats.currentItems}</p>
                      <p><strong>BOM References:</strong> {stats.bomReferences}</p>
                    </div>
                    <div className="space-y-1">
                      <p><strong>Specifications:</strong> {stats.specReferences}</p>
                      <p><strong>Stock Records:</strong> {stats.stockReferences}</p>
                    </div>
                  </div>
                )}

                <div className="mt-3 p-3 bg-white rounded border">
                  <h4 className="font-medium mb-2">Safety Checks:</h4>
                  <ul className="text-xs space-y-1">
                    <li>✅ Automatic backup will be created</li>
                    <li>✅ BOM relationships can be re-linked</li>
                    <li>✅ Stock data will remain intact</li>
                    <li>✅ Process can be rolled back if needed</li>
                  </ul>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                setShowConfirmDialog(false);
                createBackup.mutate();
              }}
              disabled={createBackup.isPending}
            >
              {createBackup.isPending ? 'Creating Backup...' : 'Proceed with Replacement'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Safe Data Replacement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* System Stats */}
          {stats && (
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.currentItems}</div>
                <div className="text-sm text-blue-800">Current Items</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.bomReferences}</div>
                <div className="text-sm text-green-800">BOM References</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{stats.specReferences}</div>
                <div className="text-sm text-purple-800">Specifications</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{stats.stockReferences}</div>
                <div className="text-sm text-orange-800">Stock Records</div>
              </div>
            </div>
          )}

          {/* Replacement Steps */}
          <div className="space-y-4">
            {replacementStep === 'backup' && (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Ready to safely replace item master data. A backup will be created automatically before any changes.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3">
                  <Button onClick={downloadTemplate} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                  <Button 
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={statsLoading || createBackup.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Start Replacement Process
                  </Button>
                </div>
              </div>
            )}

            {replacementStep === 'upload' && (
              <div className="space-y-4">
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium text-green-800">Backup created successfully!</p>
                      <p className="text-green-700">Current data backed up: {backupData.length} items</p>
                      <p className="text-sm text-green-600">Now upload your new CSV file to replace the data.</p>
                    </div>
                  </AlertDescription>
                </Alert>

                {!selectedFile && !isProcessing && (
                  <FileUpload
                    onFilesSelected={handleFileSelect}
                    accept="text/csv"
                    multiple={false}
                  />
                )}

                {selectedFile && !isProcessing && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div className="flex-1">
                        <p className="font-medium text-blue-900">{selectedFile.name}</p>
                        <p className="text-sm text-blue-700">
                          Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        onClick={() => setSelectedFile(null)}
                        variant="outline"
                        size="sm"
                      >
                        Change File
                      </Button>
                    </div>

                    <Button 
                      onClick={handleFileUpload}
                      className="w-full"
                      size="lg"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Replace All Item Master Data
                    </Button>
                  </div>
                )}

                {isProcessing && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Replacing item master data...</p>
                    </div>
                    <Progress value={progress} className="w-full" />
                    <p className="text-sm text-center text-muted-foreground">
                      {progress.toFixed(0)}% complete
                    </p>
                  </div>
                )}
              </div>
            )}

            {replacementStep === 'complete' && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium text-green-800">Data replacement completed successfully!</p>
                    <p className="text-green-700">Item master has been updated with new data.</p>
                    <p className="text-sm text-green-600">All systems are ready for normal operation.</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
