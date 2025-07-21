
import { useState, useCallback } from "react";
import { format } from "date-fns";
import { ChevronUp, ChevronDown, Download, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useOptimizedOpeningStock, OpeningStockSort, OpeningStockFilters } from "@/hooks/useOptimizedOpeningStock";
import { OptimizedSearchInput } from "@/components/ui/optimized-search-input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useMutation } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "@/hooks/use-toast";

export function OptimizedOpeningStockTable() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<OpeningStockSort>({ column: 'created_at', direction: 'desc' });
  const [searchValue, setSearchValue] = useState("");
  const [dateFilters, setDateFilters] = useState<{ dateFrom?: string; dateTo?: string }>({});

  // Combine all filters
  const filters: OpeningStockFilters = {
    search: searchValue,
    ...dateFilters
  };

  const { data, isLoading, error, isFetching } = useOptimizedOpeningStock({ 
    page, 
    pageSize: 50, 
    filters, 
    sort 
  });

  const exportData = useMutation({
    mutationFn: async ({ data, filename }: { data: any[]; filename: string }) => {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Opening Stock");
      XLSX.writeFile(wb, filename);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Data exported successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to export data", variant: "destructive" });
    }
  });

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    setPage(1); // Reset to first page when searching
  }, []);

  const handleDateFilterChange = useCallback((field: string, value: string) => {
    setDateFilters(prev => ({ ...prev, [field]: value }));
    setPage(1);
  }, []);

  // Handle errors gracefully
  if (error) {
    console.error('Opening Stock Table Error:', error);
    return (
      <div className="p-4 text-center">
        <p className="text-destructive">Error loading opening stock data: {error.message}</p>
        <Button 
          variant="outline" 
          onClick={() => window.location.reload()}
          className="mt-2"
        >
          Retry
        </Button>
      </div>
    );
  }

  const handleSort = useCallback((column: string) => {
    setSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleExport = useCallback(() => {
    if (data?.data) {
      const exportDataItems = data.data.map(record => ({
        'Item Code': record.item_code,
        'Item Name': record.satguru_item_master?.item_name || '-',
        'Opening Quantity': record.qty_received,
        'UOM': record.satguru_item_master?.uom || '-',
        'Date': format(new Date(record.date), 'dd/MM/yyyy'),
        'Remarks': record.remarks || '-'
      }));
      
      exportData.mutate({
        data: exportDataItems,
        filename: `opening-stock-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
      });
    }
  }, [data?.data, exportData]);

  const SortableHeader = ({ column, children }: { column: string; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sort.column === column && (
          sort.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Header with Export */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="w-4 h-4" />
          {data?.count || 0} opening stock records
          {isFetching && <LoadingSpinner size="sm" className="w-3 h-3" />}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exportData.isPending || !data?.data?.length}
        >
          <Download className="w-4 h-4 mr-2" />
          {exportData.isPending ? "Exporting..." : "Export to Excel"}
        </Button>
      </div>

      {/* Optimized Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <OptimizedSearchInput
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Search item code or remarks..."
            isSearching={isFetching}
          />
        </div>
        <Input
          type="date"
          placeholder="From date"
          value={dateFilters.dateFrom || ""}
          onChange={(e) => handleDateFilterChange('dateFrom', e.target.value)}
          className="w-auto"
        />
        <Input
          type="date"
          placeholder="To date"
          value={dateFilters.dateTo || ""}
          onChange={(e) => handleDateFilterChange('dateTo', e.target.value)}
          className="w-auto"
        />
      </div>

      {/* Table with Loading State */}
      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="item_code">Item Code</SortableHeader>
                <TableHead>Item Name</TableHead>
                <SortableHeader column="qty_received">Opening Quantity</SortableHeader>
                <TableHead>UOM</TableHead>
                <SortableHeader column="date">Date</SortableHeader>
                <TableHead>Type</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.item_code}</TableCell>
                  <TableCell>{record.satguru_item_master?.item_name || "-"}</TableCell>
                  <TableCell className="text-right font-medium">{record.qty_received}</TableCell>
                  <TableCell>{record.satguru_item_master?.uom || "-"}</TableCell>
                  <TableCell>{format(new Date(record.date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                      Opening Stock
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={record.remarks || ""}>
                    {record.remarks || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching}
          >
            Previous
          </Button>
          <span className="px-3 py-2 text-sm">
            Page {page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages || isFetching}
          >
            Next
          </Button>
        </div>
      )}

      {data?.data.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No opening stock records found</p>
        </div>
      )}
    </div>
  );
}
