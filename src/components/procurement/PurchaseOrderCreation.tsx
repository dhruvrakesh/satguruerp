import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Minus, ShoppingCart, AlertCircle } from 'lucide-react';
import { usePurchaseOrders, type Supplier } from '@/hooks/usePurchaseOrders';
import { useStockSummary } from '@/hooks/useStockSummary';
import { toast } from 'sonner';

interface POItem {
  item_code: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  uom: string;
  line_total: number;
  description?: string;
}

interface PurchaseOrderCreationProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  prefilledData?: {
    supplier_id?: string;
    items?: POItem[];
  };
}

export const PurchaseOrderCreation: React.FC<PurchaseOrderCreationProps> = ({
  onSuccess,
  onCancel,
  prefilledData
}) => {
  const { suppliers, createPurchaseOrder, addPOItems, loading } = usePurchaseOrders();
  const stockSummaryQuery = useStockSummary();
  
  const [formData, setFormData] = useState({
    supplier_id: prefilledData?.supplier_id || '',
    required_date: '',
    delivery_date: '',
    priority: 'MEDIUM' as const,
    department: 'PRODUCTION',
    notes: '',
  });
  
  const [items, setItems] = useState<POItem[]>(prefilledData?.items || []);
  const [newItem, setNewItem] = useState<Partial<POItem>>({
    item_code: '',
    item_name: '',
    quantity: 1,
    unit_price: 0,
    uom: 'KG',
  });

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (formData.supplier_id) {
      const supplier = suppliers.find(s => s.id === formData.supplier_id);
      setSelectedSupplier(supplier || null);
    }
  }, [formData.supplier_id, suppliers]);

  const handleAddItem = () => {
    if (!newItem.item_code || !newItem.item_name || !newItem.quantity || !newItem.unit_price) {
      toast.error('Please fill all required item fields');
      return;
    }

    const lineTotal = (newItem.quantity || 0) * (newItem.unit_price || 0);
    const item: POItem = {
      item_code: newItem.item_code,
      item_name: newItem.item_name,
      quantity: newItem.quantity || 1,
      unit_price: newItem.unit_price || 0,
      uom: newItem.uom || 'KG',
      line_total: lineTotal,
      description: newItem.description,
    };

    setItems([...items, item]);
    setNewItem({
      item_code: '',
      item_name: '',
      quantity: 1,
      unit_price: 0,
      uom: 'KG',
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.line_total, 0);
  };

  const getItemStockInfo = (itemCode: string) => {
    return stockSummaryQuery.data?.data.find(item => item.item_code === itemCode);
  };

  const handleCreatePO = async () => {
    if (!formData.supplier_id) {
      toast.error('Please select a supplier');
      return;
    }

    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    try {
      setCreating(true);
      
      const totalAmount = calculateTotal();
      
      // Create the purchase order
      const po = await createPurchaseOrder({
        supplier_id: formData.supplier_id,
        required_date: formData.required_date,
        delivery_date: formData.delivery_date,
        priority: formData.priority,
        department: formData.department,
        notes: formData.notes,
        total_amount: totalAmount,
        status: 'DRAFT',
      });

      // Add items to the purchase order
      await addPOItems(po.id, items);

      toast.success('Purchase order created successfully');
      onSuccess?.();
    } catch (error) {
      console.error('Error creating purchase order:', error);
    } finally {
      setCreating(false);
    }
  };

  const getSupplierMaterials = (supplier: Supplier) => {
    return supplier.material_categories?.join(', ') || 'All materials';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'EMERGENCY': return 'destructive';
      case 'URGENT': return 'destructive';
      case 'HIGH': return 'secondary';
      case 'MEDIUM': return 'outline';
      case 'LOW': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return <div>Loading suppliers...</div>;
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Create Purchase Order
        </CardTitle>
        <CardDescription>
          Create a new purchase order for raw materials and supplies
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier *</Label>
            <Select 
              value={formData.supplier_id} 
              onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{supplier.supplier_name}</span>
                      <span className="text-sm text-muted-foreground">
                        {getSupplierMaterials(supplier)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select 
              value={formData.priority} 
              onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="EMERGENCY">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Select 
              value={formData.department} 
              onValueChange={(value) => setFormData({ ...formData, department: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRODUCTION">Production</SelectItem>
                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                <SelectItem value="ADMIN">Administration</SelectItem>
                <SelectItem value="QUALITY">Quality Control</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="required_date">Required Date</Label>
            <Input
              type="date"
              value={formData.required_date}
              onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_date">Expected Delivery</Label>
            <Input
              type="date"
              value={formData.delivery_date}
              onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
            />
          </div>
        </div>

        {/* Supplier Information */}
        {selectedSupplier && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Supplier Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Contact:</span>
                  <p>{selectedSupplier.contact_person || 'N/A'}</p>
                </div>
                <div>
                  <span className="font-medium">Phone:</span>
                  <p>{selectedSupplier.phone || 'N/A'}</p>
                </div>
                <div>
                  <span className="font-medium">Lead Time:</span>
                  <p>{selectedSupplier.lead_time_days} days</p>
                </div>
                <div>
                  <span className="font-medium">Rating:</span>
                  <Badge variant="outline">{selectedSupplier.performance_rating}%</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Items Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Add Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Item Code *</Label>
                <Input
                  value={newItem.item_code || ''}
                  onChange={(e) => setNewItem({ ...newItem, item_code: e.target.value })}
                  placeholder="Enter item code"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Item Name *</Label>
                <Input
                  value={newItem.item_name || ''}
                  onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                  placeholder="Enter item name"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  value={newItem.quantity || ''}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Unit Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newItem.unit_price || ''}
                  onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-2">
                <Label>UOM</Label>
                <Select 
                  value={newItem.uom || 'KG'} 
                  onValueChange={(value) => setNewItem({ ...newItem, uom: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KG">KG</SelectItem>
                    <SelectItem value="PCS">PCS</SelectItem>
                    <SelectItem value="MTR">MTR</SelectItem>
                    <SelectItem value="LTR">LTR</SelectItem>
                    <SelectItem value="BOX">BOX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="mt-4 flex gap-2">
              <Button onClick={handleAddItem} size="sm" className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Items Table */}
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Order Items ({items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Line Total</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const stockInfo = getItemStockInfo(item.item_code);
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">{item.item_code}</TableCell>
                        <TableCell>{item.item_name}</TableCell>
                        <TableCell>
                          {stockInfo ? (
                            <div className="flex items-center gap-2">
                              <span>{stockInfo.current_qty}</span>
                              {stockInfo.stock_status === 'low_stock' && (
                                <AlertCircle className="h-4 w-4 text-warning" />
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>₹{item.unit_price.toFixed(2)}</TableCell>
                        <TableCell>{item.uom}</TableCell>
                        <TableCell className="font-medium">₹{item.line_total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              <div className="mt-4 flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">₹{calculateTotal().toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes & Special Instructions</Label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Enter any special instructions or notes for this purchase order..."
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          
          <div className="flex gap-2">
            <Badge variant={getPriorityColor(formData.priority)}>
              {formData.priority} Priority
            </Badge>
            
            <Button
              onClick={handleCreatePO}
              disabled={creating || !formData.supplier_id || items.length === 0}
              className="flex items-center gap-2"
            >
              {creating ? 'Creating...' : 'Create Purchase Order'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};