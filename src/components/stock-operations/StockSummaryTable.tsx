
import { useState } from "react";
import { useStockSummary, useStockCategories, StockSummaryFilters, StockSummarySort } from "@/hooks/useStockSummary";
import { OptimizedSearchInput } from "@/components/ui/optimized-search-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Download, RefreshCw, Filter, SortAsc, SortDesc } from "lucide-react";
import { format } from "date-fns";

export function StockSummaryTable() {
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<StockSummaryFilters>({});
  const [sort, setSort] = useState<StockSummarySort>({ column: 'item_code', direction: 'asc' });
  const [showFilters, setShowFilters] = useState(false);
  
  const pageSize = 50;
  
  const { data: stockData, isLoading, error, refetch, isRefetching } = useStockSummary({
    page: currentPage,
    pageSize,
    filters,
    sort
  });
  
  const { data: categories } = useStockCategories();

  const handleSearch = (search: string) => {
    setFilters(prev => ({ ...prev, search }));
    setCurrentPage(1);
  };

  const handleFilterChange = (key: keyof StockSummaryFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleSort = (column: string) => {
    setSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  const getStockStatusBadge = (status: string, qty: number) => {
    const statusConfig = {
      'low_stock': { variant: 'destructive' as const, label: 'Low Stock' },
      'out_of_stock': { variant: 'destructive' as const, label: 'Out of Stock' },
      'normal': { variant: 'default' as const, label: 'Normal' },
      'overstock': { variant: 'secondary' as const, label: 'Overstock' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || 
                  { variant: 'outline' as const, label: status };
    
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sort.column !== column) return null;
    return sort.direction === 'asc' ? 
      <SortAsc className="ml-1 h-4 w-4" /> : 
      <SortDesc className="ml-1 h-4 w-4" />;
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            Error loading stock summary: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <OptimizedSearchInput
            value={filters.search || ''}
            onChange={handleSearch}
            placeholder="Search by item code or name..."
            className="max-w-md"
            isSearching={isLoading}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          {Object.keys(filters).length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filter Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select
                  value={filters.category || 'all'}
                  onValueChange={(value) => handleFilterChange('category', value === 'all' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories?.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Stock Status</label>
                <Select
                  value={filters.stockStatus || 'all'}
                  onValueChange={(value) => handleFilterChange('stockStatus', value === 'all' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="low_stock">Low Stock</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="overstock">Overstock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Min Quantity</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.minQty || ''}
                  onChange={(e) => handleFilterChange('minQty', e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Max Quantity</label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={filters.maxQty || ''}
                  onChange={(e) => handleFilterChange('maxQty', e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {stockData?.data.length || 0} of {stockData?.count || 0} items
          {filters.search && ` matching "${filters.search}"`}
        </span>
        <span>Page {currentPage} of {stockData?.totalPages || 1}</span>
      </div>

      {/* Stock Summary Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('item_code')}
              >
                <div className="flex items-center">
                  Item Code
                  <SortIcon column="item_code" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('item_name')}
              >
                <div className="flex items-center">
                  Item Name
                  <SortIcon column="item_name" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('category_name')}
              >
                <div className="flex items-center">
                  Category
                  <SortIcon column="category_name" />
                </div>
              </TableHead>
              <TableHead className="text-right">Received (30d)</TableHead>
              <TableHead className="text-right">Consumed (30d)</TableHead>
              <TableHead 
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('current_qty')}
              >
                <div className="flex items-center justify-end">
                  Current Stock
                  <SortIcon column="current_qty" />
                </div>
              </TableHead>
              <TableHead className="text-right">Reorder Level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Loading stock data...
                </TableCell>
              </TableRow>
            ) : stockData?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No stock data found
                  {filters.search && ` for "${filters.search}"`}
                </TableCell>
              </TableRow>
            ) : (
              stockData?.data.map((item) => (
                <TableRow key={item.item_code} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{item.item_code}</TableCell>
                  <TableCell>{item.item_name}</TableCell>
                  <TableCell>{item.category_name}</TableCell>
                  <TableCell className="text-right">{item.received_30_days?.toLocaleString() || 0}</TableCell>
                  <TableCell className="text-right">{item.consumption_30_days?.toLocaleString() || 0}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {item.current_qty?.toLocaleString() || 0}
                  </TableCell>
                  <TableCell className="text-right">{item.reorder_level?.toLocaleString() || 0}</TableCell>
                  <TableCell>
                    {getStockStatusBadge(item.stock_status, item.current_qty)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.last_updated ? format(new Date(item.last_updated), 'MMM dd, yyyy') : 'N/A'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {stockData && stockData.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, stockData.totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(prev => Math.min(stockData.totalPages, prev + 1))}
                  className={currentPage === stockData.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
