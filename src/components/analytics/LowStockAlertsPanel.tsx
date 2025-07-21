import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Package, TrendingDown, Calendar, ShoppingCart, Filter } from "lucide-react";
import { useLowStockAlerts, LowStockFilters } from "@/hooks/useLowStockAlerts";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface LowStockAlertsPanelProps {
  filters?: LowStockFilters;
  onFiltersChange?: (filters: LowStockFilters) => void;
  onReorderClick?: (itemCode: string, suggestedQty: number) => void;
}

const urgencyColors = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316', 
  MEDIUM: '#eab308',
  LOW: '#3b82f6'
};

export function LowStockAlertsPanel({ 
  filters = {}, 
  onFiltersChange,
  onReorderClick 
}: LowStockAlertsPanelProps) {
  const [localFilters, setLocalFilters] = useState<LowStockFilters>(filters);
  const { lowStockAlerts, lowStockSummary } = useLowStockAlerts(localFilters);

  const handleFilterChange = (key: keyof LowStockFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value === 'all' ? undefined : value };
    setLocalFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  if (lowStockAlerts.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Low Stock Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading low stock alerts...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (lowStockAlerts.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Low Stock Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            Error loading low stock data
          </div>
        </CardContent>
      </Card>
    );
  }

  const lowStockItems = lowStockAlerts.data || [];
  const summary = lowStockSummary.data;

  // Prepare chart data
  const urgencyData = [
    { name: 'Critical', value: summary?.criticalItems || 0, color: urgencyColors.CRITICAL },
    { name: 'High', value: summary?.highPriorityItems || 0, color: urgencyColors.HIGH },
    { name: 'Medium', value: lowStockItems.filter(item => item.urgency_level === 'MEDIUM').length, color: urgencyColors.MEDIUM },
    { name: 'Low', value: lowStockItems.filter(item => item.urgency_level === 'LOW').length, color: urgencyColors.LOW }
  ];

  const categoryData = lowStockItems.reduce((acc, item) => {
    const category = item.category_name || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = { name: category, count: 0, criticalCount: 0 };
    }
    acc[category].count += 1;
    if (item.urgency_level === 'CRITICAL') {
      acc[category].criticalCount += 1;
    }
    return acc;
  }, {} as Record<string, { name: string; count: number; criticalCount: number }>);

  const categoryChartData = Object.values(categoryData).slice(0, 10);

  return (
    <div className="space-y-6" id="low-stock-alerts-panel">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Urgency Level</label>
              <Select
                value={localFilters.urgencyLevel || "all"}
                onValueChange={(value) => handleFilterChange('urgencyLevel', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All urgency levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All urgency levels</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Days Stock</label>
              <Select
                value={localFilters.maxDaysStock?.toString() || "all"}
                onValueChange={(value) => handleFilterChange('maxDaysStock', value === 'all' ? undefined : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  <SelectItem value="1">≤ 1 day</SelectItem>
                  <SelectItem value="7">≤ 7 days</SelectItem>
                  <SelectItem value="14">≤ 14 days</SelectItem>
                  <SelectItem value="30">≤ 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Min Shortage Qty</label>
              <Select
                value={localFilters.minShortage?.toString() || "all"}
                onValueChange={(value) => handleFilterChange('minShortage', value === 'all' ? undefined : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any shortage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any shortage</SelectItem>
                  <SelectItem value="10">≥ 10 units</SelectItem>
                  <SelectItem value="50">≥ 50 units</SelectItem>
                  <SelectItem value="100">≥ 100 units</SelectItem>
                  <SelectItem value="500">≥ 500 units</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Low Stock Items</p>
                <p className="text-2xl font-bold">{summary?.totalLowStockItems || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4 text-destructive" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Critical Items</p>
                <p className="text-2xl font-bold text-destructive">{summary?.criticalItems || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Shortage Value</p>
                <p className="text-2xl font-bold">{formatCurrency(summary?.totalShortageValue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Avg Days to Stock Out</p>
                <p className="text-2xl font-bold">{summary?.avgDaysToStockOut || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Urgency Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Items by Urgency</CardTitle>
            <CardDescription>Distribution of low stock items by urgency level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={urgencyData.filter(d => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {urgencyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Low Stock by Category</CardTitle>
            <CardDescription>Number of low stock items per category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--destructive))" name="Total Items" />
                <Bar dataKey="criticalCount" fill="hsl(var(--destructive))" name="Critical Items" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Items List */}
      <Card>
        <CardHeader>
          <CardTitle>Low Stock Items - Action Required</CardTitle>
          <CardDescription>
            Items requiring immediate attention with reorder recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {lowStockItems.slice(0, 50).map((item) => (
                <div
                  key={item.item_code}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.item_code}</p>
                      <Badge 
                        variant={
                          item.urgency_level === 'CRITICAL' ? 'destructive' :
                          item.urgency_level === 'HIGH' ? 'secondary' :
                          item.urgency_level === 'MEDIUM' ? 'outline' : 'default'
                        }
                      >
                        {item.urgency_level}
                      </Badge>
                      {item.estimated_days_stock <= 7 && (
                        <Badge variant="outline" className="text-xs">
                          {item.estimated_days_stock}d stock
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.item_name}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Category: {item.category_name}</span>
                      <span>Current: {item.current_qty} {item.uom}</span>
                      <span>Reorder Level: {item.reorder_level}</span>
                      <span>Shortage: {item.shortage_qty}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right space-y-1 mr-2">
                      <p className="text-sm font-medium">Suggested Order: {item.suggested_order_qty}</p>
                      <p className="text-xs text-muted-foreground">
                        Days consumption: {item.avg_daily_consumption.toFixed(1)}/day
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={item.urgency_level === 'CRITICAL' ? 'destructive' : 'outline'}
                      onClick={() => onReorderClick?.(item.item_code, item.suggested_order_qty)}
                      className="gap-1"
                    >
                      <ShoppingCart className="w-3 h-3" />
                      Reorder
                    </Button>
                  </div>
                </div>
              ))}
              {lowStockItems.length > 50 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  ... and {lowStockItems.length - 50} more items
                </div>
              )}
              {lowStockItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No low stock items found with current filters
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
