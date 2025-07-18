
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/ui/file-upload";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit, Plus, Search, Download, Upload, Eye, FileText, History, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SpecificationPreviewDialog } from "@/components/manufacturing/SpecificationPreviewDialog";

interface CustomerSpecification {
  id: string;
  item_code: string;
  customer_code: string;
  specification_name: string;
  file_path: string;
  file_size: number;
  upload_date: string;
  version: number;
  status: string;
  satguru_item_master?: {
    item_name: string;
    customer_name: string;
    dimensions: string;
  };
}

export default function SpecificationMaster() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [newSpecification, setNewSpecification] = useState({
    item_code: '',
    customer_code: '',
    specification_name: '',
    file: null as File | null
  });

  // Fetch customer specifications with enhanced filtering
  const { data: specifications, isLoading } = useQuery({
    queryKey: ['customer-specifications', searchQuery, selectedCustomer, selectedStatus],
    queryFn: async (): Promise<CustomerSpecification[]> => {
      let query = supabase
        .from('customer_specifications')
        .select(`
          id,
          item_code,
          customer_code,
          specification_name,
          file_path,
          file_size,
          upload_date,
          version,
          status,
          satguru_item_master (
            item_name,
            customer_name,
            dimensions
          )
        `)
        .order('upload_date', { ascending: false });

      if (searchQuery) {
        query = query.or(`item_code.ilike.%${searchQuery}%,specification_name.ilike.%${searchQuery}%`);
      }
      if (selectedCustomer) {
        query = query.eq('customer_code', selectedCustomer);
      }
      if (selectedStatus && selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]) || [];
    }
  });

  // Fetch satguru_item_master for FG items only
  const { data: itemMaster } = useQuery({
    queryKey: ['satguru-item-master-fg'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('satguru_item_master')
        .select('item_code, item_name')
        .eq('usage_type', 'FINISHED_GOOD')
        .order('item_code');
      if (error) throw error;
      return data;
    }
  });

  // Get specification statistics
  const specStats = React.useMemo(() => {
    if (!specifications) return { total: 0, approved: 0, pending: 0, rejected: 0 };
    
    return {
      total: specifications.length,
      approved: specifications.filter(s => s.status === 'APPROVED').length,
      pending: specifications.filter(s => s.status === 'PENDING').length,
      rejected: specifications.filter(s => s.status === 'REJECTED').length,
    };
  }, [specifications]);

  // Check for duplicate item codes before upload
  const checkDuplicateItemCode = async (itemCode: string, customerCode: string): Promise<string | null> => {
    const { data: existing } = await supabase
      .from('customer_specifications')
      .select('item_code, customer_code, version')
      .eq('item_code', itemCode)
      .eq('customer_code', customerCode)
      .order('version', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      return `Specification already exists for item ${itemCode} and customer ${customerCode}. This will create version ${existing[0].version + 1}.`;
    }
    return null;
  };

  // Upload specification file
  const uploadSpecification = useMutation({
    mutationFn: async () => {
      if (!newSpecification.file) throw new Error('No file selected');

      // Check for duplicates and warn user
      const duplicateWarning = await checkDuplicateItemCode(
        newSpecification.item_code, 
        newSpecification.customer_code
      );

      // Check for existing version
      const { data: existingSpecs } = await supabase
        .from('customer_specifications')
        .select('version')
        .eq('item_code', newSpecification.item_code)
        .eq('customer_code', newSpecification.customer_code)
        .order('version', { ascending: false })
        .limit(1);

      const nextVersion = existingSpecs && existingSpecs.length > 0 ? existingSpecs[0].version + 1 : 1;

      // Create unique filename to prevent conflicts: itemcode_customer_version_timestamp
      const fileExt = newSpecification.file.name.split('.').pop();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${newSpecification.item_code}_${newSpecification.customer_code}_v${nextVersion}_${timestamp}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('customer-specifications')
        .upload(fileName, newSpecification.file);

      if (uploadError) throw uploadError;

      // Save specification record
      const { data, error } = await supabase
        .from('customer_specifications')
        .insert({
          item_code: newSpecification.item_code,
          customer_code: newSpecification.customer_code,
          specification_name: newSpecification.specification_name,
          file_path: uploadData.path,
          file_size: newSpecification.file.size,
          version: nextVersion,
          status: 'PENDING'
        })
        .select();

      if (error) throw error;
      return { data, duplicateWarning };
    },
    onSuccess: ({ duplicateWarning }) => {
      queryClient.invalidateQueries({ queryKey: ['customer-specifications'] });
      setNewSpecification({
        item_code: '',
        customer_code: '',
        specification_name: '',
        file: null
      });
      toast({
        title: "Success",
        description: duplicateWarning 
          ? `Specification uploaded successfully. ${duplicateWarning}`
          : "Specification uploaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete specification
  const deleteSpecification = useMutation({
    mutationFn: async (specId: string) => {
      // Get file path first
      const { data: spec } = await supabase
        .from('customer_specifications')
        .select('file_path')
        .eq('id', specId)
        .single();

      if (spec?.file_path) {
        // Delete file from storage
        await supabase.storage
          .from('customer-specifications')
          .remove([spec.file_path]);
      }

      // Delete record
      const { error } = await supabase
        .from('customer_specifications')
        .delete()
        .eq('id', specId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-specifications'] });
      toast({
        title: "Success",
        description: "Specification deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update specification status
  const updateSpecificationStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('customer_specifications')
        .update({ 
          status, 
          approved_at: status === 'APPROVED' ? new Date().toISOString() : null,
          approved_by: status === 'APPROVED' ? (await supabase.auth.getUser()).data.user?.id : null
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-specifications'] });
      toast({
        title: "Success",
        description: "Specification status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Export specifications to CSV with enhanced data
  const exportToCSV = () => {
    if (!specifications || specifications.length === 0) {
      toast({
        title: "No Data",
        description: "No specifications to export",
        variant: "destructive"
      });
      return;
    }

    const csvData = specifications.map(spec => ({
      item_code: spec.item_code,
      item_name: spec.satguru_item_master?.item_name || '',
      customer_code: spec.customer_code,
      customer_name: spec.satguru_item_master?.customer_name || '',
      dimensions: spec.satguru_item_master?.dimensions || '',
      specification_name: spec.specification_name,
      version: spec.version,
      status: spec.status,
      upload_date: spec.upload_date,
      file_size_kb: Math.round(spec.file_size / 1024),
      file_path: spec.file_path
    }));

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => Object.values(row).map(value => 
      typeof value === 'string' && value.includes(',') ? `"${value}"` : value
    ).join(','));
    const csvContent = [headers, ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer_specifications_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Specifications exported to CSV successfully",
    });
  };

  const filteredSpecs = specifications?.filter(spec =>
    spec.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    spec.specification_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Specifications</p>
                <p className="text-2xl font-bold">{specStats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{specStats.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{specStats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{specStats.rejected}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Customer Specification Master
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Specification
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Upload Customer Specification</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Item Code (FG Only)</Label>
                        <Select value={newSpecification.item_code} onValueChange={(value) => setNewSpecification({...newSpecification, item_code: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select FG item code" />
                          </SelectTrigger>
                          <SelectContent>
                            {itemMaster?.map((item) => (
                              <SelectItem key={item.item_code} value={item.item_code}>
                                {item.item_code} - {item.item_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Customer Code</Label>
                        <Select value={newSpecification.customer_code} onValueChange={(value) => setNewSpecification({...newSpecification, customer_code: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GCPL">GCPL</SelectItem>
                            <SelectItem value="RB">Reckitt Benckiser</SelectItem>
                            <SelectItem value="HUL">Hindustan Unilever</SelectItem>
                            <SelectItem value="ITC">ITC Limited</SelectItem>
                            <SelectItem value="PATANJALI">Patanjali</SelectItem>
                            <SelectItem value="ANCHOR">Anchor</SelectItem>
                            <SelectItem value="OTHERS">Others</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <Label>Specification Name</Label>
                      <Input
                        value={newSpecification.specification_name}
                        onChange={(e) => setNewSpecification({...newSpecification, specification_name: e.target.value})}
                        placeholder="Enter specification name"
                      />
                    </div>

                    <div>
                      <Label>Upload File</Label>
                      <FileUpload
                        onFilesSelected={(files) => setNewSpecification({...newSpecification, file: files[0]})}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        multiple={false}
                      />
                      {newSpecification.file && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Selected: {newSpecification.file.name} ({Math.round(newSpecification.file.size / 1024)} KB)
                        </p>
                      )}
                    </div>

                    <Button 
                      onClick={() => uploadSpecification.mutate()} 
                      className="w-full"
                      disabled={!newSpecification.item_code || !newSpecification.customer_code || !newSpecification.file || uploadSpecification.isPending}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadSpecification.isPending ? 'Uploading...' : 'Upload Specification'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by item code or specification name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Label>Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All customers</SelectItem>
                  <SelectItem value="GCPL">GCPL</SelectItem>
                  <SelectItem value="RB">Reckitt Benckiser</SelectItem>
                  <SelectItem value="HUL">Hindustan Unilever</SelectItem>
                  <SelectItem value="ITC">ITC Limited</SelectItem>
                  <SelectItem value="PATANJALI">Patanjali</SelectItem>
                  <SelectItem value="ANCHOR">Anchor</SelectItem>
                  <SelectItem value="OTHERS">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Specification Name</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead>File Size</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSpecs.map((spec) => (
                  <TableRow key={spec.id}>
                    <TableCell className="font-medium">{spec.item_code}</TableCell>
                    <TableCell>{spec.satguru_item_master?.item_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{spec.customer_code}</Badge>
                    </TableCell>
                    <TableCell>{spec.specification_name}</TableCell>
                    <TableCell>{spec.satguru_item_master?.dimensions || '-'}</TableCell>
                    <TableCell>v{spec.version}</TableCell>
                    <TableCell>
                      <Select 
                        value={spec.status} 
                        onValueChange={(status) => updateSpecificationStatus.mutate({ id: spec.id, status })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="APPROVED">Approved</SelectItem>
                          <SelectItem value="REJECTED">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{new Date(spec.upload_date).toLocaleDateString()}</TableCell>
                    <TableCell>{Math.round(spec.file_size / 1024)} KB</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <SpecificationPreviewDialog specification={spec}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </SpecificationPreviewDialog>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteSpecification.mutate(spec.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
