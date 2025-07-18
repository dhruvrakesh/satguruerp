
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
import { Trash2, Edit, Plus, Search, Download, Upload, Eye, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  item_master?: {
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

  // Fetch customer specifications
  const { data: specifications, isLoading } = useQuery({
    queryKey: ['customer-specifications', searchQuery, selectedCustomer, selectedStatus],
    queryFn: async (): Promise<CustomerSpecification[]> => {
      let query = supabase
        .from('customer_specifications')
        .select(`
          *,
          item_master (
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
      if (selectedStatus) {
        query = query.eq('status', selectedStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]) || [];
    }
  });

  // Fetch item master for dropdowns
  const { data: itemMaster } = useQuery({
    queryKey: ['item-master-fg'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_master')
        .select('item_code, item_name')
        .eq('usage_type', 'FINISHED_GOOD')
        .order('item_code');
      if (error) throw error;
      return data;
    }
  });

  // Upload specification file
  const uploadSpecification = useMutation({
    mutationFn: async (specData: any) => {
      if (!newSpecification.file) throw new Error('No file selected');

      // Upload file to Supabase Storage
      const fileExt = newSpecification.file.name.split('.').pop();
      const fileName = `${newSpecification.item_code}_${newSpecification.customer_code}_v${Date.now()}.${fileExt}`;
      
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
          version: 1,
          status: 'ACTIVE'
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-specifications'] });
      setNewSpecification({
        item_code: '',
        customer_code: '',
        specification_name: '',
        file: null
      });
      toast({
        title: "Success",
        description: "Specification uploaded successfully",
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

  // Download specification file
  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('customer-specifications')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  // Export specifications to CSV
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
      item_name: spec.item_master?.item_name || '',
      customer_code: spec.customer_code,
      customer_name: spec.item_master?.customer_name || '',
      dimensions: spec.item_master?.dimensions || '',
      specification_name: spec.specification_name,
      version: spec.version,
      status: spec.status,
      upload_date: spec.upload_date,
      file_size_kb: Math.round(spec.file_size / 1024)
    }));

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => Object.values(row).join(','));
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
                        <Label>Item Code</Label>
                        <Select value={newSpecification.item_code} onValueChange={(value) => setNewSpecification({...newSpecification, item_code: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select item code" />
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
                        accept=".pdf,.doc,.docx,.xls,.xlsx"
                        multiple={false}
                      />
                      {newSpecification.file && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Selected: {newSpecification.file.name} ({Math.round(newSpecification.file.size / 1024)} KB)
                        </p>
                      )}
                    </div>

                    <Button 
                      onClick={() => uploadSpecification.mutate(newSpecification)} 
                      className="w-full"
                      disabled={!newSpecification.item_code || !newSpecification.customer_code || !newSpecification.file}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Specification
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
                  <SelectItem value="">All status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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
                  <TableCell>{spec.item_master?.item_name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{spec.customer_code}</Badge>
                  </TableCell>
                  <TableCell>{spec.specification_name}</TableCell>
                  <TableCell>{spec.item_master?.dimensions || '-'}</TableCell>
                  <TableCell>v{spec.version}</TableCell>
                  <TableCell>
                    <Badge variant={spec.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {spec.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(spec.upload_date).toLocaleDateString()}</TableCell>
                  <TableCell>{Math.round(spec.file_size / 1024)} KB</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadFile(spec.file_path, spec.specification_name)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
