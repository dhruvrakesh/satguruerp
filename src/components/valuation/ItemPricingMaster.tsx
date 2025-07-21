
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit2, Save, X, Upload, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface PricingEntry {
  id: string;
  itemCode: string;
  itemName: string;
  category: string;
  uom: string;
  currentPrice: number;
  lastUpdatedPrice: number;
  priceDate: string;
  costCategory: string;
  supplier: string;
  isActive: boolean;
}

export function ItemPricingMaster() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCostCategory, setSelectedCostCategory] = useState("all");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Mock data - replace with actual data from hooks
  const pricingEntries: PricingEntry[] = [
    {
      id: "1",
      itemCode: "CHE_001",
      itemName: "Printing Ink - Cyan",
      category: "Chemicals",
      uom: "KG",
      currentPrice: 450.00,
      lastUpdatedPrice: 430.00,
      priceDate: "2024-01-15",
      costCategory: "Raw Materials",
      supplier: "Supplier A",
      isActive: true
    },
    {
      id: "2",
      itemCode: "PAC_002",
      itemName: "BOPP Film 20 micron",
      category: "Packaging",
      uom: "KG",
      currentPrice: 125.00,
      lastUpdatedPrice: 120.00,
      priceDate: "2024-01-14",
      costCategory: "Substrates",
      supplier: "Supplier B",
      isActive: true
    }
  ];

  const handlePriceUpdate = (itemId: string) => {
    if (!newPrice || parseFloat(newPrice) <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price greater than 0",
        variant: "destructive",
      });
      return;
    }

    // Update price logic here
    console.log(`Updating item ${itemId} with new price: ${newPrice}`);
    
    toast({
      title: "Price Updated",
      description: "Item price has been successfully updated",
    });
    
    setEditingItem(null);
    setNewPrice("");
  };

  const filteredEntries = pricingEntries.filter(entry => {
    const matchesCategory = selectedCategory === "all" || entry.category === selectedCategory;
    const matchesCostCategory = selectedCostCategory === "all" || entry.costCategory === selectedCostCategory;
    const matchesSearch = searchTerm === "" || 
      entry.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.itemName.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesCostCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Item Pricing Master</h2>
          <p className="text-muted-foreground">Manage item prices and cost categories</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
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
                  <Input id="itemCode" placeholder="Enter item code" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="price">Price</Label>
                  <Input id="price" type="number" placeholder="Enter price" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="costCategory">Cost Category</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select cost category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw_materials">Raw Materials</SelectItem>
                      <SelectItem value="substrates">Substrates</SelectItem>
                      <SelectItem value="chemicals">Chemicals</SelectItem>
                      <SelectItem value="packaging">Packaging</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full">Add Price Entry</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
                  <SelectItem value="Chemicals">Chemicals</SelectItem>
                  <SelectItem value="Packaging">Packaging</SelectItem>
                  <SelectItem value="Raw Materials">Raw Materials</SelectItem>
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
                  <SelectItem value="Raw Materials">Raw Materials</SelectItem>
                  <SelectItem value="Substrates">Substrates</SelectItem>
                  <SelectItem value="Chemicals">Chemicals</SelectItem>
                  <SelectItem value="Packaging">Packaging</SelectItem>
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
                <TableHead>Last Updated</TableHead>
                <TableHead>Cost Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.itemCode}</TableCell>
                  <TableCell>{entry.itemName}</TableCell>
                  <TableCell>{entry.category}</TableCell>
                  <TableCell>{entry.uom}</TableCell>
                  <TableCell>
                    {editingItem === entry.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={newPrice}
                          onChange={(e) => setNewPrice(e.target.value)}
                          className="w-20"
                          placeholder={entry.currentPrice.toString()}
                        />
                        <Button
                          size="sm"
                          onClick={() => handlePriceUpdate(entry.id)}
                          className="gap-1"
                        >
                          <Save className="w-3 h-3" />
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
                      <span>₹{entry.currentPrice.toFixed(2)}</span>
                    )}
                  </TableCell>
                  <TableCell>₹{entry.lastUpdatedPrice.toFixed(2)}</TableCell>
                  <TableCell>{entry.priceDate}</TableCell>
                  <TableCell>{entry.costCategory}</TableCell>
                  <TableCell>
                    <Badge variant={entry.isActive ? "default" : "secondary"}>
                      {entry.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingItem(entry.id);
                        setNewPrice(entry.currentPrice.toString());
                      }}
                      className="gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </Button>
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
