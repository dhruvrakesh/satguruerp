import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Package, TreePine, Calculator } from 'lucide-react';
import { BOMGroup, BillOfMaterials, MaterialConsumption, ProcessStage } from '@/types';

export const BOMManagement: React.FC = () => {
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedUiorn, setSelectedUiorn] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch BOM Groups
  const { data: bomGroups = [] } = useQuery({
    queryKey: ['bom-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bom_groups')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data as BOMGroup[];
    },
  });

  // Fetch BOM Items
  const { data: bomItems = [] } = useQuery({
    queryKey: ['bom-items', selectedGroup],
    queryFn: async () => {
      let query = supabase
        .from('bill_of_materials')
        .select('*')
        .order('fg_item_code');
      
      if (selectedGroup) {
        query = query.eq('bom_group_id', selectedGroup);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BillOfMaterials[];
    },
  });

  // Fetch Material Consumption for selected UIORN
  const { data: materialConsumption = [] } = useQuery({
    queryKey: ['material-consumption', selectedUiorn],
    queryFn: async () => {
      if (!selectedUiorn) return [];
      
      const { data, error } = await supabase
        .from('uiorn_material_consumption')
        .select('*')
        .eq('uiorn', selectedUiorn)
        .order('consumed_at', { ascending: false });
      
      if (error) throw error;
      return data as MaterialConsumption[];
    },
    enabled: !!selectedUiorn
  });

  // Create BOM Group
  const createBOMGroup = useMutation({
    mutationFn: async (newGroup: Partial<BOMGroup>) => {
      const { data, error } = await supabase
        .from('bom_groups')
        .insert(newGroup as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-groups'] });
      toast({
        title: 'Success',
        description: 'BOM group created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Create BOM Item
  const createBOMItem = useMutation({
    mutationFn: async (newItem: Partial<BillOfMaterials>) => {
      const { data, error } = await supabase
        .from('bill_of_materials')
        .insert(newItem as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-items'] });
      toast({
        title: 'Success',
        description: 'BOM item created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Record Material Consumption
  const recordConsumption = useMutation({
    mutationFn: async (consumption: Partial<MaterialConsumption>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('uiorn_material_consumption')
        .insert({
          ...consumption,
          recorded_by: user?.id
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-consumption'] });
      toast({
        title: 'Success',
        description: 'Material consumption recorded successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Package className="w-8 h-8 text-primary" />
            BOM Management & Material Tracking
          </h1>
          <p className="text-muted-foreground">
            Organize BOMs by groups and track material consumption per UIORN
          </p>
        </div>
      </div>

      <Tabs defaultValue="groups" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="groups">BOM Groups</TabsTrigger>
          <TabsTrigger value="items">BOM Items</TabsTrigger>
          <TabsTrigger value="consumption">Material Consumption</TabsTrigger>
          <TabsTrigger value="analytics">Cost Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="groups">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>BOM Groups</CardTitle>
                  <CardDescription>Organize BOM items under logical headers</CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Group
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create BOM Group</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <CreateBOMGroupForm onSubmit={createBOMGroup.mutate} />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {bomGroups.map((group) => (
                  <Card 
                    key={group.id} 
                    className={`cursor-pointer transition-colors ${
                      selectedGroup === group.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedGroup(group.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{group.group_name}</CardTitle>
                        <Badge variant="outline">{group.group_code}</Badge>
                      </div>
                      {group.description && (
                        <CardDescription>{group.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Items: {bomItems.filter(item => item.bom_group_id === group.id).length}</span>
                        <span>Order: {group.display_order}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>BOM Items</CardTitle>
                  <CardDescription>
                    {selectedGroup ? 
                      `Items in selected group (${bomGroups.find(g => g.id === selectedGroup)?.group_name})` : 
                      'All BOM items'
                    }
                  </CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add BOM Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Add BOM Item</DialogTitle>
                    </DialogHeader>
                    <CreateBOMItemForm 
                      groups={bomGroups}
                      selectedGroup={selectedGroup}
                      onSubmit={createBOMItem.mutate} 
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bomItems.map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{item.fg_item_code}</h3>
                          <Badge variant="outline">{item.rm_item_code}</Badge>
                          <Badge variant="secondary">{item.unit_of_measure}</Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Qty Required: </span>
                            <span className="font-medium">{item.quantity_required}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Consumption Rate: </span>
                            <span className="font-medium">{item.consumption_rate || 1}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Wastage: </span>
                            <span className="font-medium">{item.wastage_percentage || 0}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Group: </span>
                            <span className="font-medium">
                              {bomGroups.find(g => g.id === item.bom_group_id)?.group_name || 'No Group'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consumption">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Material Consumption Tracking</CardTitle>
                  <CardDescription>Track actual material consumption per UIORN and process stage</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enter UIORN to track..." 
                    value={selectedUiorn}
                    onChange={(e) => setSelectedUiorn(e.target.value)}
                    className="w-64"
                  />
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button disabled={!selectedUiorn}>
                        <Plus className="h-4 w-4 mr-2" />
                        Record Consumption
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Record Material Consumption</DialogTitle>
                      </DialogHeader>
                      <RecordConsumptionForm 
                        uiorn={selectedUiorn}
                        onSubmit={recordConsumption.mutate} 
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedUiorn ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Total Planned Cost</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          ₹{materialConsumption.reduce((sum, item) => sum + (item.planned_quantity * item.unit_cost), 0).toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Actual Cost</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                          ₹{materialConsumption.reduce((sum, item) => sum + item.total_cost, 0).toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Wastage Cost</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                          ₹{materialConsumption.reduce((sum, item) => sum + (item.wastage_quantity * item.unit_cost), 0).toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-3">
                    {materialConsumption.map((consumption) => (
                      <Card key={consumption.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold">{consumption.rm_item_code}</h3>
                              <Badge variant="outline">{consumption.process_stage}</Badge>
                            </div>
                            <div className="grid grid-cols-5 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Planned: </span>
                                <span className="font-medium">{consumption.planned_quantity}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Actual: </span>
                                <span className="font-medium">{consumption.actual_quantity}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Wastage: </span>
                                <span className="font-medium text-red-600">{consumption.wastage_quantity}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Unit Cost: </span>
                                <span className="font-medium">₹{consumption.unit_cost}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Total: </span>
                                <span className="font-medium">₹{consumption.total_cost}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  Enter a UIORN to view material consumption tracking
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cost Analysis by Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-8 text-muted-foreground">
                  Advanced analytics coming soon...
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Wastage Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-8 text-muted-foreground">
                  Wastage analysis coming soon...
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Helper Components
const CreateBOMGroupForm: React.FC<{ onSubmit: (data: Partial<BOMGroup>) => void }> = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    group_name: '',
    group_code: '',
    description: '',
    display_order: 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Group Name</label>
        <Input 
          value={formData.group_name}
          onChange={(e) => setFormData({...formData, group_name: e.target.value})}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Group Code</label>
        <Input 
          value={formData.group_code}
          onChange={(e) => setFormData({...formData, group_code: e.target.value})}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Input 
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
        />
      </div>
      <Button type="submit" className="w-full">Create Group</Button>
    </form>
  );
};

const CreateBOMItemForm: React.FC<{ 
  groups: BOMGroup[]; 
  selectedGroup: string;
  onSubmit: (data: Partial<BillOfMaterials>) => void;
}> = ({ groups, selectedGroup, onSubmit }) => {
  const [formData, setFormData] = useState({
    fg_item_code: '',
    rm_item_code: '',
    quantity_required: 1,
    unit_of_measure: 'KG',
    bom_group_id: selectedGroup,
    consumption_rate: 1,
    wastage_percentage: 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">FG Item Code</label>
          <Input 
            value={formData.fg_item_code}
            onChange={(e) => setFormData({...formData, fg_item_code: e.target.value})}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">RM Item Code</label>
          <Input 
            value={formData.rm_item_code}
            onChange={(e) => setFormData({...formData, rm_item_code: e.target.value})}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Quantity Required</label>
          <Input 
            type="number"
            value={formData.quantity_required}
            onChange={(e) => setFormData({...formData, quantity_required: parseFloat(e.target.value)})}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Unit of Measure</label>
          <Select value={formData.unit_of_measure} onValueChange={(value) => setFormData({...formData, unit_of_measure: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="KG">KG</SelectItem>
              <SelectItem value="MTR">MTR</SelectItem>
              <SelectItem value="PCS">PCS</SelectItem>
              <SelectItem value="LTR">LTR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">BOM Group</label>
        <Select value={formData.bom_group_id} onValueChange={(value) => setFormData({...formData, bom_group_id: value})}>
          <SelectTrigger>
            <SelectValue placeholder="Select group" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.group_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Consumption Rate</label>
          <Input 
            type="number"
            value={formData.consumption_rate}
            onChange={(e) => setFormData({...formData, consumption_rate: parseFloat(e.target.value)})}
            step="0.01"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Wastage %</label>
          <Input 
            type="number"
            value={formData.wastage_percentage}
            onChange={(e) => setFormData({...formData, wastage_percentage: parseFloat(e.target.value)})}
            step="0.01"
          />
        </div>
      </div>
      <Button type="submit" className="w-full">Add BOM Item</Button>
    </form>
  );
};

const RecordConsumptionForm: React.FC<{ 
  uiorn: string;
  onSubmit: (data: Partial<MaterialConsumption>) => void;
}> = ({ uiorn, onSubmit }) => {
  const [formData, setFormData] = useState({
    uiorn,
    rm_item_code: '',
    process_stage: 'GRAVURE_PRINTING' as ProcessStage,
    planned_quantity: 0,
    actual_quantity: 0,
    wastage_quantity: 0,
    unit_cost: 0,
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalCost = (formData.actual_quantity + formData.wastage_quantity) * formData.unit_cost;
    onSubmit({
      ...formData,
      total_cost: totalCost
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">RM Item Code</label>
        <Input 
          value={formData.rm_item_code}
          onChange={(e) => setFormData({...formData, rm_item_code: e.target.value})}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Process Stage</label>
        <Select value={formData.process_stage} onValueChange={(value: ProcessStage) => setFormData({...formData, process_stage: value})}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GRAVURE_PRINTING">Gravure Printing</SelectItem>
            <SelectItem value="LAMINATION">Lamination</SelectItem>
            <SelectItem value="ADHESIVE_COATING">Adhesive Coating</SelectItem>
            <SelectItem value="SLITTING">Slitting</SelectItem>
            <SelectItem value="DISPATCH">Dispatch</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Planned Quantity</label>
          <Input 
            type="number"
            value={formData.planned_quantity}
            onChange={(e) => setFormData({...formData, planned_quantity: parseFloat(e.target.value)})}
            step="0.01"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Actual Quantity</label>
          <Input 
            type="number"
            value={formData.actual_quantity}
            onChange={(e) => setFormData({...formData, actual_quantity: parseFloat(e.target.value)})}
            step="0.01"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Wastage Quantity</label>
          <Input 
            type="number"
            value={formData.wastage_quantity}
            onChange={(e) => setFormData({...formData, wastage_quantity: parseFloat(e.target.value)})}
            step="0.01"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Unit Cost (₹)</label>
          <Input 
            type="number"
            value={formData.unit_cost}
            onChange={(e) => setFormData({...formData, unit_cost: parseFloat(e.target.value)})}
            step="0.01"
            required
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Notes</label>
        <Input 
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
        />
      </div>
      <Button type="submit" className="w-full">Record Consumption</Button>
    </form>
  );
};