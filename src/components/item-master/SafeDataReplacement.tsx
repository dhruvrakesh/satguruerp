
import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { AlertTriangle, Download, Upload, Trash2, CheckCircle, Database, FileText } from "lucide-react";
import { useBulkUpload } from "@/hooks/useBulkUpload";

interface ReplacementStats {
  currentItems: number;
  stockReferences: number;
  bomReferences: number;
  grnLogReferences: number;
  issueLogReferences: number;
  satguruStockReferences: number;
  satguruGrnLogReferences: number;
  satguruIssueLogReferences: number;
  specReferences: number;
  totalDependencies: number;
}

export function SafeDataReplacement() {
  const [replacementStep, setReplacementStep] = useState<'backup' | 'upload' | 'complete'>('backup');
  const [backupData, setBackupData] = useState<any[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDependencyDialog, setShowDependencyDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dependencyStats, setDependencyStats] = useState<ReplacementStats | null>(null);
  const queryClient = useQueryClient();
  const { uploadMutation, isProcessing, progress } = useBulkUpload();

  // Get comprehensive system stats including ALL dependent tables
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['replacement-stats-comprehensive'],
    queryFn: async (): Promise<ReplacementStats> => {
      console.log('🔍 Checking all foreign key dependencies...');
      
      // First get all item_codes from item_master to check dependencies
      const { data: itemMasterData, error: itemMasterError } = await supabase
        .from('item_master')
        .select('item_code');
      
      if (itemMasterError) throw itemMasterError;
      
      const itemCodes = itemMasterData.map(item => item.item_code);
      
      const [
        itemsResult,
        stockResult,
        bomResult,
        grnLogResult,
        issueLogResult,
        satguruStockResult,
        satguruGrnLogResult,
        satguruIssueLogResult,
        specsResult
      ] = await Promise.all([
        supabase.from('item_master').select('id', { count: 'exact', head: true }),
        supabase.from('stock').select('id', { count: 'exact', head: true }).in('item_code', itemCodes),
        supabase.from('bill_of_materials').select('id', { count: 'exact', head: true }).or(`fg_item_code.in.(${itemCodes.join(',')}),rm_item_code.in.(${itemCodes.join(',')})`),
        supabase.from('grn_log').select('id', { count: 'exact', head: true }).in('item_code', itemCodes),
        supabase.from('issue_log').select('id', { count: 'exact', head: true }).in('item_code', itemCodes),
        supabase.from('satguru_stock').select('id', { count: 'exact', head: true }).in('item_code', itemCodes),
        supabase.from('satguru_grn_log').select('id', { count: 'exact', head: true }).in('item_code', itemCodes),
        supabase.from('satguru_issue_log').select('id', { count: 'exact', head: true }).in('item_code', itemCodes),
        supabase.from('customer_specifications').select('id', { count: 'exact', head: true }).in('item_code', itemCodes)
      ]);

      const stats = {
        currentItems: itemsResult.count || 0,
        stockReferences: stockResult.count || 0,
        bomReferences: bomResult.count || 0,
        grnLogReferences: grnLogResult.count || 0,
        issueLogReferences: issueLogResult.count || 0,
        satguruStockReferences: satguruStockResult.count || 0,
        satguruGrnLogReferences: satguruGrnLogResult.count || 0,
        satguruIssueLogReferences: satguruIssueLogResult.count || 0,
        specReferences: specsResult.count || 0,
        totalDependencies: 0
      };

      stats.totalDependencies = stats.stockReferences + stats.bomReferences + 
        stats.grnLogReferences + stats.issueLogReferences + 
        stats.satguruStockReferences + stats.satguruGrnLogReferences + 
        stats.satguruIssueLogReferences + stats.specReferences;

      console.log('📊 Comprehensive dependency stats:', stats);
      return stats;
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
      console.log('💾 Creating comprehensive backup...');
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

  // Comprehensive clearing of ALL dependent data
  const clearAllDependentData = useMutation({
    mutationFn: async () => {
      console.log('🧹 Starting comprehensive dependent data cleanup...');
      
      // First get all item_codes from item_master
      const { data: itemMasterData, error: itemMasterError } = await supabase
        .from('item_master')
        .select('item_code');
      
      if (itemMasterError) throw itemMasterError;
      
      const itemCodes = itemMasterData.map(item => item.item_code);
      console.log(`🔍 Found ${itemCodes.length} item codes to clear dependencies for`);

      // Delete dependent data in correct order (child records first)
      const clearingSteps = [
        {
          name: 'Issue Log Records',
          action: async () => {
            const { error } = await supabase
              .from('issue_log')
              .delete()
              .in('item_code', itemCodes);
            if (error) throw new Error(`Failed to clear Issue Log: ${error.message}`);
          }
        },
        {
          name: 'GRN Log Records',
          action: async () => {
            const { error } = await supabase
              .from('grn_log')
              .delete()
              .in('item_code', itemCodes);
            if (error) throw new Error(`Failed to clear GRN Log: ${error.message}`);
          }
        },
        {
          name: 'Satguru Issue Log Records',
          action: async () => {
            const { error } = await supabase
              .from('satguru_issue_log')
              .delete()
              .in('item_code', itemCodes);
            if (error) throw new Error(`Failed to clear Satguru Issue Log: ${error.message}`);
          }
        },
        {
          name: 'Satguru GRN Log Records',
          action: async () => {
            const { error } = await supabase
              .from('satguru_grn_log')
              .delete()
              .in('item_code', itemCodes);
            if (error) throw new Error(`Failed to clear Satguru GRN Log: ${error.message}`);
          }
        },
        {
          name: 'Bill of Materials',
          action: async () => {
            const { error } = await supabase
              .from('bill_of_materials')
              .delete()
              .or(`fg_item_code.in.(${itemCodes.join(',')}),rm_item_code.in.(${itemCodes.join(',')})`);
            if (error) throw new Error(`Failed to clear BOM: ${error.message}`);
          }
        },
        {
          name: 'Stock Records',
          action: async () => {
            const { error } = await supabase
              .from('stock')
              .delete()
              .in('item_code', itemCodes);
            if (error) throw new Error(`Failed to clear Stock: ${error.message}`);
          }
        },
        {
          name: 'Satguru Stock Records',
          action: async () => {
            const { error } = await supabase
              .from('satguru_stock')
              .delete()
              .in('item_code', itemCodes);
            if (error) throw new Error(`Failed to clear Satguru Stock: ${error.message}`);
          }
        },
        {
          name: 'Customer Specifications',
          action: async () => {
            const { error } = await supabase
              .from('customer_specifications')
              .delete()
              .in('item_code', itemCodes);
            if (error) throw new Error(`Failed to clear Customer Specifications: ${error.message}`);
          }
        }
      ];

      for (const step of clearingSteps) {
        console.log(`🗑️ Clearing ${step.name}...`);
        await step.action();
        console.log(`✅ ${step.name} cleared successfully`);
      }

      console.log('✅ All dependent data cleared successfully');
    },
    onSuccess: () => {
      toast({
        title: "All Dependencies Cleared",
        description: "All foreign key dependent data has been cleared to allow item master replacement",
      });
    },
    onError: (error: any) => {
      console.error('💥 Clear dependent data error:', error);
      toast({
        title: "Failed to Clear Dependencies", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Clear existing item master data
  const clearExistingData = useMutation({
    mutationFn: async () => {
      console.log('🗑️ Clearing item master data...');
      
      const { error } = await supabase
        .from('item_master')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) {
        console.error('❌ Item master deletion error:', error);
        throw new Error(`Failed to clear item master data: ${error.message}`);
      }

      console.log('✅ Item master data cleared successfully');
    },
    onSuccess: () => {
      toast({
        title: "Data Cleared",
        description: "Existing item master data has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ['itemMaster'] });
    },
    onError: (error: any) => {
      console.error('💥 Clear data error:', error);
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

  const checkDependencies = async () => {
    if (!stats) return;
    
    setDependencyStats(stats);
    
    if (stats.totalDependencies > 0) {
      setShowDependencyDialog(true);
    } else {
      // No dependencies, proceed directly
      handleDirectReplacement();
    }
  };

  const handleDirectReplacement = async () => {
    if (!selectedFile) return;

    try {
      console.log('🚀 Starting direct item master replacement...');
      
      // Clear existing data
      await clearExistingData.mutateAsync();
      
      // Upload new data
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
      console.error('💥 Direct replacement failed:', error);
      toast({
        title: "Replacement Failed",
        description: error.message || "Failed to replace item master data. Your backup is safe.",
        variant: "destructive"
      });
    }
  };

  const handleReplacementWithCleanup = async () => {
    if (!selectedFile) return;

    try {
      console.log('🚀 Starting comprehensive item master replacement...');
      
      // First clear ALL dependent data
      await clearAllDependentData.mutateAsync();
      
      // Then clear existing item master data
      await clearExistingData.mutateAsync();
      
      // Finally upload new data
      console.log('📤 Uploading new data...');
      const result = await uploadMutation.mutateAsync(selectedFile);
      console.log('📊 Upload result:', result);
      
      if (result.successCount > 0) {
        setReplacementStep('complete');
        setShowDependencyDialog(false);
        toast({
          title: "Replacement Complete",
          description: `Successfully replaced ${stats?.currentItems || 0} items with ${result.successCount} new items. All dependent data cleared.`,
        });
      } else {
        throw new Error(`No items were successfully uploaded. ${result.errorCount} errors occurred.`);
      }
    } catch (error: any) {
      console.error('💥 Comprehensive replacement failed:', error);
      toast({
        title: "Replacement Failed",
        description: error.message || "Failed to replace item master data. Your backup is safe.",
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
      {/* Comprehensive Dependency Warning Dialog */}
      <Dialog open={showDependencyDialog} onOpenChange={setShowDependencyDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Complete Foreign Key Dependencies Found
            </DialogTitle>
          </DialogHeader>

          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription>
              <div className="space-y-4">
                <p className="font-medium text-orange-800">
                  Your item master has {dependencyStats?.totalDependencies} dependent records across multiple tables:
                </p>
                
                {dependencyStats && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <h4 className="font-semibold">Core Dependencies:</h4>
                      <p><strong>Stock Records:</strong> {dependencyStats.stockReferences}</p>
                      <p><strong>BOM Records:</strong> {dependencyStats.bomReferences}</p>
                      <p><strong>Satguru Stock:</strong> {dependencyStats.satguruStockReferences}</p>
                      <p><strong>Specifications:</strong> {dependencyStats.specReferences}</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Transaction Logs:</h4>
                      <p><strong>GRN Log:</strong> {dependencyStats.grnLogReferences}</p>
                      <p><strong>Issue Log:</strong> {dependencyStats.issueLogReferences}</p>
                      <p><strong>Satguru GRN Log:</strong> {dependencyStats.satguruGrnLogReferences}</p>
                      <p><strong>Satguru Issue Log:</strong> {dependencyStats.satguruIssueLogReferences}</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 p-4 bg-white rounded border">
                  <h4 className="font-medium mb-3 text-red-800">⚠️ CRITICAL: Data Loss Warning</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>This action will permanently delete:</strong></p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>All stock records and balances</li>
                      <li>All BOM (Bill of Materials) data</li>
                      <li>All transaction logs (GRN/Issue history)</li>
                      <li>All current item master records</li>
                    </ul>
                    <p className="text-red-700 font-medium mt-3">
                      ✅ Your current item master backup has been created and downloaded
                    </p>
                    <p className="text-green-700 text-xs">
                      💡 You mentioned you'll populate BOM data later - this gives you a clean slate
                    </p>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex gap-3 justify-end pt-4">
            <Button variant="outline" onClick={() => setShowDependencyDialog(false)}>
              Cancel Replacement
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReplacementWithCleanup}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? 'Processing...' : 'Clear All Data & Replace'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Original Confirmation Dialog */}
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
                      <p><strong>Total Dependencies:</strong> {stats.totalDependencies}</p>
                    </div>
                    <div className="space-y-1">
                      <p><strong>Stock Records:</strong> {stats.stockReferences}</p>
                      <p><strong>Transaction Logs:</strong> {stats.grnLogReferences + stats.issueLogReferences}</p>
                    </div>
                  </div>
                )}

                <div className="mt-3 p-3 bg-white rounded border">
                  <h4 className="font-medium mb-2">Safety Checks:</h4>
                  <ul className="text-xs space-y-1">
                    <li>✅ Automatic backup will be created</li>
                    <li>✅ All dependencies will be handled automatically</li>
                    <li>✅ BOM data can be repopulated later</li>
                    <li>✅ Process can be monitored in real-time</li>
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
            Safe Data Replacement - Comprehensive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Comprehensive System Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.currentItems}</div>
                <div className="text-sm text-blue-800">Current Items</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.totalDependencies}</div>
                <div className="text-sm text-red-800">Total Dependencies</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{stats.stockReferences}</div>
                <div className="text-sm text-orange-800">Stock Records</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.grnLogReferences + stats.issueLogReferences + stats.satguruGrnLogReferences + stats.satguruIssueLogReferences}
                </div>
                <div className="text-sm text-purple-800">Transaction Logs</div>
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
                    Ready to safely replace item master data with comprehensive dependency handling. A backup will be created automatically before any changes.
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
                      onClick={checkDependencies}
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
                    <p className="text-sm text-green-600">All dependent data has been cleared. You can now repopulate BOM and other data as needed.</p>
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
