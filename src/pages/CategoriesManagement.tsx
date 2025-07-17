import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderTree, Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function CategoriesManagement() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Categories Management</h1>
          <p className="text-muted-foreground">Organize and manage inventory categories</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Category
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="w-5 h-5" />
              Category Hierarchy
            </CardTitle>
            <CardDescription>
              Manage the organizational structure of inventory categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "Raw Materials", count: 156, subcategories: 8 },
                { name: "Packaging Materials", count: 89, subcategories: 5 },
                { name: "Chemicals & Inks", count: 67, subcategories: 3 },
                { name: "Finished Goods", count: 234, subcategories: 12 },
                { name: "Consumables", count: 45, subcategories: 4 },
              ].map((category) => (
                <div key={category.name} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {category.count} items • {category.subcategories} subcategories
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{category.count}</Badge>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Statistics</CardTitle>
            <CardDescription>
              Overview of category usage and distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center py-8 text-muted-foreground">
                Category statistics and charts will be displayed here
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}