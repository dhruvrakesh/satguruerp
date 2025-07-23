import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Download, Filter, RefreshCw } from "lucide-react";
import { useValuationManagement, type ValuationFilters } from "@/hooks/useValuationManagement";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function RealStockValuationChart() {
  const [filters, setFilters] = useState<ValuationFilters>({
    valuation_method: 'WEIGHTED_AVG'
  });
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();

  const { 
    getStockValuation, 
    getValuationAnalytics, 
    exportPricingData 
  } = useValuationManagement();

  const { 
    data: stockData, 
    isLoading: stockLoading, 
    refetch: refetchStock 
  } = getStockValuation(filters);

  const { 
    data: analytics, 
    isLoading: analyticsLoading 
  } = getValuationAnalytics(filters);

  const exportMutation = exportPricingData;

  const handleFilterChange = (key: keyof ValuationFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleDateChange = () => {
    setFilters(prev => ({
      ...prev,
      dateFrom: dateFrom?.toISOString().split('T')[0],
      dateTo: dateTo?.toISOString().split('T')[0]
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-IN').format(value);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Stock Valuation Analytics
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchStock()}
                disabled={stockLoading}
              >
                <RefreshCw className={cn("h-4 w-4", stockLoading && "animate-spin")} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportMutation.mutate(filters)}
                disabled={exportMutation.isPending}
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Valuation Method</label>
              <Select
                value={filters.valuation_method}
                onValueChange={(value) => handleFilterChange('valuation_method', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEIGHTED_AVG">Weighted Average</SelectItem>
                  <SelectItem value="FIFO">FIFO</SelectItem>
                  <SelectItem value="LIFO">LIFO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Item Code</label>
              <Input
                placeholder="Search by item code..."
                value={filters.item_code || ''}
                onChange={(e) => handleFilterChange('item_code', e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm font-medium">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleDateChange} size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {analytics && !analyticsLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">
                {formatCurrency(analytics.summary.total_inventory_value)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total Inventory Value
              </p>
              <Badge variant="secondary" className="mt-2">
                {analytics.calculation_method}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">
                {formatNumber(analytics.summary.total_items)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total Items
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">
                {formatCurrency(analytics.summary.avg_item_value)}
              </div>
              <p className="text-xs text-muted-foreground">
                Average Item Value
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>High Value:</span>
                  <span className="font-medium">{analytics.summary.high_value_items}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Medium Value:</span>
                  <span className="font-medium">{analytics.summary.medium_value_items}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Low Value:</span>
                  <span className="font-medium">{analytics.summary.low_value_items}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                ABC Classification
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Breakdown */}
      {analytics?.category_breakdown && (
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.category_breakdown.slice(0, 10).map((category, index) => (
                <div key={category.category_name} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{category.category_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {category.item_count} items • Avg: {formatCurrency(category.avg_unit_cost)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(category.category_value)}</div>
                    <div className="text-sm text-muted-foreground">
                      #{index + 1} by value
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Items by Value</CardTitle>
        </CardHeader>
        <CardContent>
          {stockLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading stock data...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Item Code</th>
                    <th className="text-left p-2">Item Name</th>
                    <th className="text-left p-2">Category</th>
                    <th className="text-right p-2">Quantity</th>
                    <th className="text-right p-2">Unit Cost</th>
                    <th className="text-right p-2">Total Value</th>
                    <th className="text-center p-2">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {stockData?.slice(0, 50).map((item) => (
                    <tr key={item.item_code} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono text-sm">{item.item_code}</td>
                      <td className="p-2">{item.item_name}</td>
                      <td className="p-2">{item.category_name}</td>
                      <td className="p-2 text-right">{formatNumber(item.current_qty)}</td>
                      <td className="p-2 text-right">{formatCurrency(item.unit_cost)}</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(item.total_value)}</td>
                      <td className="p-2 text-center">
                        <Badge variant="outline">{item.valuation_method}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {stockData && stockData.length > 50 && (
                <div className="text-center p-4 text-sm text-muted-foreground">
                  Showing top 50 items by value. Use export to get complete data.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}