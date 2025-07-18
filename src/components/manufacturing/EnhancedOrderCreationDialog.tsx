
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ItemSelector } from "./ItemSelector";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { X, Calculator, Package, Truck, AlertCircle } from "lucide-react";

interface Item {
  item_code: string;
  item_name: string;
  uom: string;
  status: string;
  usage_type: string;
}

interface SelectedItem {
  item_code: string;
  item_name: string;
  uom: string;
  usage_type: string;
  quantity: number;
}

interface EnhancedOrderCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnhancedOrderCreationDialog({ open, onOpenChange }: EnhancedOrderCreationDialogProps) {
  const { toast } = useToast();
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [orderData, setOrderData] = useState({
    product_description: "",
    order_type: "PRINTING",
    priority: "MEDIUM",
    expected_delivery: "",
    special_instructions: "",
    total_quantity: 0,
    unit_price: 0,
    total_value: 0
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleItemSelect = (item: Item) => {
    const selectedItem: SelectedItem = {
      item_code: item.item_code,
      item_name: item.item_name,
      uom: item.uom,
      usage_type: item.usage_type,
      quantity: 1
    };
    
    const exists = selectedItems.find(si => si.item_code === item.item_code);
    if (!exists) {
      setSelectedItems(prev => [...prev, selectedItem]);
    } else {
      toast({
        title: "Item already selected",
        description: `${item.item_name} is already in the order`,
        variant: "destructive"
      });
    }
  };

  const handleRemoveItem = (itemCode: string) => {
    setSelectedItems(prev => prev.filter(item => item.item_code !== itemCode));
  };

  const handleQuantityChange = (itemCode: string, quantity: number) => {
    setSelectedItems(prev => 
      prev.map(item => 
        item.item_code === itemCode 
          ? { ...item, quantity: Math.max(0, quantity) }
          : item
      )
    );
  };

  const calculateTotals = () => {
    const totalQty = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalVal = totalQty * orderData.unit_price;
    
    setOrderData(prev => ({
      ...prev,
      total_quantity: totalQty,
      total_value: totalVal
    }));
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item for the order",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the main order
      const { data: order, error: orderError } = await supabase
        .from('orders_dashboard_se')
        .insert({
          item_name: orderData.product_description,
          substrate: orderData.product_description,
          po_number: `PO-${Date.now()}`,
          created_by: 'system'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      toast({
        title: "Order created successfully",
        description: `Order ${order.uiorn} has been created with ${selectedItems.length} items`
      });

      // Reset form
      setSelectedItems([]);
      setOrderData({
        product_description: "",
        order_type: "PRINTING",
        priority: "MEDIUM",
        expected_delivery: "",
        special_instructions: "",
        total_quantity: 0,
        unit_price: 0,
        total_value: 0
      });

      onOpenChange(false);

    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: "Failed to create order",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create New Manufacturing Order
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="product_description">Product Description</Label>
                <Textarea
                  id="product_description"
                  value={orderData.product_description}
                  onChange={(e) => setOrderData(prev => ({ ...prev, product_description: e.target.value }))}
                  placeholder="Describe the product to be manufactured"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="order_type">Order Type</Label>
                  <Select value={orderData.order_type} onValueChange={(value) => setOrderData(prev => ({ ...prev, order_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRINTING">Printing</SelectItem>
                      <SelectItem value="LAMINATION">Lamination</SelectItem>
                      <SelectItem value="COATING">Coating</SelectItem>
                      <SelectItem value="SLITTING">Slitting</SelectItem>
                      <SelectItem value="PACKAGING">Packaging</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={orderData.priority} onValueChange={(value) => setOrderData(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="expected_delivery">Expected Delivery Date</Label>
                <Input
                  id="expected_delivery"
                  type="date"
                  value={orderData.expected_delivery}
                  onChange={(e) => setOrderData(prev => ({ ...prev, expected_delivery: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="special_instructions">Special Instructions</Label>
                <Textarea
                  id="special_instructions"
                  value={orderData.special_instructions}
                  onChange={(e) => setOrderData(prev => ({ ...prev, special_instructions: e.target.value }))}
                  placeholder="Any special requirements or instructions"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Item Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Item Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Select Items</Label>
                <ItemSelector onSelect={handleItemSelect} />
              </div>

              {selectedItems.length > 0 && (
                <div className="space-y-3">
                  <Label>Selected Items ({selectedItems.length})</Label>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {selectedItems.map((item, index) => (
                      <div key={item.item_code} className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.item_code}</div>
                          <div className="text-xs text-muted-foreground">{item.item_name}</div>
                          <Badge variant="outline" className="text-xs mt-1">
                            {item.usage_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.item_code, parseInt(e.target.value) || 0)}
                            className="w-20 h-8"
                          />
                          <span className="text-xs text-muted-foreground">{item.uom}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(item.item_code)}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pricing Section */}
              <div className="border-t pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="unit_price">Unit Price (₹)</Label>
                    <Input
                      id="unit_price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={orderData.unit_price}
                      onChange={(e) => setOrderData(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))}
                      onBlur={calculateTotals}
                    />
                  </div>
                  <div>
                    <Label>Total Quantity</Label>
                    <div className="flex items-center h-10 px-3 border rounded-md bg-muted text-sm">
                      {selectedItems.reduce((sum, item) => sum + item.quantity, 0)}
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Total Value</Label>
                  <div className="flex items-center h-10 px-3 border rounded-md bg-muted font-medium">
                    ₹ {(selectedItems.reduce((sum, item) => sum + item.quantity, 0) * orderData.unit_price).toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            Ensure all required fields are filled before creating the order
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || selectedItems.length === 0}
              className="min-w-32"
            >
              {isSubmitting ? "Creating..." : "Create Order"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
