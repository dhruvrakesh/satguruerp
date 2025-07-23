import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Search, Plus, Filter, Download, Upload, MoreHorizontal, Edit, 
  Trash2, TrendingUp, Package, Factory, Eye, Archive, 
  RefreshCw, BarChart3, Settings, DollarSign
} from "lucide-react";
import { useEnhancedCategories, useCategoryAnalytics, CategoryFilters, CategorySortOptions } from "@/hooks/useEnhancedCategories";
import { useStockValuation } from "@/hooks/useStockValuation";
import { EnhancedCategoryForm } from "./EnhancedCategoryForm";
import { CategoryAnalyticsDashboard } from "./CategoryAnalyticsDashboard";
import { BulkOperationsPanel } from "./BulkOperationsPanel";
import { CategoryImportExport } from "./CategoryImportExport";

export function EnterpriseCategories() {
  const [filters, setFilters] = useState<CategoryFilters>({});
  const [sort, setSort] = useState<CategorySortOptions>({ field: 'category_name', direction: 'asc' });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [currentTab, setCurrentTab] = useState('categories');

  const { data: categories = [], isLoading, refetch } = useEnhancedCategories(filters, sort);
  const { data: analytics } = useCategoryAnalytics();
  const { stockValuation } = useStockValuation();

  const filteredCategories = useMemo(() => {
    return categories.filter(cat => filters.is_active === undefined || cat.is_active === filters.is_active);
  }, [categories, filters.is_active]);

  const editingCategoryData = useMemo(() => {
    return editingCategory ? categories.find(cat => cat.id === editingCategory) : undefined;
  }, [editingCategory, categories]);

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value || undefined }));
  };

  const handleFilterChange = (key: keyof CategoryFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value === 'all' ? undefined : value }));
  };

  const handleSort = (field: CategorySortOptions['field']) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const selectAllCategories = (checked: boolean) => {
    setSelectedCategories(checked ? filteredCategories.map(cat => cat.id) : []);
  };

  const getUsageTypeColor = (type: 'fg' | 'rm' | 'packaging' | 'consumable') => {
    switch (type) {
      case 'fg': return 'bg-primary text-primary-foreground';
      case 'rm': return 'bg-secondary text-secondary-foreground';
      case 'packaging': return 'bg-accent text-accent-foreground';
      case 'consumable': return 'bg-muted text-muted-foreground';
    }
  };

  const handleFormSuccess = () => {
    refetch();
    setShowCreateForm(false);
    setEditingCategory(null);
  };

  const handleCloseForm = () => {
    setShowCreateForm(false);
    setEditingCategory(null);
  };

  const calculateCategoryValue = (category: any) => {
    // Enhanced value calculation using valuation data
    const valuationData = stockValuation.data?.find(item => item.category_name === category.category_name);
    return valuationData?.total_value || (category.avg_item_value * category.total_items);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Enterprise Categories</h1>
          <p className="text-muted-foreground">Advanced category management with analytics and automation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Category
          </Button>
        </div>
      </div>

      {/* Enhanced Analytics Summary Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                  <Factory className="w-5 h-5 text-secondary" />
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
                  <p className="text-sm text-muted-foreground">FG/RM Ratio</p>
                  <p className="text-2xl font-bold">{analytics.fgRmRatio.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted/30">
                  <BarChart3 className="w-5 h-5 text-muted-foreground" />
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
                  <p className="text-2xl font-bold">₹{analytics.totalValue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="bulk-ops">Bulk Operations</TabsTrigger>
          <TabsTrigger value="import-export">Import/Export</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search categories..."
                      className="pl-10"
                      onChange={(e) => handleSearch(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Select value={filters.category_type || 'all'} onValueChange={(value) => handleFilterChange('category_type', value)}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="STANDARD">Standard</SelectItem>
                      <SelectItem value="SYSTEM">System</SelectItem>
                      <SelectItem value="TEMPORARY">Temporary</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.is_active?.toString() || 'all'} onValueChange={(value) => handleFilterChange('is_active', value === 'all' ? undefined : value === 'true')}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Filter className="w-4 h-4 mr-2" />
                        More Filters
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <div className="p-2 space-y-2">
                        <div>
                          <label className="text-xs font-medium">Min Items</label>
                          <Input
                            type="number"
                            placeholder="0"
                            onChange={(e) => handleFilterChange('min_items', e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Max Items</label>
                          <Input
                            type="number"
                            placeholder="100"
                            onChange={(e) => handleFilterChange('max_items', e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="flex border rounded-md">
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('table')}
                      className="rounded-r-none"
                    >
                      Table
                    </Button>
                    <Button
                      variant={viewMode === 'cards' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('cards')}
                      className="rounded-l-none"
                    >
                      Cards
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Bulk Actions */}
              {selectedCategories.length > 0 && (
                <div className="flex items-center gap-2 mt-4 p-3 bg-primary/10 rounded-lg">
                  <span className="text-sm font-medium">
                    {selectedCategories.length} categories selected
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline">
                      <Archive className="w-4 h-4 mr-1" />
                      Archive
                    </Button>
                    <Button size="sm" variant="outline">
                      <Edit className="w-4 h-4 mr-1" />
                      Bulk Edit
                    </Button>
                    <Button size="sm" variant="outline">
                      <Download className="w-4 h-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Categories Display */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">Loading categories...</p>
                </div>
              ) : viewMode === 'table' ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedCategories.length === filteredCategories.length && filteredCategories.length > 0}
                          onCheckedChange={(checked) => selectAllCategories(checked as boolean)}
                        />
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('category_name')}
                      >
                        Category Name
                        {sort.field === 'category_name' && (
                          <span className="ml-1">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('total_items')}
                      >
                        Items
                        {sort.field === 'total_items' && (
                          <span className="ml-1">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </TableHead>
                      <TableHead>Usage Distribution</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('avg_item_value')}
                      >
                        Value
                        {sort.field === 'avg_item_value' && (
                          <span className="ml-1">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </TableHead>
                      <TableHead className="w-16">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCategories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCategories.includes(category.id)}
                            onCheckedChange={() => toggleCategorySelection(category.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{category.category_name}</div>
                            {category.category_code && (
                              <div className="text-xs text-muted-foreground">{category.category_code}</div>
                            )}
                            {category.description && (
                              <div className="text-xs text-muted-foreground mt-1">{category.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{category.category_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={category.is_active ? "default" : "secondary"}>
                            {category.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <div className="font-medium">{category.total_items}</div>
                            <div className="text-xs text-muted-foreground">{category.active_items} active</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {category.fg_items > 0 && (
                              <Badge className={`${getUsageTypeColor('fg')} text-xs`}>
                                FG: {category.fg_items}
                              </Badge>
                            )}
                            {category.rm_items > 0 && (
                              <Badge className={`${getUsageTypeColor('rm')} text-xs`}>
                                RM: {category.rm_items}
                              </Badge>
                            )}
                            {category.packaging_items > 0 && (
                              <Badge className={`${getUsageTypeColor('packaging')} text-xs`}>
                                PK: {category.packaging_items}
                              </Badge>
                            )}
                            {category.consumable_items > 0 && (
                              <Badge className={`${getUsageTypeColor('consumable')} text-xs`}>
                                CN: {category.consumable_items}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-right">
                            <div className="font-medium">₹{calculateCategoryValue(category).toFixed(0)}</div>
                            <div className="text-xs text-muted-foreground">₹{category.avg_item_value.toFixed(2)} avg</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingCategory(category.id)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Eye className="w-4 h-4 mr-2" />
                                View Items
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Archive
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredCategories.map((category) => (
                    <Card key={category.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{category.category_name}</CardTitle>
                            {category.category_code && (
                              <p className="text-sm text-muted-foreground">{category.category_code}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedCategories.includes(category.id)}
                              onCheckedChange={() => toggleCategorySelection(category.id)}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => setEditingCategory(category.id)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {category.description && (
                          <p className="text-sm text-muted-foreground mb-3">{category.description}</p>
                        )}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Total Items:</span>
                            <Badge variant="secondary">{category.total_items}</Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Total Value:</span>
                            <Badge variant="secondary">₹{calculateCategoryValue(category).toFixed(0)}</Badge>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {category.fg_items > 0 && (
                              <Badge className={`${getUsageTypeColor('fg')} text-xs`}>FG: {category.fg_items}</Badge>
                            )}
                            {category.rm_items > 0 && (
                              <Badge className={`${getUsageTypeColor('rm')} text-xs`}>RM: {category.rm_items}</Badge>
                            )}
                            {category.packaging_items > 0 && (
                              <Badge className={`${getUsageTypeColor('packaging')} text-xs`}>PK: {category.packaging_items}</Badge>
                            )}
                            {category.consumable_items > 0 && (
                              <Badge className={`${getUsageTypeColor('consumable')} text-xs`}>CN: {category.consumable_items}</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <CategoryAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="bulk-ops">
          <BulkOperationsPanel 
            selectedCategories={selectedCategories}
            categories={filteredCategories}
            onClearSelection={() => setSelectedCategories([])}
            onRefresh={refetch}
          />
        </TabsContent>

        <TabsContent value="import-export">
          <CategoryImportExport />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Category Form Dialog */}
      <Dialog open={showCreateForm || !!editingCategory} onOpenChange={handleCloseForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Create New Category'}
            </DialogTitle>
          </DialogHeader>
          <EnhancedCategoryForm
            category={editingCategoryData}
            parentCategories={categories.filter(cat => cat.category_level === 1)}
            onClose={handleCloseForm}
            onSuccess={handleFormSuccess}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
