
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface CostCategory {
  id: string;
  categoryCode: string;
  categoryName: string;
  description: string;
  parentCategory?: string;
  level: number;
  displayOrder: number;
  isActive: boolean;
  defaultPercentage?: number;
  applicableItems: string[];
}

export function CostCategoryManager() {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryData, setNewCategoryData] = useState({
    categoryCode: "",
    categoryName: "",
    description: "",
    parentCategory: "",
    defaultPercentage: ""
  });

  // Mock data - replace with actual data from hooks
  const costCategories: CostCategory[] = [
    {
      id: "1",
      categoryCode: "RM",
      categoryName: "Raw Materials",
      description: "Primary raw materials used in production",
      level: 1,
      displayOrder: 1,
      isActive: true,
      defaultPercentage: 60,
      applicableItems: ["CHE_001", "CHE_002"]
    },
    {
      id: "2",
      categoryCode: "SUB",
      categoryName: "Substrates",
      description: "Base substrates for printing",
      parentCategory: "Raw Materials",
      level: 2,
      displayOrder: 2,
      isActive: true,
      defaultPercentage: 25,
      applicableItems: ["PAC_001", "PAC_002"]
    },
    {
      id: "3",
      categoryCode: "LAB",
      categoryName: "Labor",
      description: "Direct and indirect labor costs",
      level: 1,
      displayOrder: 3,
      isActive: true,
      defaultPercentage: 15,
      applicableItems: []
    }
  ];

  const handleSaveCategory = () => {
    if (!newCategoryData.categoryCode || !newCategoryData.categoryName) {
      toast({
        title: "Validation Error",
        description: "Category code and name are required",
        variant: "destructive",
      });
      return;
    }

    // Save category logic here
    console.log("Saving category:", newCategoryData);
    
    toast({
      title: "Category Saved",
      description: "Cost category has been successfully saved",
    });
    
    setNewCategoryData({
      categoryCode: "",
      categoryName: "",
      description: "",
      parentCategory: "",
      defaultPercentage: ""
    });
  };

  const handleDeleteCategory = (categoryId: string) => {
    // Delete category logic here
    console.log("Deleting category:", categoryId);
    
    toast({
      title: "Category Deleted",
      description: "Cost category has been successfully deleted",
    });
  };

  const toggleCategoryStatus = (categoryId: string, isActive: boolean) => {
    // Toggle status logic here
    console.log(`Toggling category ${categoryId} to ${isActive ? 'active' : 'inactive'}`);
    
    toast({
      title: "Status Updated",
      description: `Category has been ${isActive ? 'activated' : 'deactivated'}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cost Category Manager</h2>
          <p className="text-muted-foreground">Define and manage cost categories for valuation</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Cost Category</DialogTitle>
              <DialogDescription>
                Create a new cost category for item classification
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="categoryCode">Category Code</Label>
                <Input 
                  id="categoryCode" 
                  placeholder="e.g., RM, SUB, LAB"
                  value={newCategoryData.categoryCode}
                  onChange={(e) => setNewCategoryData(prev => ({ ...prev, categoryCode: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="categoryName">Category Name</Label>
                <Input 
                  id="categoryName" 
                  placeholder="e.g., Raw Materials"
                  value={newCategoryData.categoryName}
                  onChange={(e) => setNewCategoryData(prev => ({ ...prev, categoryName: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input 
                  id="description" 
                  placeholder="Category description"
                  value={newCategoryData.description}
                  onChange={(e) => setNewCategoryData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="parentCategory">Parent Category (Optional)</Label>
                <Select onValueChange={(value) => setNewCategoryData(prev => ({ ...prev, parentCategory: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Parent</SelectItem>
                    {costCategories.filter(cat => cat.level === 1).map(cat => (
                      <SelectItem key={cat.id} value={cat.categoryName}>
                        {cat.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="defaultPercentage">Default Percentage</Label>
                <Input 
                  id="defaultPercentage" 
                  type="number"
                  placeholder="Default cost percentage"
                  value={newCategoryData.defaultPercentage}
                  onChange={(e) => setNewCategoryData(prev => ({ ...prev, defaultPercentage: e.target.value }))}
                />
              </div>
              <Button onClick={handleSaveCategory} className="w-full">
                Add Category
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cost Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Categories</CardTitle>
          <CardDescription>
            Manage hierarchical cost categories for comprehensive valuation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Category Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Parent Category</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Default %</TableHead>
                <TableHead>Applicable Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costCategories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.categoryCode}</TableCell>
                  <TableCell>
                    <div style={{ paddingLeft: `${(category.level - 1) * 20}px` }}>
                      {category.categoryName}
                    </div>
                  </TableCell>
                  <TableCell>{category.description}</TableCell>
                  <TableCell>{category.parentCategory || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">Level {category.level}</Badge>
                  </TableCell>
                  <TableCell>
                    {category.defaultPercentage ? `${category.defaultPercentage}%` : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {category.applicableItems.length} items
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={category.isActive}
                      onCheckedChange={(checked) => toggleCategoryStatus(category.id, checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingCategory(category.id)}
                        className="gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteCategory(category.id)}
                        className="gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cost Allocation Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Allocation Rules</CardTitle>
          <CardDescription>
            Define how costs are allocated across different categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <h4 className="font-medium">Allocation Method</h4>
              <Select defaultValue="percentage">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage Based</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                  <SelectItem value="weighted">Weighted Average</SelectItem>
                  <SelectItem value="activity">Activity Based</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium">Update Frequency</h4>
              <Select defaultValue="monthly">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
