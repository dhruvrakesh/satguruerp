
import { useState, useEffect } from "react";
import { useCategories } from "@/hooks/useCategories";
import { useFilterOptions } from "@/hooks/useFilterOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Filter, X } from "lucide-react";

interface ItemMasterFiltersProps {
  filters: {
    search: string;
    category_id: string;
    status: string;
    uom: string;
    usage_type: string;
  };
  onFiltersChange: (filters: any) => void;
}

export function ItemMasterFilters({ filters, onFiltersChange }: ItemMasterFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  const { data: categories } = useCategories();
  const { usageTypes, uomOptions, statusOptions } = useFilterOptions();

  // Sync with external filters prop changes only when they actually change
  useEffect(() => {
    const filtersChanged = 
      filters.search !== localFilters.search ||
      filters.category_id !== localFilters.category_id ||
      filters.status !== localFilters.status ||
      filters.uom !== localFilters.uom ||
      filters.usage_type !== localFilters.usage_type;
    
    if (filtersChanged) {
      console.log('Syncing filters from parent:', filters);
      setLocalFilters(filters);
    }
  }, [filters.search, filters.category_id, filters.status, filters.uom, filters.usage_type]);

  // Debounced filter application - only call onFiltersChange, don't include it in deps
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      console.log('Applying debounced filters:', localFilters);
      onFiltersChange(localFilters);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [localFilters.search, localFilters.category_id, localFilters.status, localFilters.uom, localFilters.usage_type]);

  const handleFilterChange = (key: string, value: string) => {
    console.log('Filter change:', key, value);
    setLocalFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    const clearedFilters = {
      search: '',
      category_id: 'all',
      status: 'all',
      uom: 'all',
      usage_type: 'all'
    };
    console.log('Clearing filters:', clearedFilters);
    setLocalFilters(clearedFilters);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by item code or name..."
                value={localFilters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={localFilters.category_id}
              onValueChange={(value) => handleFilterChange('category_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.category_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={localFilters.status}
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Unit of Measure</Label>
            <Select
              value={localFilters.uom}
              onValueChange={(value) => handleFilterChange('uom', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select UOM" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All UOM</SelectItem>
                {uomOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Usage Type</Label>
            <Select
              value={localFilters.usage_type}
              onValueChange={(value) => handleFilterChange('usage_type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select usage type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {usageTypes.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button variant="outline" onClick={clearFilters} className="gap-2">
              <X className="w-4 h-4" />
              Clear Filters
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
