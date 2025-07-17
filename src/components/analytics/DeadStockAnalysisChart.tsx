import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Package, TrendingDown, Calendar } from "lucide-react";
import { useDeadStockAnalysis, DeadStockFilters } from "@/hooks/useDeadStockAnalysis";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
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

interface DeadStockAnalysisChartProps {
  filters?: DeadStockFilters;
  onItemSelect?: (itemCode: string) => void;
}

const actionColors = {
  DISPOSE: '#ef4444',
  LIQUIDATE: '#f97316', 
  REVIEW: '#eab308',
  MONITOR: '#3b82f6'
};

export function DeadStockAnalysisChart({ filters = {}, onItemSelect }: DeadStockAnalysisChartProps) {
  const { deadStockAnalysis, deadStockSummary } = useDeadStockAnalysis(filters);

  if (deadStockAnalysis.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Dead Stock Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading dead stock analysis...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (deadStockAnalysis.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Dead Stock Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            Error loading dead stock data
          </div>
        </CardContent>
      </Card>
    );
  }

  const deadStockItems = deadStockAnalysis.data || [];
  const summary = deadStockSummary.data;

  // Prepare chart data
  const chartData = [
    { name: 'Dispose (>365 days)', value: summary?.itemsToDispose || 0, color: actionColors.DISPOSE },
    { name: 'Liquidate (180-365 days)', value: summary?.itemsToLiquidate || 0, color: actionColors.LIQUIDATE },
    { name: 'Review (120-180 days)', value: summary?.itemsToReview || 0, color: actionColors.REVIEW },
    { name: 'Monitor (90-120 days)', value: (summary?.totalDeadStockItems || 0) - (summary?.itemsToDispose || 0) - (summary?.itemsToLiquidate || 0) - (summary?.itemsToReview || 0), color: actionColors.MONITOR }
  ];

  const categoryData = deadStockItems.reduce((acc, item) => {
    const category = item.category_name || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = { name: category, value: 0, count: 0 };
    }
    acc[category].value += item.estimated_value;
    acc[category].count += 1;
    return acc;
  }, {} as Record<string, { name: string; value: number; count: number }>);

  const categoryChartData = Object.values(categoryData).slice(0, 10);

  return (
    <div className="space-y-6" id="dead-stock-analysis-charts">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Total Dead Stock</p>
                <p className="text-2xl font-bold">{summary?.totalDeadStockItems || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-4 h-4 text-destructive" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrency(summary?.totalDeadStockValue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Avg Days No Movement</p>
                <p className="text-2xl font-bold">{summary?.averageDaysNoMovement || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Action Required</p>
                <p className="text-2xl font-bold">{(summary?.itemsToDispose || 0) + (summary?.itemsToLiquidate || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Action Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Recommended Actions</CardTitle>
            <CardDescription>Distribution of items by recommended action</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData.filter(d => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Value Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Dead Stock by Category</CardTitle>
            <CardDescription>Value distribution across categories</CardDescription>
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
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Value']}
                  labelFormatter={(label) => `Category: ${label}`}
                />
                <Bar dataKey="value" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Items List */}
      <Card>
        <CardHeader>
          <CardTitle>Dead Stock Items</CardTitle>
          <CardDescription>
            Items with no movement for {filters.minDaysNoMovement || 90}+ days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {deadStockItems.slice(0, 50).map((item) => (
                <div
                  key={item.item_code}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => onItemSelect?.(item.item_code)}
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.item_code}</p>
                      <Badge 
                        variant={
                          item.recommended_action === 'DISPOSE' ? 'destructive' :
                          item.recommended_action === 'LIQUIDATE' ? 'secondary' :
                          item.recommended_action === 'REVIEW' ? 'outline' : 'default'
                        }
                      >
                        {item.recommended_action}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.item_name}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Category: {item.category_name}</span>
                      <span>Qty: {item.current_qty}</span>
                      <span>Last Movement: {item.last_movement_date ? format(new Date(item.last_movement_date), 'PP') : 'Unknown'}</span>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-medium">{formatCurrency(item.estimated_value)}</p>
                    <p className="text-xs text-muted-foreground">{item.days_since_movement} days</p>
                  </div>
                </div>
              ))}
              {deadStockItems.length > 50 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  ... and {deadStockItems.length - 50} more items
                </div>
              )}
              {deadStockItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No dead stock items found with current filters
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}