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
import { Plus, Edit, Trash2, Search, Filter, Settings2, BarChart3 } from 'lucide-react';
import { SatguruCylinder } from '@/types';

export const SatguruCylinderManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [itemCodeFilter, setItemCodeFilter] = useState('all');
  const [colourFilter, setColourFilter] = useState('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch Satguru Cylinders
  const { data: cylinders = [], isLoading } = useQuery({
    queryKey: ['satguru-cylinders', searchTerm, itemCodeFilter, colourFilter],
    queryFn: async () => {
      let query = supabase
        .from('satguru_cylinders')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`cylinder_code.ilike.%${searchTerm}%,cylinder_name.ilike.%${searchTerm}%,item_code.ilike.%${searchTerm}%`);
      }

      if (itemCodeFilter && itemCodeFilter !== 'all') {
        query = query.eq('item_code', itemCodeFilter);
      }

      if (colourFilter && colourFilter !== 'all') {
        query = query.eq('colour', colourFilter);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as SatguruCylinder[];
    },
  });

  // Fetch artwork data for item codes
  const { data: artworkData = [] } = useQuery({
    queryKey: ['satguru-artworks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('master_data_artworks_se')
        .select('item_code, item_name, customer_name, no_of_colours')
        .order('item_code');
      
      if (error) throw error;
      return data;
    },
  });

  // Create Cylinder
  const createCylinder = useMutation({
    mutationFn: async (newCylinder: Partial<SatguruCylinder>) => {
      // Generate cylinder code
      const cylinderCode = `${newCylinder.item_code}-${newCylinder.colour}-${Date.now().toString().slice(-6)}`;
      
      const { data, error } = await supabase
        .from('satguru_cylinders')
        .insert({
          ...newCylinder,
          cylinder_code: cylinderCode
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['satguru-cylinders'] });
      toast({
        title: 'Success',
        description: 'Cylinder created successfully',
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

  // Update Cylinder
  const updateCylinder = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SatguruCylinder> & { id: string }) => {
      const { data, error } = await supabase
        .from('satguru_cylinders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['satguru-cylinders'] });
      toast({
        title: 'Success',
        description: 'Cylinder updated successfully',
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

  // Get unique values for filters
  const uniqueItemCodes = [...new Set(cylinders.map(c => c.item_code).filter(Boolean))];
  const uniqueColours = [...new Set(cylinders.map(c => c.colour).filter(Boolean))];

  // Get cylinder statistics
  const getCylinderStats = () => {
    const totalCylinders = cylinders.length;
    const uniqueItems = new Set(cylinders.map(c => c.item_code)).size;
    const totalMileage = cylinders.reduce((sum, c) => sum + (c.mileage_m || 0), 0);
    const averageSize = cylinders.reduce((sum, c) => sum + (c.cylinder_size || 0), 0) / totalCylinders || 0;

    return { totalCylinders, uniqueItems, totalMileage, averageSize };
  };

  const stats = getCylinderStats();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Settings2 className="w-8 h-8 text-primary" />
            Satguru Cylinder Management
          </h1>
          <p className="text-muted-foreground">
            Comprehensive cylinder tracking and management for Satguru Engravures
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Cylinder
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Cylinder</DialogTitle>
              </DialogHeader>
              <CreateCylinderForm 
                artworkData={artworkData}
                onSubmit={createCylinder.mutate} 
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cylinders</CardTitle>
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCylinders}</div>
            <p className="text-xs text-muted-foreground">Active cylinders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Items</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueItems}</div>
            <p className="text-xs text-muted-foreground">Item codes covered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mileage</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMileage.toLocaleString()}m</div>
            <p className="text-xs text-muted-foreground">Cumulative usage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Size</CardTitle>
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageSize.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Average cylinder size</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>Find cylinders by code, name, item code, or colour</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search cylinder code, name, or item code..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Select value={itemCodeFilter} onValueChange={setItemCodeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by Item Code" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Item Codes</SelectItem>
                {uniqueItemCodes.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={colourFilter} onValueChange={setColourFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Colour" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Colours</SelectItem>
                {uniqueColours.map((colour) => (
                  <SelectItem key={colour} value={colour}>
                    {colour}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              onClick={() => {setSearchTerm(""); setItemCodeFilter("all"); setColourFilter("all");}}
            >
              <Filter className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cylinders List */}
      <Card>
        <CardHeader>
          <CardTitle>Cylinder Inventory</CardTitle>
          <CardDescription>
            {isLoading ? 'Loading...' : `Showing ${cylinders.length} cylinders`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center p-8 text-muted-foreground">
                Loading cylinder inventory...
              </div>
            ) : cylinders.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                No cylinders found matching your criteria
              </div>
            ) : (
              cylinders.map((cylinder) => (
                <Card key={cylinder.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{cylinder.cylinder_name}</h3>
                        <Badge variant="outline">{cylinder.cylinder_code}</Badge>
                        <Badge variant="secondary">{cylinder.colour}</Badge>
                        <Badge variant="default">{cylinder.type}</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Item Code</p>
                          <p className="font-medium">{cylinder.item_code}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Size</p>
                          <p className="font-medium">{cylinder.cylinder_size || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Manufacturer</p>
                          <p className="font-medium">{cylinder.manufacturer || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Location</p>
                          <p className="font-medium">{cylinder.location || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Mileage</p>
                          <p className="font-medium">{cylinder.mileage_m}m</p>
                        </div>
                      </div>

                      {cylinder.last_run && (
                        <div className="mt-2">
                          <p className="text-sm text-muted-foreground">
                            <strong>Last Run:</strong> {cylinder.last_run}
                          </p>
                        </div>
                      )}

                      {cylinder.remarks && (
                        <div className="mt-2">
                          <p className="text-sm text-muted-foreground">
                            <strong>Remarks:</strong> {cylinder.remarks}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Edit Cylinder</DialogTitle>
                          </DialogHeader>
                          <EditCylinderForm 
                            cylinder={cylinder}
                            artworkData={artworkData}
                            onSubmit={updateCylinder.mutate} 
                          />
                        </DialogContent>
                      </Dialog>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper Components
const CreateCylinderForm: React.FC<{ 
  artworkData: any[];
  onSubmit: (data: Partial<SatguruCylinder>) => void;
}> = ({ artworkData, onSubmit }) => {
  const [formData, setFormData] = useState({
    item_code: '',
    cylinder_name: '',
    colour: '',
    cylinder_size: 0,
    type: 'GRAVURE',
    manufacturer: '',
    location: '',
    mileage_m: 0,
    last_run: '',
    remarks: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Item Code</label>
          <Select value={formData.item_code} onValueChange={(value) => setFormData({...formData, item_code: value})}>
            <SelectTrigger>
              <SelectValue placeholder="Select item code" />
            </SelectTrigger>
            <SelectContent>
              {artworkData.map((item) => (
                <SelectItem key={item.item_code} value={item.item_code}>
                  {item.item_code} - {item.item_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Cylinder Name</label>
          <Input 
            value={formData.cylinder_name}
            onChange={(e) => setFormData({...formData, cylinder_name: e.target.value})}
            required
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Colour</label>
          <Input 
            value={formData.colour}
            onChange={(e) => setFormData({...formData, colour: e.target.value})}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Cylinder Size</label>
          <Input 
            type="number"
            value={formData.cylinder_size}
            onChange={(e) => setFormData({...formData, cylinder_size: parseFloat(e.target.value)})}
            step="0.01"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Type</label>
          <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GRAVURE">Gravure</SelectItem>
              <SelectItem value="FLEXO">Flexo</SelectItem>
              <SelectItem value="OFFSET">Offset</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Manufacturer</label>
          <Input 
            value={formData.manufacturer}
            onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Location</label>
          <Input 
            value={formData.location}
            onChange={(e) => setFormData({...formData, location: e.target.value})}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Current Mileage (m)</label>
          <Input 
            type="number"
            value={formData.mileage_m}
            onChange={(e) => setFormData({...formData, mileage_m: parseFloat(e.target.value)})}
            step="0.01"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Last Run</label>
        <Input 
          value={formData.last_run}
          onChange={(e) => setFormData({...formData, last_run: e.target.value})}
        />
      </div>

      <div>
        <label className="text-sm font-medium">Remarks</label>
        <Input 
          value={formData.remarks}
          onChange={(e) => setFormData({...formData, remarks: e.target.value})}
        />
      </div>

      <Button type="submit" className="w-full">Create Cylinder</Button>
    </form>
  );
};

const EditCylinderForm: React.FC<{ 
  cylinder: SatguruCylinder;
  artworkData: any[];
  onSubmit: (data: Partial<SatguruCylinder> & { id: string }) => void;
}> = ({ cylinder, artworkData, onSubmit }) => {
  const [formData, setFormData] = useState({
    id: cylinder.id,
    item_code: cylinder.item_code,
    cylinder_name: cylinder.cylinder_name,
    colour: cylinder.colour,
    cylinder_size: cylinder.cylinder_size || 0,
    type: cylinder.type,
    manufacturer: cylinder.manufacturer || '',
    location: cylinder.location || '',
    mileage_m: cylinder.mileage_m,
    last_run: cylinder.last_run || '',
    remarks: cylinder.remarks || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Item Code</label>
          <Select value={formData.item_code} onValueChange={(value) => setFormData({...formData, item_code: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {artworkData.map((item) => (
                <SelectItem key={item.item_code} value={item.item_code}>
                  {item.item_code} - {item.item_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Cylinder Name</label>
          <Input 
            value={formData.cylinder_name}
            onChange={(e) => setFormData({...formData, cylinder_name: e.target.value})}
            required
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Colour</label>
          <Input 
            value={formData.colour}
            onChange={(e) => setFormData({...formData, colour: e.target.value})}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Cylinder Size</label>
          <Input 
            type="number"
            value={formData.cylinder_size}
            onChange={(e) => setFormData({...formData, cylinder_size: parseFloat(e.target.value)})}
            step="0.01"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Type</label>
          <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GRAVURE">Gravure</SelectItem>
              <SelectItem value="FLEXO">Flexo</SelectItem>
              <SelectItem value="OFFSET">Offset</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Manufacturer</label>
          <Input 
            value={formData.manufacturer}
            onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Location</label>
          <Input 
            value={formData.location}
            onChange={(e) => setFormData({...formData, location: e.target.value})}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Current Mileage (m)</label>
          <Input 
            type="number"
            value={formData.mileage_m}
            onChange={(e) => setFormData({...formData, mileage_m: parseFloat(e.target.value)})}
            step="0.01"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Last Run</label>
        <Input 
          value={formData.last_run}
          onChange={(e) => setFormData({...formData, last_run: e.target.value})}
        />
      </div>

      <div>
        <label className="text-sm font-medium">Remarks</label>
        <Input 
          value={formData.remarks}
          onChange={(e) => setFormData({...formData, remarks: e.target.value})}
        />
      </div>

      <Button type="submit" className="w-full">Update Cylinder</Button>
    </form>
  );
};
