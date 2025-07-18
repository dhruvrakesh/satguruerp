import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderTree, Plus, Edit, Trash2, Package, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCategories, useCategoryMutations, useCategoryStats, CategoryStats } from "@/hooks/useCategories";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

interface CategoryFormData {
  category_name: string;
  description: string;
}

export default function CategoriesManagement() {
  const { data: categoryStats = [], isLoading } = useCategoryStats();
  const { createCategory, updateCategory, deleteCategory } = useCategoryMutations();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryStats | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({ category_name: "", description: "" });

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category_name.trim()) return;
    
    await createCategory.mutateAsync({
      category_name: formData.category_name.trim(),
      description: formData.description.trim() || undefined
    });
    
    setFormData({ category_name: "", description: "" });
    setIsCreateDialogOpen(false);
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !formData.category_name.trim()) return;
    
    await updateCategory.mutateAsync({
      id: editingCategory.id,
      updates: {
        category_name: formData.category_name.trim(),
        description: formData.description.trim() || undefined
      }
    });
    
    setEditingCategory(null);
    setFormData({ category_name: "", description: "" });
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm("Are you sure you want to delete this category? This action cannot be undone.")) {
      await deleteCategory.mutateAsync(id);
    }
  };

  const openEditDialog = (category: CategoryStats) => {
    setEditingCategory(category);
    setFormData({
      category_name: category.category_name,
      description: category.description || ""
    });
  };

  const getUsageTypeStats = (category: CategoryStats) => {
    const stats = [
      { type: "FG", count: category.fg_items, color: "bg-primary" },
      { type: "RM", count: category.rm_items, color: "bg-secondary" },
      { type: "PK", count: category.packaging_items, color: "bg-accent" },
      { type: "CN", count: category.consumable_items, color: "bg-muted" }
    ].filter(stat => stat.count > 0);
    
    return stats;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Categories Management</h1>
          <p className="text-muted-foreground">Organize and manage inventory categories with FG/RM intelligence</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Category</DialogTitle>
              <DialogDescription>
                Add a new category to organize your inventory items.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <Label htmlFor="category_name">Category Name</Label>
                <Input
                  id="category_name"
                  value={formData.category_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, category_name: e.target.value }))}
                  placeholder="e.g., Raw Materials, Finished Goods"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description for this category"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createCategory.isPending}>
                  {createCategory.isPending ? "Creating..." : "Create Category"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="w-5 h-5" />
              Category Hierarchy
            </CardTitle>
            <CardDescription>
              Manage categories with FG/RM item breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading categories...</div>
            ) : categoryStats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No categories found. Create your first category to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {categoryStats.map((category) => (
                  <div key={category.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium">{category.category_name}</h3>
                        <div className="flex gap-1">
                          {getUsageTypeStats(category).map(stat => (
                            <Badge key={stat.type} variant="outline" className="text-xs">
                              {stat.type}: {stat.count}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-1">
                        {category.total_items} total items • {category.active_items} active
                      </p>
                      
                      {category.description && (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          {category.description}
                        </p>
                      )}
                      
                      <div className="flex gap-2 mt-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Package className="w-3 h-3" />
                          FG: {category.fg_items}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Factory className="w-3 h-3" />
                          RM: {category.rm_items}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{category.total_items}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(category)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteCategory(category.id)}
                        disabled={category.total_items > 0}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Statistics</CardTitle>
            <CardDescription>
              FG/RM distribution and usage analytics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {categoryStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No data available yet. Create categories and add items to see statistics.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {categoryStats.reduce((sum, cat) => sum + cat.fg_items, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Finished Goods</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-secondary">
                        {categoryStats.reduce((sum, cat) => sum + cat.rm_items, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Raw Materials</div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium">Category Breakdown</h4>
                    {categoryStats.slice(0, 5).map(category => (
                      <div key={category.id} className="flex justify-between items-center text-sm">
                        <span className="font-medium">{category.category_name}</span>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">
                            FG: {category.fg_items}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            RM: {category.rm_items}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category information.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCategory} className="space-y-4">
            <div>
              <Label htmlFor="edit_category_name">Category Name</Label>
              <Input
                id="edit_category_name"
                value={formData.category_name}
                onChange={(e) => setFormData(prev => ({ ...prev, category_name: e.target.value }))}
                placeholder="e.g., Raw Materials, Finished Goods"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description for this category"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingCategory(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateCategory.isPending}>
                {updateCategory.isPending ? "Updating..." : "Update Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}