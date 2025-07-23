
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Archive, 
  Edit, 
  Trash2, 
  Download, 
  Upload, 
  Settings,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileText,
  Merge
} from "lucide-react";
import { useEnhancedCategories, useEnhancedCategoryMutations, EnhancedCategory } from "@/hooks/useEnhancedCategories";
import { toast } from "@/hooks/use-toast";

interface BulkOperationResult {
  success: number;
  failed: number;
  errors?: any[];
}

interface BulkOperationsPanelProps {
  selectedCategories: string[];
  categories: EnhancedCategory[];
  onClearSelection: () => void;
  onRefresh: () => void;
}

export function BulkOperationsPanel({ 
  selectedCategories, 
  categories, 
  onClearSelection,
  onRefresh 
}: BulkOperationsPanelProps) {
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [bulkEditData, setBulkEditData] = useState({
    category_type: '',
    is_active: '',
    parent_category_id: '',
    business_rules: {},
    sort_order: ''
  });
  const [mergeData, setMergeData] = useState({
    target_category_id: '',
    merge_strategy: 'move_items'
  });
  const [operationProgress, setOperationProgress] = useState(0);
  const [operationStatus, setOperationStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [operationResult, setOperationResult] = useState<BulkOperationResult | null>(null);

  const { bulkUpdateCategories } = useEnhancedCategoryMutations();

  const selectedCategoryData = categories.filter(cat => selectedCategories.includes(cat.id));

  const handleBulkUpdate = async () => {
    if (selectedCategories.length === 0) return;

    setActiveOperation('bulk_update');
    setOperationStatus('running');
    setOperationProgress(0);

    try {
      const operations = selectedCategories.map(id => ({
        action: 'update',
        id,
        ...Object.fromEntries(
          Object.entries(bulkEditData).filter(([_, value]) => value !== '')
        )
      }));

      const result = await bulkUpdateCategories.mutateAsync(operations);
      const typedResult = result as BulkOperationResult;
      
      setOperationProgress(100);
      setOperationStatus('success');
      setOperationResult(typedResult);
      
      toast({
        title: "Bulk Update Successful",
        description: `Updated ${typedResult.success} categories successfully`,
      });

      onRefresh();
    } catch (error: any) {
      setOperationStatus('error');
      setOperationResult({ success: 0, failed: 1, errors: [error.message] });
      
      toast({
        title: "Bulk Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleBulkArchive = async () => {
    if (selectedCategories.length === 0) return;

    setActiveOperation('bulk_archive');
    setOperationStatus('running');
    setOperationProgress(0);

    try {
      const operations = selectedCategories.map(id => ({
        action: 'update',
        id,
        is_active: false
      }));

      const result = await bulkUpdateCategories.mutateAsync(operations);
      const typedResult = result as BulkOperationResult;
      
      setOperationProgress(100);
      setOperationStatus('success');
      setOperationResult(typedResult);
      
      toast({
        title: "Bulk Archive Successful",
        description: `Archived ${typedResult.success} categories successfully`,
      });

      onRefresh();
      onClearSelection();
    } catch (error: any) {
      setOperationStatus('error');
      setOperationResult({ success: 0, failed: 1, errors: [error.message] });
      
      toast({
        title: "Bulk Archive Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMergeCategories = async () => {
    if (selectedCategories.length < 2 || !mergeData.target_category_id) return;

    setActiveOperation('merge');
    setOperationStatus('running');
    setOperationProgress(0);

    try {
      const sourceCategories = selectedCategories.filter(id => id !== mergeData.target_category_id);
      const operations = sourceCategories.map(sourceId => ({
        action: 'merge',
        source_id: sourceId,
        target_id: mergeData.target_category_id
      }));

      const result = await bulkUpdateCategories.mutateAsync(operations);
      const typedResult = result as BulkOperationResult;
      
      setOperationProgress(100);
      setOperationStatus('success');
      setOperationResult(typedResult);
      
      toast({
        title: "Merge Successful",
        description: `Merged ${typedResult.success} categories successfully`,
      });

      onRefresh();
      onClearSelection();
    } catch (error: any) {
      setOperationStatus('error');
      setOperationResult({ success: 0, failed: 1, errors: [error.message] });
      
      toast({
        title: "Merge Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleExportSelected = () => {
    const exportData = selectedCategoryData.map(cat => ({
      category_name: cat.category_name,
      category_code: cat.category_code,
      description: cat.description,
      category_type: cat.category_type,
      is_active: cat.is_active,
      total_items: cat.total_items,
      total_value: cat.avg_item_value * cat.total_items
    }));

    const csv = [
      Object.keys(exportData[0]).join(','),
      ...exportData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `categories_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Bulk Operations</span>
          <Badge variant="secondary">{selectedCategories.length} selected</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {selectedCategories.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Select categories from the table to perform bulk operations
            </AlertDescription>
          </Alert>
        ) : (
          <Tabs defaultValue="actions" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="actions">Quick Actions</TabsTrigger>
              <TabsTrigger value="edit">Bulk Edit</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="actions" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  onClick={handleBulkArchive} 
                  variant="outline" 
                  className="gap-2"
                  disabled={operationStatus === 'running'}
                >
                  <Archive className="w-4 h-4" />
                  Archive Selected
                </Button>
                
                <Button 
                  onClick={handleExportSelected} 
                  variant="outline" 
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Selected
                </Button>
              </div>

              {operationStatus === 'running' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Processing {activeOperation}...</span>
                  </div>
                  <Progress value={operationProgress} className="h-2" />
                </div>
              )}

              {operationStatus === 'success' && operationResult && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Operation completed successfully! 
                    Processed: {operationResult.success}, 
                    Failed: {operationResult.failed}
                  </AlertDescription>
                </Alert>
              )}

              {operationStatus === 'error' && operationResult && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Operation failed: {operationResult.errors?.[0] || 'Unknown error'}
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="edit" className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category_type">Category Type</Label>
                    <Select 
                      value={bulkEditData.category_type} 
                      onValueChange={(value) => setBulkEditData(prev => ({ ...prev, category_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No Change</SelectItem>
                        <SelectItem value="STANDARD">Standard</SelectItem>
                        <SelectItem value="SYSTEM">System</SelectItem>
                        <SelectItem value="TEMPORARY">Temporary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="is_active">Status</Label>
                    <Select 
                      value={bulkEditData.is_active} 
                      onValueChange={(value) => setBulkEditData(prev => ({ ...prev, is_active: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No Change</SelectItem>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="sort_order">Sort Order</Label>
                  <Input 
                    type="number" 
                    placeholder="Enter sort order" 
                    value={bulkEditData.sort_order}
                    onChange={(e) => setBulkEditData(prev => ({ ...prev, sort_order: e.target.value }))}
                  />
                </div>

                <Button 
                  onClick={handleBulkUpdate} 
                  className="w-full"
                  disabled={operationStatus === 'running'}
                >
                  {operationStatus === 'running' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4 mr-2" />
                      Apply Changes
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="merge_target">Merge Categories</Label>
                  <Select 
                    value={mergeData.target_category_id} 
                    onValueChange={(value) => setMergeData(prev => ({ ...prev, target_category_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select target category" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCategoryData.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.category_name} ({cat.total_items} items)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    All items from other selected categories will be moved to this category
                  </p>
                </div>

                <Button 
                  onClick={handleMergeCategories} 
                  variant="outline" 
                  className="w-full"
                  disabled={selectedCategories.length < 2 || !mergeData.target_category_id || operationStatus === 'running'}
                >
                  {operationStatus === 'running' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Merging...
                    </>
                  ) : (
                    <>
                      <Merge className="w-4 h-4 mr-2" />
                      Merge Categories
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
