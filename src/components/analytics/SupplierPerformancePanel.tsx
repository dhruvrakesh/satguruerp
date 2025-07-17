import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Award, Clock, Target, TrendingUp, Filter, Star } from "lucide-react";
import { useSupplierAnalytics, SupplierFilters } from "@/hooks/useSupplierAnalytics";
import { formatCurrency } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface SupplierPerformancePanelProps {
  filters?: SupplierFilters;
  onFiltersChange?: (filters: SupplierFilters) => void;
  onContactSupplier?: (supplier: string) => void;
}

const performanceColors = {
  EXCELLENT: '#10b981',
  GOOD: '#3b82f6',
  AVERAGE: '#f59e0b',
  POOR: '#ef4444'
};

export function SupplierPerformancePanel({ 
  filters = {}, 
  onFiltersChange,
  onContactSupplier 
}: SupplierPerformancePanelProps) {
  const [localFilters, setLocalFilters] = useState<SupplierFilters>(filters);
  const { supplierAnalytics, supplierSummary } = useSupplierAnalytics(localFilters);

  const handleFilterChange = (key: keyof SupplierFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  if (supplierAnalytics.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Supplier Performance Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading supplier performance data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (supplierAnalytics.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Supplier Performance Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            Error loading supplier performance data
          </div>
        </CardContent>
      </Card>
    );
  }

  const suppliers = supplierAnalytics.data || [];
  const summary = supplierSummary.data;

  // Prepare chart data
  const performanceDistribution = [
    { name: 'Excellent', value: suppliers.filter(s => s.performanceRating === 'EXCELLENT').length, color: performanceColors.EXCELLENT },
    { name: 'Good', value: suppliers.filter(s => s.performanceRating === 'GOOD').length, color: performanceColors.GOOD },
    { name: 'Average', value: suppliers.filter(s => s.performanceRating === 'AVERAGE').length, color: performanceColors.AVERAGE },
    { name: 'Poor', value: suppliers.filter(s => s.performanceRating === 'POOR').length, color: performanceColors.POOR }
  ];

  const topSuppliers = suppliers.slice(0, 10).map(supplier => ({
    name: supplier.supplier.length > 15 ? supplier.supplier.substring(0, 15) + '...' : supplier.supplier,
    fullName: supplier.supplier,
    reliability: supplier.reliabilityScore,
    value: supplier.totalValue,
    orders: supplier.totalOrders
  }));

  const deliveryPerformance = suppliers.slice(0, 15).map(supplier => ({
    supplier: supplier.supplier.length > 10 ? supplier.supplier.substring(0, 10) + '...' : supplier.supplier,
    onTimeRate: supplier.onTimeDeliveryRate,
    avgDeliveryTime: supplier.avgDeliveryTime,
    qualityScore: supplier.qualityScore
  }));

  return (
    <div className="space-y-6" id="supplier-performance-panel">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Supplier Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Performance Rating</label>
              <Select
                value={localFilters.performanceRating || ""}
                onValueChange={(value) => handleFilterChange('performanceRating', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All ratings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All ratings</SelectItem>
                  <SelectItem value="EXCELLENT">Excellent</SelectItem>
                  <SelectItem value="GOOD">Good</SelectItem>
                  <SelectItem value="AVERAGE">Average</SelectItem>
                  <SelectItem value="POOR">Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Minimum Orders</label>
              <Select
                value={localFilters.minOrders?.toString() || ""}
                onValueChange={(value) => handleFilterChange('minOrders', value ? parseInt(value) : undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any number" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any number</SelectItem>
                  <SelectItem value="5">≥ 5 orders</SelectItem>
                  <SelectItem value="10">≥ 10 orders</SelectItem>
                  <SelectItem value="20">≥ 20 orders</SelectItem>
                  <SelectItem value="50">≥ 50 orders</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date From</label>
              <input
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={localFilters.dateFrom || ""}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value || undefined)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date To</label>
              <input
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={localFilters.dateTo || ""}
                onChange={(e) => handleFilterChange('dateTo', e.target.value || undefined)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Truck className="w-4 h-4 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Total Suppliers</p>
                <p className="text-2xl font-bold">{summary?.totalSuppliers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Star className="w-4 h-4 text-yellow-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Excellent Performers</p>
                <p className="text-2xl font-bold text-green-600">{summary?.excellentSuppliers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Avg Delivery Time</p>
                <p className="text-2xl font-bold">{summary?.avgDeliveryTime || 0} days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-green-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">On-Time Delivery</p>
                <p className="text-2xl font-bold">{summary?.onTimeDeliveryRate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Performance Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Distribution</CardTitle>
            <CardDescription>Supplier performance rating breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={performanceDistribution.filter(d => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {performanceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Suppliers by Reliability */}
        <Card>
          <CardHeader>
            <CardTitle>Top Suppliers by Reliability</CardTitle>
            <CardDescription>Reliability scores and order volume</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topSuppliers}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name, props) => [
                    name === 'reliability' ? `${value}%` : value,
                    name === 'reliability' ? 'Reliability Score' : name === 'orders' ? 'Total Orders' : 'Total Value'
                  ]}
                  labelFormatter={(label) => topSuppliers.find(s => s.name === label)?.fullName || label}
                />
                <Bar dataKey="reliability" fill="hsl(var(--primary))" name="reliability" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Supplier List */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Performance Details</CardTitle>
          <CardDescription>
            Comprehensive supplier metrics and performance indicators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {suppliers.slice(0, 50).map((supplier) => (
                <div
                  key={supplier.supplier}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{supplier.supplier}</p>
                      <Badge 
                        variant={
                          supplier.performanceRating === 'EXCELLENT' ? 'default' :
                          supplier.performanceRating === 'GOOD' ? 'secondary' :
                          supplier.performanceRating === 'AVERAGE' ? 'outline' : 'destructive'
                        }
                        style={{
                          backgroundColor: supplier.performanceRating === 'EXCELLENT' ? performanceColors.EXCELLENT :
                                          supplier.performanceRating === 'GOOD' ? performanceColors.GOOD :
                                          supplier.performanceRating === 'AVERAGE' ? performanceColors.AVERAGE :
                                          performanceColors.POOR,
                          color: 'white'
                        }}
                      >
                        {supplier.performanceRating}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {supplier.reliabilityScore}% reliability
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Orders: {supplier.totalOrders}</span>
                      <span>Total Value: {formatCurrency(supplier.totalValue)}</span>
                      <span>Avg Delivery: {supplier.avgDeliveryTime} days</span>
                      <span>On-Time: {supplier.onTimeDeliveryRate}%</span>
                      <span>Quality: {supplier.qualityScore}%</span>
                      <span>Items: {supplier.itemsSupplied}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last Order: {supplier.lastOrderDate ? format(parseISO(supplier.lastOrderDate), 'MMM dd, yyyy') : 'No recent orders'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right space-y-1 mr-2">
                      <p className="text-sm font-medium">Avg Order: {formatCurrency(supplier.avgOrderValue)}</p>
                      <div className="flex items-center gap-1 text-xs">
                        <TrendingUp className="w-3 h-3" />
                        <span>Performance Trend</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={supplier.performanceRating === 'EXCELLENT' ? 'default' : 'outline'}
                      onClick={() => onContactSupplier?.(supplier.supplier)}
                      className="gap-1"
                    >
                      <Award className="w-3 h-3" />
                      Contact
                    </Button>
                  </div>
                </div>
              ))}
              {suppliers.length > 50 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  ... and {suppliers.length - 50} more suppliers
                </div>
              )}
              {suppliers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No suppliers found with current filters
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}