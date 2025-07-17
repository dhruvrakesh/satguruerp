import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IndianRupee, TrendingUp, Package, Clock } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, Legend } from "recharts";
import { useStockValuation, StockValuationFilters } from "@/hooks/useStockValuation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";

const COLORS = {
  high: 'hsl(var(--destructive))',
  medium: 'hsl(var(--primary))', 
  low: 'hsl(var(--muted-foreground))'
};

interface StockValuationChartProps {
  filters: StockValuationFilters;
  onFiltersChange: (filters: StockValuationFilters) => void;
}

export function StockValuationChart({ filters, onFiltersChange }: StockValuationChartProps) {
  const { stockValuation, valuationSummary } = useStockValuation(filters);

  if (stockValuation.isLoading || valuationSummary.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (stockValuation.error || valuationSummary.error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-destructive">Error loading valuation data</p>
        </CardContent>
      </Card>
    );
  }

  const valuationData = stockValuation.data || [];
  const summary = valuationSummary.data;

  // Prepare chart data
  const pieData = [
    { name: 'High Value', value: summary?.highValueItems || 0, color: COLORS.high },
    { name: 'Medium Value', value: summary?.mediumValueItems || 0, color: COLORS.medium },
    { name: 'Low Value', value: summary?.lowValueItems || 0, color: COLORS.low }
  ];

  // Top 10 items by value for bar chart
  const topItems = valuationData.slice(0, 10).map(item => ({
    name: item.item_name.length > 15 ? item.item_name.substring(0, 15) + '...' : item.item_name,
    value: item.total_value,
    qty: item.current_qty
  }));

  const getStockAgeColor = (days: number) => {
    if (days > 180) return "destructive";
    if (days > 90) return "outline";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalValue)}</div>
              <p className="text-xs text-muted-foreground">
                Across {summary.totalItems} items
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.averageValue)}</div>
              <p className="text-xs text-muted-foreground">
                Per item average
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Value Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.highValueItems}</div>
              <p className="text-xs text-muted-foreground">
                80% of total value
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valuation Method</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <Select
                  value={filters.valuationMethod || 'WEIGHTED_AVG'}
                  onValueChange={(value) => onFiltersChange({ ...filters, valuationMethod: value as any })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEIGHTED_AVG">Weighted Avg</SelectItem>
                    <SelectItem value="FIFO">FIFO</SelectItem>
                    <SelectItem value="LIFO">LIFO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Value Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Value Distribution</CardTitle>
            <CardDescription>Items classified by value contribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Items Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top Items by Value</CardTitle>
            <CardDescription>Highest value inventory items</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topItems}>
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(value) => [formatCurrency(value as number), "Value"]} />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Stock Valuation</CardTitle>
          <CardDescription>
            Complete valuation breakdown with aging analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead>Age (Days)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {valuationData.slice(0, 20).map((item) => (
                  <TableRow key={item.item_code}>
                    <TableCell className="font-medium">{item.item_code}</TableCell>
                    <TableCell>{item.item_name}</TableCell>
                    <TableCell>{item.category_name}</TableCell>
                    <TableCell className="text-right">{item.current_qty}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.unit_price || 0)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.total_value)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStockAgeColor(item.stock_age_days)}>
                        {item.stock_age_days} days
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {valuationData.length > 20 && (
            <p className="text-sm text-muted-foreground mt-4">
              Showing top 20 items. Total: {valuationData.length} items
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}