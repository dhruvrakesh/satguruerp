
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Save, X, Upload, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useItemPricing, useUpdateItemPrice, useAddItemPrice } from "@/hooks/useItemPricing";
import { useCostCategories } from "@/hooks/useCostCategories";
import { useCategories } from "@/hooks/useCategories";
import { ItemPricingCSVUpload } from "./ItemPricingCSVUpload";

export function ItemPricingMaster() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCostCategory, setSelectedCostCategory] = useState("all");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [newItemData, setNewItemData] = useState({
    item_code: "",
    current_price: "",
    cost_category: "",
    supplier: "",
    price_change_reason: ""
  });

  // Use real data from hooks
  const { data: pricingEntries = [], isLoading, error } = useItemPricing({
    category: selectedCategory,
    costCategory: selectedCostCategory,
    search: searchTerm
  });
  
  const { costCategories = [] } = useCostCategories();
  const { data: categories = [] } = useCategories();
  const updatePriceMutation = useUpdateItemPrice();
  const addPriceMutation = useAddItemPrice();

  const handlePriceUpdate = (itemCode: string) => {
    if (!newPrice || parseFloat(newPrice) <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price greater than 0",
        variant: "destructive",
      });
      return;
    }

    updatePriceMutation.mutate({
      itemCode,
      newPrice: parseFloat(newPrice),
      reason: "Manual price update"
    }, {
      onSuccess: () => {
        setEditingItem(null);
        setNewPrice("");
      }
    });
  };

  const handleAddPrice = () => {
    if (!newItemData.item_code || !newItemData.current_price || !newItemData.cost_category) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    addPriceMutation.mutate({
      item_code: newItemData.item_code,
      item_name: "", // Will be populated from item master
      category: "",
      uom: "KG",
      current_price: parseFloat(newItemData.current_price),
      cost_category: newItemData.cost_category,
      supplier: newItemData.supplier,
      effective_date: new Date().toISOString().split('T')[0],
      is_active: true,
      approval_status: "PENDING" as const,
      price_change_reason: newItemData.price_change_reason
    }, {
      onSuccess: () => {
        setNewItemData({
          item_code: "",
          current_price: "",
          cost_category: "",
          supplier: "",
          price_change_reason: ""
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Error loading pricing data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Item Pricing Master</h2>
          <p className="text-muted-foreground">Manage item prices and cost categories</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => setShowBulkUpload(!showBulkUpload)}
          >
            <Upload className="w-4 h-4" />
            Import Prices
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export Prices
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Item Price
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Item Price</DialogTitle>
                <DialogDescription>
                  Enter pricing information for a new item
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="itemCode">Item Code</Label>
                  <Input 
                    id="itemCode" 
                    placeholder="Enter item code"
                    value={newItemData.item_code}
                    onChange={(e) => setNewItemData(prev => ({ ...prev, item_code: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="price">Price</Label>
                  <Input 
                    id="price" 
                    type="number" 
                    placeholder="Enter price"
                    value={newItemData.current_price}
                    onChange={(e) => setNewItemData(prev => ({ ...prev, current_price: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="costCategory">Cost Category</Label>
                  <Select 
                    value={newItemData.cost_category}
                    onValueChange={(value) => setNewItemData(prev => ({ ...prev, cost_category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select cost category" />
                    </SelectTrigger>
                    <SelectContent>
                      {costCategories.map((category) => (
                        <SelectItem key={category.id} value={category.category_name}>
                          {category.category_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supplier">Supplier (Optional)</Label>
                  <Input 
                    id="supplier" 
                    placeholder="Enter supplier code"
                    value={newItemData.supplier}
                    onChange={(e) => setNewItemData(prev => ({ ...prev, supplier: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Input 
                    id="reason" 
                    placeholder="Reason for pricing"
                    value={newItemData.price_change_reason}
                    onChange={(e) => setNewItemData(prev => ({ ...prev, price_change_reason: e.target.value }))}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleAddPrice}
                  disabled={addPriceMutation.isPending}
                >
                  {addPriceMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Price Entry"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk Upload Section */}
      {showBulkUpload && (
        <ItemPricingCSVUpload onUploadComplete={() => setShowBulkUpload(false)} />
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Search Items</Label>
              <Input 
                placeholder="Search by code or name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.category_name}>
                      {category.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cost Category</Label>
              <Select value={selectedCostCategory} onValueChange={setSelectedCostCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cost Categories</SelectItem>
                  {costCategories.map((category) => (
                    <SelectItem key={category.id} value={category.category_name}>
                      {category.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full">Reset Filters</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Table */}
      <Card>
        <CardHeader>
          <CardTitle>Current Pricing Data</CardTitle>
          <CardDescription>
            Manage and update item prices across all categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead>Current Price</TableHead>
                <TableHead>Previous Price</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Cost Category</TableHead>
                <TableHead>Approval Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricingEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No pricing data available. Add some items to get started.
                  </TableCell>
                </TableRow>
              ) : (
                pricingEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.item_code}</TableCell>
                    <TableCell>{entry.item_name}</TableCell>
                    <TableCell>{entry.category}</TableCell>
                    <TableCell>{entry.uom}</TableCell>
                    <TableCell>
                      {editingItem === entry.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value)}
                            className="w-24"
                            placeholder={entry.current_price.toString()}
                          />
                           <Button
                             size="sm"
                             onClick={() => handlePriceUpdate(entry.item_code)}
                             disabled={updatePriceMutation.isPending}
                             className="gap-1"
                           >
                            {updatePriceMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingItem(null);
                              setNewPrice("");
                            }}
                            className="gap-1"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <span>₹{entry.current_price.toFixed(2)}</span>
                      )}
                    </TableCell>
                    <TableCell>₹{(entry.previous_price || 0).toFixed(2)}</TableCell>
                    <TableCell>{entry.effective_date}</TableCell>
                    <TableCell>{entry.cost_category}</TableCell>
                    <TableCell>
                      <Badge variant={
                        entry.approval_status === 'APPROVED' ? "default" : 
                        entry.approval_status === 'PENDING' ? "secondary" : 
                        "destructive"
                      }>
                        {entry.approval_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingItem(entry.id);
                          setNewPrice(entry.current_price.toString());
                        }}
                        disabled={updatePriceMutation.isPending}
                        className="gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
