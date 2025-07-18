import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Plus, Search, Calculator, Upload, Download, Target } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BOMBulkUploadDialog } from "./BOMBulkUploadDialog";

interface BOMItem {
  id: string;
  fg_item_code: string;
  rm_item_code: string;
  quantity_required: number;
  unit_of_measure: string;
  gsm_contribution?: number;
  percentage_contribution?: number;
  customer_code?: string;
  bom_version?: number;
  is_active?: boolean;
  consumption_rate?: number;
  wastage_percentage?: number;
  bom_groups?: {
    group_name: string;
    group_code: string;
  };
}

interface ItemMaster {
  item_code: string;
  item_name: string;
  usage_type: string;
}

export const BOMManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFGItem, setSelectedFGItem] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [newBOMItem, setNewBOMItem] = useState({
    fg_item_code: '',
    rm_item_code: '',
    quantity_required: '',
    unit_of_measure: 'KG',
    bom_group_id: '',
    consumption_rate: '1',
    wastage_percentage: '0',
    gsm_contribution: '',
    percentage_contribution: '',
    customer_code: '',
    specifications: ''
  });
  const [bomExplosionData, setBomExplosionData] = useState<any[]>([]);
  const [explosionQuantity, setExplosionQuantity] = useState('1000');

  // Fetch BOM data
  const { data: bomData, isLoading } = useQuery({
    queryKey: ['bom-data', searchQuery, selectedFGItem, selectedCustomer],
    queryFn: async () => {
      let query = supabase
        .from('bill_of_materials')
        .select(`
          *,
          bom_groups (
            group_name,
            group_code
          )
        `)
        .order('fg_item_code');

      if (selectedFGItem) {
        query = query.eq('fg_item_code', selectedFGItem);
      }

      if (selectedCustomer) {
        query = query.eq('customer_code', selectedCustomer);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    }
  });

  // Fetch finished goods
  const { data: finishedGoods } = useQuery({
    queryKey: ['finished-goods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_master')
        .select('item_code, item_name')
        .eq('usage_type', 'FINISHED_GOOD')
        .order('item_code');
      if (error) throw error;
      return data as ItemMaster[];
    }
  });

  // Fetch raw materials
  const { data: rawMaterials } = useQuery({
    queryKey: ['raw-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_master')
        .select('item_code, item_name')
        .in('usage_type', ['RAW_MATERIAL', 'PACKAGING', 'CONSUMABLE'])
        .order('item_code');
      if (error) throw error;
      return data as ItemMaster[];
    }
  });

  // Fetch BOM groups
  const { data: bomGroups } = useQuery({
    queryKey: ['bom-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bom_groups')
        .select('*')
        .eq('is_active', true)
        .order('group_name');
      if (error) throw error;
      return data || [];
    }
  });

  // Create new BOM item
  const createBOM = useMutation({
    mutationFn: async (bomData: any) => {
      const { data, error } = await supabase
        .from('bill_of_materials')
        .insert({
          fg_item_code: newBOMItem.fg_item_code,
          rm_item_code: newBOMItem.rm_item_code,
          quantity_required: parseFloat(newBOMItem.quantity_required),
          unit_of_measure: newBOMItem.unit_of_measure,
          bom_group_id: newBOMItem.bom_group_id || null,
          consumption_rate: parseFloat(newBOMItem.consumption_rate),
          wastage_percentage: parseFloat(newBOMItem.wastage_percentage),
          gsm_contribution: parseFloat(newBOMItem.gsm_contribution) || 0,
          percentage_contribution: parseFloat(newBOMItem.percentage_contribution) || 0,
          customer_code: newBOMItem.customer_code || null,
          bom_version: 1,
          effective_date: new Date().toISOString().split('T')[0],
          is_active: true,
          specifications: newBOMItem.specifications ? JSON.parse(newBOMItem.specifications) : null
        })
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-data'] });
      setNewBOMItem({
        fg_item_code: '',
        rm_item_code: '',
        quantity_required: '',
        unit_of_measure: 'KG',
        bom_group_id: '',
        consumption_rate: '1',
        wastage_percentage: '0',
        gsm_contribution: '',
        percentage_contribution: '',
        customer_code: '',
        specifications: ''
      });
      toast({
        title: "Success",
        description: "BOM item created successfully",
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

  // Delete BOM item
  const deleteBOM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bill_of_materials')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-data'] });
      toast({
        title: "Success",
        description: "BOM item deleted successfully",
      });
    }
  });

  // BOM Explosion function
  const calculateBOMExplosion = async () => {
    if (!selectedFGItem || !explosionQuantity) {
      toast({
        title: "Missing Information",
        description: "Please select an FG item and enter quantity",
        variant: "destructive"
      });
      return;
    }

    try {
      // Simplified BOM explosion - get BOM items and calculate requirements
      const { data: bomItems, error } = await supabase
        .from('bill_of_materials')
        .select('*')
        .eq('fg_item_code', selectedFGItem)
        .eq('is_active', true);

      if (error) throw error;
      
      const explosionData = bomItems?.map(item => ({
        rm_item_code: item.rm_item_code,
        required_quantity: item.quantity_required * parseFloat(explosionQuantity),
        unit_of_measure: item.unit_of_measure,
        gsm_contribution: (item as any).gsm_contribution || 0,
        percentage_contribution: (item as any).percentage_contribution || 0,
        total_cost: item.quantity_required * parseFloat(explosionQuantity) * 10 // Placeholder cost
      })) || [];

      setBomExplosionData(explosionData);
      
      toast({
        title: "BOM Explosion Calculated",
        description: `Material requirements calculated for ${explosionQuantity} units`,
      });
    } catch (error) {
      console.error('BOM explosion error:', error);
      toast({
        title: "Calculation Failed",
        description: "Failed to calculate BOM explosion",
        variant: "destructive"
      });
    }
  };

  const filteredBOMData = bomData?.filter(item =>
    item.fg_item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.rm_item_code.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Bill of Materials Management
            <div className="flex gap-2">
              <BOMBulkUploadDialog
                trigger={
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Bulk Upload
                  </Button>
                }
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['bom-data'] })}
              />
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Calculator className="h-4 w-4 mr-2" />
                    BOM Explosion
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>BOM Explosion Calculator</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>FG Item</Label>
                        <Select value={selectedFGItem} onValueChange={setSelectedFGItem}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select FG Item" />
                          </SelectTrigger>
                          <SelectContent>
                            {finishedGoods?.map((item) => (
                              <SelectItem key={item.item_code} value={item.item_code}>
                                {item.item_code} - {item.item_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Customer (Optional)</Label>
                        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Customers" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All Customers</SelectItem>
                            <SelectItem value="GCPL">GCPL</SelectItem>
                            <SelectItem value="RB">Reckitt Benckiser</SelectItem>
                            <SelectItem value="HUL">Hindustan Unilever</SelectItem>
                            <SelectItem value="ITC">ITC Limited</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Quantity (KG)</Label>
                        <Input
                          type="number"
                          value={explosionQuantity}
                          onChange={(e) => setExplosionQuantity(e.target.value)}
                          placeholder="Enter quantity"
                        />
                      </div>
                    </div>
                    <Button onClick={calculateBOMExplosion} className="w-full">
                      <Target className="h-4 w-4 mr-2" />
                      Calculate Material Requirements
                    </Button>
                    
                    {bomExplosionData.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-4">Material Requirements</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>RM Item Code</TableHead>
                              <TableHead>Required Qty</TableHead>
                              <TableHead>UOM</TableHead>
                              <TableHead>GSM Contribution</TableHead>
                              <TableHead>% Contribution</TableHead>
                              <TableHead>Total Cost</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bomExplosionData.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{item.rm_item_code}</TableCell>
                                <TableCell>{item.required_quantity?.toFixed(2)}</TableCell>
                                <TableCell>{item.unit_of_measure}</TableCell>
                                <TableCell>{item.gsm_contribution}</TableCell>
                                <TableCell>{item.percentage_contribution}%</TableCell>
                                <TableCell>₹{item.total_cost?.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="mt-4 p-4 bg-muted rounded-lg">
                          <p className="font-semibold">
                            Total Cost: ₹{bomExplosionData.reduce((sum, item) => sum + (item.total_cost || 0), 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="search">Search BOM</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by FG or RM item code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Label htmlFor="fg-filter">Filter by FG Item</Label>
              <Select value={selectedFGItem} onValueChange={setSelectedFGItem}>
                <SelectTrigger>
                  <SelectValue placeholder="All FG Items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All FG Items</SelectItem>
                  {finishedGoods?.map((item) => (
                    <SelectItem key={item.item_code} value={item.item_code}>
                      {item.item_code} - {item.item_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label htmlFor="customer-filter">Filter by Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Customers</SelectItem>
                  <SelectItem value="GCPL">GCPL</SelectItem>
                  <SelectItem value="RB">Reckitt Benckiser</SelectItem>
                  <SelectItem value="HUL">Hindustan Unilever</SelectItem>
                  <SelectItem value="ITC">ITC Limited</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>FG Item Code</TableHead>
                <TableHead>RM Item Code</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead>GSM</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBOMData.map((bomItem) => (
                <TableRow key={bomItem.id}>
                  <TableCell className="font-medium">{bomItem.fg_item_code}</TableCell>
                  <TableCell>{bomItem.rm_item_code}</TableCell>
                  <TableCell>{bomItem.quantity_required}</TableCell>
                  <TableCell>{bomItem.unit_of_measure}</TableCell>
                  <TableCell>{(bomItem as any).gsm_contribution || '-'}</TableCell>
                  <TableCell>{(bomItem as any).percentage_contribution || '-'}%</TableCell>
                  <TableCell>
                    {(bomItem as any).customer_code ? (
                      <Badge variant="outline">{(bomItem as any).customer_code}</Badge>
                    ) : (
                      <span className="text-muted-foreground">Generic</span>
                    )}
                  </TableCell>
                  <TableCell>v{(bomItem as any).bom_version || 1}</TableCell>
                  <TableCell>
                    <Badge variant={(bomItem as any).is_active !== false ? "default" : "secondary"}>
                      {(bomItem as any).is_active !== false ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteBOM.mutate(bomItem.id)}
                      >
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

      {/* Add New BOM Item Dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add BOM Item
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New BOM Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fg-item">FG Item Code</Label>
                <Select value={newBOMItem.fg_item_code} onValueChange={(value) => setNewBOMItem({...newBOMItem, fg_item_code: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select FG Item" />
                  </SelectTrigger>
                  <SelectContent>
                    {finishedGoods?.map((item) => (
                      <SelectItem key={item.item_code} value={item.item_code}>
                        {item.item_code} - {item.item_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rm-item">RM Item Code</Label>
                <Select value={newBOMItem.rm_item_code} onValueChange={(value) => setNewBOMItem({...newBOMItem, rm_item_code: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select RM Item" />
                  </SelectTrigger>
                  <SelectContent>
                    {rawMaterials?.map((item) => (
                      <SelectItem key={item.item_code} value={item.item_code}>
                        {item.item_code} - {item.item_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="quantity">Quantity Required</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={newBOMItem.quantity_required}
                  onChange={(e) => setNewBOMItem({...newBOMItem, quantity_required: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="uom">Unit of Measure</Label>
                <Select value={newBOMItem.unit_of_measure} onValueChange={(value) => setNewBOMItem({...newBOMItem, unit_of_measure: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KG">KG</SelectItem>
                    <SelectItem value="MT">MT</SelectItem>
                    <SelectItem value="PCS">PCS</SelectItem>
                    <SelectItem value="LITER">LITER</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="group">BOM Group</Label>
                <Select value={newBOMItem.bom_group_id} onValueChange={(value) => setNewBOMItem({...newBOMItem, bom_group_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {bomGroups?.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.group_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="consumption">Consumption Rate</Label>
                <Input
                  id="consumption"
                  type="number"
                  step="0.01"
                  value={newBOMItem.consumption_rate}
                  onChange={(e) => setNewBOMItem({...newBOMItem, consumption_rate: e.target.value})}
                  placeholder="1"
                />
              </div>
              <div>
                <Label htmlFor="wastage">Wastage Percentage</Label>
                <Input
                  id="wastage"
                  type="number"
                  step="0.1"
                  value={newBOMItem.wastage_percentage}
                  onChange={(e) => setNewBOMItem({...newBOMItem, wastage_percentage: e.target.value})}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="gsm">GSM Contribution</Label>
                <Input
                  id="gsm"
                  type="number"
                  step="0.1"
                  value={newBOMItem.gsm_contribution}
                  onChange={(e) => setNewBOMItem({...newBOMItem, gsm_contribution: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="percentage">Percentage Contribution</Label>
                <Input
                  id="percentage"
                  type="number"
                  step="0.1"
                  value={newBOMItem.percentage_contribution}
                  onChange={(e) => setNewBOMItem({...newBOMItem, percentage_contribution: e.target.value})}
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="customer">Customer Code (Optional)</Label>
              <Select value={newBOMItem.customer_code} onValueChange={(value) => setNewBOMItem({...newBOMItem, customer_code: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Generic BOM (no customer)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Generic BOM</SelectItem>
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
              <Label htmlFor="specifications">Specifications (JSON)</Label>
              <Textarea
                id="specifications"
                value={newBOMItem.specifications}
                onChange={(e) => setNewBOMItem({...newBOMItem, specifications: e.target.value})}
                placeholder='{"color": "blue", "grade": "A"}'
              />
            </div>

            <Button onClick={() => createBOM.mutate(newBOMItem)} className="w-full">
              Create BOM Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};