
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Plus, CheckCircle, Info, Package, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ItemMasterQuickAddProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingItemCodes: string[];
  onItemsAdded: () => void;
}

interface QuickAddItem {
  item_code: string;
  item_name: string;
  category: string;
  uom: string;
  description: string;
  usage_type: string;
}

export function ItemMasterQuickAdd({ open, onOpenChange, missingItemCodes, onItemsAdded }: ItemMasterQuickAddProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<QuickAddItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [currentItem, setCurrentItem] = useState<QuickAddItem>({
    item_code: '',
    item_name: '',
    category: 'Raw Material',
    uom: 'KG',
    description: '',
    usage_type: 'RAW_MATERIAL'
  });
  const queryClient = useQueryClient();

  const initializeItems = () => {
    if (missingItemCodes.length > 0 && items.length === 0) {
      const initialItems = missingItemCodes.map(code => ({
        item_code: code,
        item_name: generateSmartItemName(code),
        category: inferCategory(code),
        uom: 'KG',
        description: `Auto-generated for ${code}`,
        usage_type: 'RAW_MATERIAL'
      }));
      setItems(initialItems);
    }
  };

  const generateSmartItemName = (itemCode: string): string => {
    // Smart name generation based on item code patterns
    if (itemCode.includes('ADH')) return `Adhesive Material - ${itemCode}`;
    if (itemCode.includes('INK')) return `Printing Ink - ${itemCode}`;
    if (itemCode.includes('FILM')) return `Film Material - ${itemCode}`;
    if (itemCode.includes('FOIL')) return `Foil Material - ${itemCode}`;
    if (itemCode.includes('PAPER')) return `Paper Material - ${itemCode}`;
    if (itemCode.includes('CHEM')) return `Chemical - ${itemCode}`;
    
    return `Raw Material - ${itemCode}`;
  };

  const inferCategory = (itemCode: string): string => {
    if (itemCode.includes('ADH')) return 'Adhesives';
    if (itemCode.includes('INK')) return 'Inks';
    if (itemCode.includes('FILM')) return 'Films';
    if (itemCode.includes('FOIL')) return 'Foils';
    if (itemCode.includes('PAPER')) return 'Papers';
    if (itemCode.includes('CHEM')) return 'Chemicals';
    
    return 'Raw Material';
  };

  const updateItem = (index: number, field: keyof QuickAddItem, value: string) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addCustomItem = () => {
    if (!currentItem.item_code.trim() || !currentItem.item_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Item code and name are required",
        variant: "destructive"
      });
      return;
    }

    setItems([...items, { ...currentItem }]);
    setCurrentItem({
      item_code: '',
      item_name: '',
      category: 'Raw Material',
      uom: 'KG',
      description: '',
      usage_type: 'RAW_MATERIAL'
    });
  };

  const handleBulkAdd = async () => {
    if (items.length === 0) {
      toast({
        title: "No Items",
        description: "Please add at least one item",
        variant: "destructive"
      });
      return;
    }

    setIsAdding(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const item of items) {
        try {
          const { error } = await supabase
            .from('satguru_item_master')
            .insert({
              item_code: item.item_code,
              item_name: item.item_name,
              category: item.category,
              uom: item.uom,
              description: item.description,
              usage_type: item.usage_type,
              is_active: true,
              created_at: new Date().toISOString()
            });

          if (error) {
            console.error(`Error adding ${item.item_code}:`, error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          console.error(`Exception adding ${item.item_code}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['satguru_item_master'] });
        
        toast({
          title: "Items Added Successfully",
          description: `Added ${successCount} items to item master${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
        });

        // Clear items and notify parent
        setItems([]);
        onItemsAdded();
        
        if (errorCount === 0) {
          onOpenChange(false);
        }
      } else {
        toast({
          title: "Addition Failed",
          description: "No items were added successfully",
          variant: "destructive"
        });
      }

    } catch (error: any) {
      toast({
        title: "Bulk Add Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };

  // Initialize items when dialog opens
  if (open && items.length === 0 && missingItemCodes.length > 0) {
    initializeItems();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Quick Add Missing Items to Master
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Smart Item Creation:</strong> Pre-filled suggestions based on item codes. 
              Review and modify before adding to item master.
            </AlertDescription>
          </Alert>

          {/* Add Custom Item */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Custom Item
              </CardTitle>
              <CardDescription>
                Manually add a new item if it's not in the auto-suggestions below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Item Code</Label>
                  <Input
                    value={currentItem.item_code}
                    onChange={(e) => setCurrentItem({...currentItem, item_code: e.target.value})}
                    placeholder="Enter item code"
                  />
                </div>
                <div>
                  <Label>Item Name</Label>
                  <Input
                    value={currentItem.item_name}
                    onChange={(e) => setCurrentItem({...currentItem, item_name: e.target.value})}
                    placeholder="Enter item name"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input
                    value={currentItem.category}
                    onChange={(e) => setCurrentItem({...currentItem, category: e.target.value})}
                    placeholder="Enter category"
                  />
                </div>
                <div>
                  <Label>Unit of Measure</Label>
                  <Select value={currentItem.uom} onValueChange={(value) => setCurrentItem({...currentItem, uom: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KG">KG</SelectItem>
                      <SelectItem value="METRE">METRE</SelectItem>
                      <SelectItem value="LITRE">LITRE</SelectItem>
                      <SelectItem value="PCS">PCS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={currentItem.description}
                    onChange={(e) => setCurrentItem({...currentItem, description: e.target.value})}
                    placeholder="Enter description"
                    rows={2}
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={addCustomItem} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Auto-suggested Items */}
          {items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Items to Add ({items.length})
                </CardTitle>
                <CardDescription>
                  Review and modify the auto-generated items before adding to master
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {items.map((item, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex justify-between items-start">
                        <Badge variant="outline">{item.item_code}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeItem(index)}
                          className="text-red-600"
                        >
                          Remove
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Item Name</Label>
                          <Input
                            value={item.item_name}
                            onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Category</Label>
                          <Input
                            value={item.category}
                            onChange={(e) => updateItem(index, 'category', e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">UOM</Label>
                          <Select 
                            value={item.uom} 
                            onValueChange={(value) => updateItem(index, 'uom', value)}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="KG">KG</SelectItem>
                              <SelectItem value="METRE">METRE</SelectItem>
                              <SelectItem value="LITRE">LITRE</SelectItem>
                              <SelectItem value="PCS">PCS</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Usage Type</Label>
                          <Select 
                            value={item.usage_type} 
                            onValueChange={(value) => updateItem(index, 'usage_type', value)}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="RAW_MATERIAL">Raw Material</SelectItem>
                              <SelectItem value="FINISHED_GOOD">Finished Good</SelectItem>
                              <SelectItem value="CONSUMABLE">Consumable</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {items.length > 0 && (
              <Button
                onClick={handleBulkAdd}
                disabled={isAdding}
                className="min-w-[120px]"
              >
                {isAdding ? (
                  <>Adding...</>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Add {items.length} Items
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
