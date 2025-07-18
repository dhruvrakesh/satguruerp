
import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, Loader2 } from "lucide-react";
import { useCategoriesWithStats } from "@/hooks/useCategories";
import { useDebounce } from "@/hooks/useDebounce";
import { ItemMasterFilters as FilterType } from "@/hooks/useItemMaster";

interface ItemMasterFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
  isLoading?: boolean;
}

export function ItemMasterFilters({ filters, onFiltersChange, isLoading }: ItemMasterFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search || "");
  const debouncedSearch = useDebounce(searchInput, 300);
  const { data: categoriesWithStats, isLoading: categoriesLoading, error: categoriesError } = useCategoriesWithStats();

  // Update filters when debounced search changes
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch, filters, onFiltersChange]);

  const handleFilterChange = (key: keyof FilterType, value: string) => {
    const newValue = value === "__ALL__" ? undefined : value;
    onFiltersChange({ ...filters, [key]: newValue });
  };

  const clearFilters = () => {
    setSearchInput("");
    onFiltersChange({});
  };

  const clearSpecificFilter = (key: keyof FilterType) => {
    if (key === 'search') {
      setSearchInput("");
    }
    onFiltersChange({ ...filters, [key]: undefined });
  };

  const activeFiltersCount = Object.values(filters).filter(value => value && value !== "").length;

  // Get selected category for display
  const selectedCategory = categoriesWithStats?.find(c => c.id === filters.category_id);

  // Filter categories based on current filters (exclude category filter itself)
  const getFilteredCategories = () => {
    if (!categoriesWithStats) return [];
    
    // Show all categories with their total counts
    return categoriesWithStats.filter(category => category.total_items > 0);
  };

  const filteredCategories = getFilteredCategories();

  if (categoriesError) {
    console.error('Categories loading error:', categoriesError);
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4 items-center flex-wrap">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search items by code or name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
              disabled={isLoading}
            />
            {isLoading && searchInput && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="animate-spin h-4 w-4 text-primary" />
              </div>
            )}
          </div>

          {/* Category Filter */}
          <Select 
            value={filters.category_id || "__ALL__"} 
            onValueChange={(value) => handleFilterChange('category_id', value)}
            disabled={categoriesLoading}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder={categoriesLoading ? "Loading categories..." : "All Categories"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">All Categories</SelectItem>
              {filteredCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.category_name} ({category.total_items} items)
                </SelectItem>
              ))}
              {categoriesLoading && (
                <SelectItem value="__LOADING__" disabled>
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading categories...
                  </div>
                </SelectItem>
              )}
              {!categoriesLoading && filteredCategories.length === 0 && (
                <SelectItem value="__EMPTY__" disabled>
                  No categories with items found
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          
          {/* Status Filter */}
          <Select 
            value={filters.status || "__ALL__"} 
            onValueChange={(value) => handleFilterChange('status', value)}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {/* UOM Filter */}
          <Select 
            value={filters.uom || "__ALL__"} 
            onValueChange={(value) => handleFilterChange('uom', value)}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="UOM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">All UOM</SelectItem>
              <SelectItem value="PCS">PCS</SelectItem>
              <SelectItem value="KG">KG</SelectItem>
              <SelectItem value="MTR">MTR</SelectItem>
              <SelectItem value="SQM">SQM</SelectItem>
              <SelectItem value="LTR">LTR</SelectItem>
              <SelectItem value="BOX">BOX</SelectItem>
              <SelectItem value="ROLL">ROLL</SelectItem>
            </SelectContent>
          </Select>

          {/* Usage Type Filter */}
          <Select 
            value={filters.usage_type || "__ALL__"} 
            onValueChange={(value) => handleFilterChange('usage_type', value)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Item Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">All Items</SelectItem>
              <SelectItem value="FINISHED_GOOD">🎨 Finished Goods (FG)</SelectItem>
              <SelectItem value="RAW_MATERIAL">📦 Raw Materials (RM)</SelectItem>
              <SelectItem value="CONSUMABLE">⚙️ Consumables</SelectItem>
              <SelectItem value="PACKAGING">📦 Packaging</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <Button variant="outline" onClick={clearFilters} size="sm">
              <X className="w-4 h-4 mr-2" />
              Clear ({activeFiltersCount})
            </Button>
          )}
        </div>

        {/* Active Filters Display */}
        {activeFiltersCount > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {filters.search && (
              <Badge variant="secondary" className="gap-1">
                Search: "{filters.search}"
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-destructive" 
                  onClick={() => clearSpecificFilter('search')}
                />
              </Badge>
            )}
            {filters.category_id && selectedCategory && (
              <Badge variant="secondary" className="gap-1">
                Category: {selectedCategory.category_name}
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-destructive" 
                  onClick={() => clearSpecificFilter('category_id')}
                />
              </Badge>
            )}
            {filters.status && (
              <Badge variant="secondary" className="gap-1">
                Status: {filters.status}
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-destructive" 
                  onClick={() => clearSpecificFilter('status')}
                />
              </Badge>
            )}
            {filters.uom && (
              <Badge variant="secondary" className="gap-1">
                UOM: {filters.uom}
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-destructive" 
                  onClick={() => clearSpecificFilter('uom')}
                />
              </Badge>
            )}
            {filters.usage_type && (
              <Badge variant="secondary" className="gap-1">
                Type: {filters.usage_type.replace('_', ' ')}
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-destructive" 
                  onClick={() => clearSpecificFilter('usage_type')}
                />
              </Badge>
            )}
          </div>
        )}

        {/* Categories Error Message */}
        {categoriesError && (
          <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">
              Unable to load categories. Please refresh the page.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
