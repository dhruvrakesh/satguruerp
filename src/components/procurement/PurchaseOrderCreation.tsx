
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Minus, Package, Calendar, AlertCircle } from "lucide-react";
import { ItemCodeSelector } from "./ItemCodeSelector";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { toast } from "sonner";

interface ItemData {
  item_code: string;
  item_name: string;
  uom: string;
  category_name?: string;
  current_stock?: number;
  last_purchase?: {
    price: number;
    date: string;
    vendor: string;
  };
}

interface POItem {
  id: string;
  item_code: string;
  item_name: string;
  uom: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  current_stock?: number;
  last_purchase?: {
    price: number;
    date: string;
    vendor: string;
  };
}

const poSchema = z.object({
  supplier_id: z.string().min(1, "Please select a supplier"),
  po_date: z.string().min(1, "PO date is required"),
  required_date: z.string().optional(),
  delivery_date: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT", "EMERGENCY"]),
  department: z.string().optional(),
  notes: z.string().optional(),
});

type POFormData = z.infer<typeof poSchema>;

interface PurchaseOrderCreationProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PurchaseOrderCreation({ onSuccess, onCancel }: PurchaseOrderCreationProps) {
  const [items, setItems] = useState<POItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const { suppliers, createPurchaseOrder, addPOItems } = usePurchaseOrders();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<POFormData>({
    resolver: zodResolver(poSchema),
    defaultValues: {
      po_date: new Date().toISOString().split('T')[0],
      priority: "MEDIUM",
    },
  });

  const addItem = () => {
    setItems([...items, {
      id: Date.now().toString(),
      item_code: "",
      item_name: "",
      uom: "",
      quantity: 1,
      unit_price: 0,
      line_total: 0,
    }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof POItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unit_price') {
          updated.line_total = updated.quantity * updated.unit_price;
        }
        return updated;
      }
      return item;
    }));
  };

  const handleItemCodeSelect = (id: string, itemCode: string, itemData: ItemData) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return {
          ...item,
          item_code: itemCode,
          item_name: itemData.item_name,
          uom: itemData.uom,
          current_stock: itemData.current_stock,
          last_purchase: itemData.last_purchase,
          line_total: item.quantity * item.unit_price,
        };
      }
      return item;
    }));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.line_total, 0);
  };

  const onSubmit = async (data: POFormData) => {
    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    if (items.some(item => !item.item_code || item.quantity <= 0 || item.unit_price <= 0)) {
      toast.error("Please ensure all items have valid codes, quantities, and prices");
      return;
    }

    try {
      const poData = {
        ...data,
        supplier_id: selectedSupplierId,
        total_amount: calculateTotal(),
        status: 'DRAFT' as const,
      };

      const po = await createPurchaseOrder(poData);
      
      if (po) {
        await addPOItems(po.id, items.map(item => ({
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          uom: item.uom,
        })));
        
        toast.success("Purchase order created successfully");
        onSuccess?.();
      }
    } catch (error) {
      toast.error("Failed to create purchase order");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header Information */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier">Supplier *</Label>
              <Select value={selectedSupplierId} onValueChange={(value) => {
                setSelectedSupplierId(value);
                setValue("supplier_id", value);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      <div className="flex flex-col">
                        <span>{supplier.supplier_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {supplier.supplier_code} • {supplier.category}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.supplier_id && (
                <p className="text-sm text-destructive mt-1">{errors.supplier_id.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select onValueChange={(value) => setValue("priority", value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="po_date">PO Date *</Label>
              <Input
                id="po_date"
                type="date"
                {...register("po_date")}
              />
              {errors.po_date && (
                <p className="text-sm text-destructive mt-1">{errors.po_date.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="required_date">Required Date</Label>
              <Input
                id="required_date"
                type="date"
                {...register("required_date")}
              />
            </div>

            <div>
              <Label htmlFor="delivery_date">Delivery Date</Label>
              <Input
                id="delivery_date"
                type="date"
                {...register("delivery_date")}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              {...register("department")}
              placeholder="e.g., Production, Maintenance"
            />
          </div>
        </CardContent>
      </Card>

      {/* Items Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Items</CardTitle>
            <Button type="button" onClick={addItem} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No items added yet</p>
              <p className="text-sm">Click "Add Item" to start building your purchase order</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <h4 className="font-medium">Item {index + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label>Item Code *</Label>
                      <ItemCodeSelector
                        value={item.item_code}
                        onChange={(itemCode, itemData) => handleItemCodeSelect(item.id, itemCode, itemData)}
                        vendorId={selectedSupplierId}
                      />
                    </div>

                    {item.item_code && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Item Name</Label>
                          <Input
                            value={item.item_name}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                        <div>
                          <Label>UOM</Label>
                          <Input
                            value={item.uom}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <Label>Unit Price (₹) *</Label>
                        <Input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <Label>Line Total (₹)</Label>
                        <Input
                          value={item.line_total.toFixed(2)}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    </div>

                    {/* Purchase History Display */}
                    {item.last_purchase && (
                      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Last Purchase Info</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                          <div>Price: ₹{item.last_purchase.price.toFixed(2)}</div>
                          <div>Date: {new Date(item.last_purchase.date).toLocaleDateString()}</div>
                          <div>Vendor: {item.last_purchase.vendor}</div>
                        </div>
                      </div>
                    )}

                    {/* Stock Status */}
                    {item.current_stock !== undefined && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          Current Stock: {item.current_stock} {item.uom}
                        </Badge>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Items:</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Quantity:</span>
                <span>{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Amount:</span>
                <span>₹{calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            {...register("notes")}
            placeholder="Any special instructions or notes for this purchase order..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Create Purchase Order
        </Button>
      </div>
    </form>
  );
}
