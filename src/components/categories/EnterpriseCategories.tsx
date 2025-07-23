
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  BarChart3, 
  Settings, 
  Edit, 
  Trash2, 
  Eye,
  Package,
  DollarSign,
  TrendingUp,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { 
  useEnhancedCategories, 
  useEnhancedCategoryMutations, 
  useCategoryAnalytics,
  CategoryFilters,
  CategorySortOptions,
  EnhancedCategory
} from "@/hooks/useEnhancedCategories";
import { EnhancedCategoryForm } from "./EnhancedCategoryForm";
import { CategoryAnalyticsDashboard } from "./CategoryAnalyticsDashboard";
import { BulkOperationsPanel } from "./BulkOperationsPanel";
import { CategoryImportExport } from "./CategoryImportExport";
import { toast } from "@/hooks/use-toast";

// Constants for Select component values
const FILTER_ALL_VALUE = "all";
const FILTER_ACTIVE_VALUE = "active";
const FILTER_INACTIVE_VALUE = "inactive";

export function EnterpriseCategories() {
  const [activeTab, setActiveTab] = useState("categories");
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<CategoryFilters>({});
  const [sortOptions, setSortOptions] = useState<CategorySortOptions>({
    field: 'category_name',
    direction: 'asc'
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [editingCategory, setEditingCategory] = useState<EnhancedCategory | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // UI state for filter selects
  const [categoryTypeFilter, setCategoryTypeFilter] = useState(FILTER_ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState(FILTER_ALL_VALUE);

  // Data hooks
  const { 
    data: categories = [], 
    isLoading: categoriesLoading, 
    error: categoriesError,
    refetch: refetchCategories 
  } = useEnhancedCategories(filters, sortOptions);
  
  const { 
    data: analytics, 
    isLoading: analyticsLoading 
  } = useCategoryAnalytics();

  const { 
    updateCategory, 
    deleteCategory 
  } = useEnhancedCategoryMutations();

  // Filtered categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories;
    return categories.filter(cat => 
      cat.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.category_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categories, searchTerm]);

  // Handlers
  const handleSelectCategory = (categoryId: string, checked: boolean) => {
    setSelectedCategories(prev => 
      checked 
        ? [...prev, categoryId]
        : prev.filter(id => id !== categoryId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedCategories(checked ? filteredCategories.map(cat => cat.id) : []);
  };

  const handleEditCategory = (category: EnhancedCategory) => {
    setEditingCategory(category);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (window.confirm('Are you sure you want to deactivate this category?')) {
      try {
        await deleteCategory.mutateAsync(categoryId);
        refetchCategories();
      } catch (error) {
        console.error('Error deleting category:', error);
      }
    }
  };

  const handleQuickEdit = async (categoryId: string, field: string, value: any) => {
    try {
      await updateCategory.mutateAsync({
        id: categoryId,
        updates: { [field]: value }
      });
      refetchCategories();
    } catch (error) {
      console.error('Error updating category:', error);
    }
  };

  const handleRefresh = () => {
    refetchCategories();
    toast({
      title: "Categories Refreshed",
      description: "Category data has been updated",
    });
  };

  const handleClearSelection = () => {
    setSelectedCategories([]);
  };

  const handleFormClose = () => {
    setEditingCategory(null);
    setShowCreateForm(false);
  };

  const handleFormSuccess = () => {
    refetchCategories();
    handleFormClose();
  };

  // Filter handlers
  const handleCategoryTypeFilter = (value: string) => {
    setCategoryTypeFilter(value);
    setFilters(prev => ({ 
      ...prev, 
      category_type: value === FILTER_ALL_VALUE ? undefined : value 
    }));
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setFilters(prev => ({ 
      ...prev, 
      is_active: value === FILTER_ALL_VALUE ? undefined : value === FILTER_ACTIVE_VALUE
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(value);
  };

  const renderCategoryRow = (category: EnhancedCategory) => (
    <TableRow key={category.id} className="hover:bg-muted/50">
      <TableCell className="w-12">
        <Checkbox
          checked={selectedCategories.includes(category.id)}
          onCheckedChange={(checked) => handleSelectCategory(category.id, checked as boolean)}
        />
      </TableCell>
      <TableCell className="font-medium">{category.category_name}</TableCell>
      <TableCell>{category.category_code || '-'}</TableCell>
      <TableCell>{category.description || '-'}</TableCell>
      <TableCell>
        <Badge variant={category.category_type === 'STANDARD' ? 'default' : 
                      category.category_type === 'SYSTEM' ? 'secondary' : 'outline'}>
          {category.category_type}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={category.is_active ? 'default' : 'destructive'}>
          {category.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell className="text-right">{category.total_items}</TableCell>
      <TableCell className="text-right">{formatCurrency(category.avg_item_value)}</TableCell>
      <TableCell className="text-right">{formatCurrency(category.avg_item_value * category.total_items)}</TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditCategory(category)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteCategory(category.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  if (categoriesError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error loading categories: {categoriesError.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Enterprise Categories</h1>
          <p className="text-muted-foreground">
            Manage product categories with advanced analytics and bulk operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Category
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Categories</p>
                  <p className="text-2xl font-bold">{analytics.totalCategories}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <Package className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold">{analytics.totalItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <TrendingUp className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Items/Category</p>
                  <p className="text-2xl font-bold">{analytics.avgItemsPerCategory}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(analytics.totalValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Operations</TabsTrigger>
          <TabsTrigger value="import">Import/Export</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Category Management</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search categories..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select
                    value={sortOptions.field}
                    onValueChange={(value) => setSortOptions(prev => ({ ...prev, field: value as any }))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category_name">Name</SelectItem>
                      <SelectItem value="total_items">Total Items</SelectItem>
                      <SelectItem value="avg_item_value">Avg Value</SelectItem>
                      <SelectItem value="created_at">Created Date</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => setSortOptions(prev => ({ 
                      ...prev, 
                      direction: prev.direction === 'asc' ? 'desc' : 'asc' 
                    }))}
                  >
                    {sortOptions.direction === 'asc' ? '↑' : '↓'}
                  </Button>
                </div>

                {showFilters && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Label>Category Type</Label>
                        <Select
                          value={categoryTypeFilter}
                          onValueChange={handleCategoryTypeFilter}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All types" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={FILTER_ALL_VALUE}>All Types</SelectItem>
                            <SelectItem value="STANDARD">Standard</SelectItem>
                            <SelectItem value="SYSTEM">System</SelectItem>
                            <SelectItem value="TEMPORARY">Temporary</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select
                          value={statusFilter}
                          onValueChange={handleStatusFilter}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={FILTER_ALL_VALUE}>All Statuses</SelectItem>
                            <SelectItem value={FILTER_ACTIVE_VALUE}>Active</SelectItem>
                            <SelectItem value={FILTER_INACTIVE_VALUE}>Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Min Items</Label>
                        <Input
                          type="number"
                          placeholder="Min items"
                          value={filters.min_items || ''}
                          onChange={(e) => setFilters(prev => ({ 
                            ...prev, 
                            min_items: e.target.value ? parseInt(e.target.value) : undefined 
                          }))}
                        />
                      </div>
                      <div>
                        <Label>Max Items</Label>
                        <Input
                          type="number"
                          placeholder="Max items"
                          value={filters.max_items || ''}
                          onChange={(e) => setFilters(prev => ({ 
                            ...prev, 
                            max_items: e.target.value ? parseInt(e.target.value) : undefined 
                          }))}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Categories Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Categories ({filteredCategories.length})
                  {selectedCategories.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedCategories.length} selected
                    </Badge>
                  )}
                </CardTitle>
                {selectedCategories.length > 0 && (
                  <Button variant="outline" onClick={handleClearSelection}>
                    Clear Selection
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {categoriesLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-sm text-muted-foreground">Loading categories...</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedCategories.length === filteredCategories.length && filteredCategories.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">Avg Value</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCategories.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8">
                            <div className="text-center">
                              <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground">No categories found</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCategories.map(renderCategoryRow)
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <CategoryAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="bulk">
          <BulkOperationsPanel
            selectedCategories={selectedCategories}
            categories={filteredCategories}
            onClearSelection={handleClearSelection}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="import">
          <CategoryImportExport
            categories={categories}
            onRefresh={handleRefresh}
          />
        </TabsContent>
      </Tabs>

      {/* Category Form Modal */}
      {(showCreateForm || editingCategory) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="max-w-2xl w-full mx-4">
            <EnhancedCategoryForm
              category={editingCategory || undefined}
              parentCategories={categories}
              onClose={handleFormClose}
              onSuccess={handleFormSuccess}
            />
          </div>
        </div>
      )}
    </div>
  );
}
