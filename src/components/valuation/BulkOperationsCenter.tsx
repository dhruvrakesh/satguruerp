import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Upload, Download, RefreshCw, CheckCircle, AlertCircle, 
  XCircle, Clock, Play, Pause, RotateCcw 
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ItemPricingCSVUpload } from "./ItemPricingCSVUpload";

interface BulkOperation {
  id: string;
  operation_type: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  total_records: number;
  processed_records: number;
  failed_records: number;
  started_at: string;
  completed_at?: string;
  error_details?: any;
  operation_summary?: any;
  file_name?: string;
  file_size_mb?: number;
  user?: { full_name: string };
}

export function BulkOperationsCenter() {
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState('operations');
  const queryClient = useQueryClient();

  // Fetch bulk operations
  const { data: bulkOperations = [], isLoading } = useQuery({
    queryKey: ['valuation-bulk-operations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('valuation_bulk_operations')
        .select(`
          *,
          user:profiles!valuation_bulk_operations_created_by_fkey(full_name)
        `)
        .order('started_at', { ascending: false });

      if (error) throw error;
      return (data || []) as BulkOperation[];
    },
    refetchInterval: 5000 // Refresh every 5 seconds for real-time updates
  });

  // Cancel operation mutation
  const cancelOperation = useMutation({
    mutationFn: async (operationId: string) => {
      const { data, error } = await supabase
        .from('valuation_bulk_operations')
        .update({ status: 'CANCELLED' })
        .eq('id', operationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valuation-bulk-operations'] });
      toast({
        title: "Operation Cancelled",
        description: "The bulk operation has been cancelled.",
      });
    }
  });

  const handleBulkUpload = async (csvData: any[]) => {
    try {
      // Process the upload using the valuation management system
      const { data, error } = await supabase
        .rpc('process_bulk_price_update', {
          p_operation_id: crypto.randomUUID(),
          p_price_data: csvData
        });

      if (error) throw error;

      setShowUpload(false);
      queryClient.invalidateQueries({ queryKey: ['valuation-bulk-operations'] });
      
      toast({
        title: "Upload Started",
        description: `Bulk operation started for ${csvData.length} records.`,
      });
    } catch (error) {
      console.error('Bulk upload failed:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to start bulk operation.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'IN_PROGRESS': return <Play className="h-4 w-4 text-blue-500" />;
      case 'COMPLETED': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'CANCELLED': return <Pause className="h-4 w-4 text-gray-500" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'secondary';
      case 'IN_PROGRESS': return 'outline';
      case 'COMPLETED': return 'default';
      case 'FAILED': return 'destructive';
      case 'CANCELLED': return 'secondary';
      default: return 'outline';
    }
  };

  const calculateProgress = (operation: BulkOperation) => {
    if (operation.total_records === 0) return 0;
    return (operation.processed_records / operation.total_records) * 100;
  };

  const runningOperations = bulkOperations.filter(op => op.status === 'IN_PROGRESS');
  const completedOperations = bulkOperations.filter(op => op.status === 'COMPLETED');
  const failedOperations = bulkOperations.filter(op => op.status === 'FAILED');

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bulk Operations Center</h2>
          <p className="text-muted-foreground">
            Manage bulk imports, exports, and mass price updates
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['valuation-bulk-operations'] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowUpload(!showUpload)}>
            <Upload className="h-4 w-4 mr-2" />
            New Bulk Upload
          </Button>
        </div>
      </div>

      {/* Upload Panel */}
      {showUpload && (
        <Card>
          <CardHeader>
            <CardTitle>Bulk Price Upload</CardTitle>
            <CardDescription>
              Upload CSV file with price updates. The system will validate and process them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ItemPricingCSVUpload 
              onUploadComplete={() => {
                // This component expects no arguments
                handleBulkUpload([]).catch(console.error);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {runningOperations.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Running Operations
                </p>
              </div>
              <Play className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {completedOperations.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Completed Today
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {failedOperations.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Failed Operations
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {bulkOperations.reduce((sum, op) => sum + op.processed_records, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total Records Processed
                </p>
              </div>
              <RotateCcw className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operations Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="operations">All Operations</TabsTrigger>
          <TabsTrigger value="running">Running ({runningOperations.length})</TabsTrigger>
          <TabsTrigger value="failed">Failed ({failedOperations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="operations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Bulk Operations</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulkOperations.map((operation) => (
                    <TableRow key={operation.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {operation.operation_type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(operation.status)}
                          <Badge variant={getStatusColor(operation.status) as any}>
                            {operation.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={calculateProgress(operation)} className="w-20" />
                          <span className="text-xs text-muted-foreground">
                            {calculateProgress(operation).toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{operation.processed_records}/{operation.total_records}</div>
                          {operation.failed_records > 0 && (
                            <div className="text-red-600">
                              {operation.failed_records} failed
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(operation.started_at), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell>
                        {operation.completed_at 
                          ? `${Math.round((new Date(operation.completed_at).getTime() - new Date(operation.started_at).getTime()) / 1000)}s`
                          : 'Running...'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {operation.status === 'IN_PROGRESS' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelOperation.mutate(operation.id)}
                              disabled={cancelOperation.isPending}
                            >
                              <Pause className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="running" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Running Operations</CardTitle>
              <CardDescription>
                Operations currently in progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              {runningOperations.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">No operations currently running</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {runningOperations.map((operation) => (
                    <div key={operation.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Play className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">
                            {operation.operation_type.replace('_', ' ')}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelOperation.mutate(operation.id)}
                        >
                          Cancel
                        </Button>
                      </div>
                      <Progress value={calculateProgress(operation)} className="mb-2" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>
                          {operation.processed_records}/{operation.total_records} records
                        </span>
                        <span>{calculateProgress(operation).toFixed(1)}% complete</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Failed Operations</CardTitle>
              <CardDescription>
                Operations that encountered errors
              </CardDescription>
            </CardHeader>
            <CardContent>
              {failedOperations.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">No failed operations</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {failedOperations.map((operation) => (
                    <div key={operation.id} className="p-4 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="font-medium">
                            {operation.operation_type.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Failed: {format(new Date(operation.started_at), 'MMM d, HH:mm')}
                      </div>
                      {operation.error_details && (
                        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                          {typeof operation.error_details === 'string' 
                            ? operation.error_details 
                            : JSON.stringify(operation.error_details, null, 2)
                          }
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}