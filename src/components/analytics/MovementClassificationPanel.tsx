import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Activity, TrendingDown, Package2, Filter, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { useMovementClassification, MovementFilters } from "@/hooks/useMovementClassification";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
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
  Cell,
  ScatterChart,
  Scatter
} from "recharts";

interface MovementClassificationPanelProps {
  filters?: MovementFilters;
  onFiltersChange?: (filters: MovementFilters) => void;
  onOptimizeStock?: (itemCode: string, action: 'INCREASE' | 'DECREASE' | 'MAINTAIN') => void;
}

const classificationColors = {
  FAST_MOVING: '#10b981',
  MEDIUM_MOVING: '#3b82f6',
  SLOW_MOVING: '#f59e0b',
  DEAD_STOCK: '#ef4444'
};

const trendIcons = {
  INCREASING: ArrowUp,
  STABLE: Minus,
  DECREASING: ArrowDown,
  NO_DATA: Minus
};

export function MovementClassificationPanel({ 
  filters = {}, 
  onFiltersChange,
  onOptimizeStock 
}: MovementClassificationPanelProps) {
  const [localFilters, setLocalFilters] = useState<MovementFilters>(filters);
  const { movementClassification, movementSummary } = useMovementClassification(localFilters);

  const handleFilterChange = (key: keyof MovementFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  if (movementClassification.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Movement Classification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading movement classification data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (movementClassification.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Movement Classification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            Error loading movement classification data
          </div>
        </CardContent>
      </Card>
    );
  }

  const items = movementClassification.data || [];
  const summary = movementSummary.data;

  // Prepare chart data
  const classificationDistribution = [
    { name: 'Fast Moving', value: summary?.fastMovingItems || 0, color: classificationColors.FAST_MOVING },
    { name: 'Medium Moving', value: summary?.mediumMovingItems || 0, color: classificationColors.MEDIUM_MOVING },
    { name: 'Slow Moving', value: summary?.slowMovingItems || 0, color: classificationColors.SLOW_MOVING },
    { name: 'Dead Stock', value: summary?.deadStockItems || 0, color: classificationColors.DEAD_STOCK }
  ];

  const turnoverData = items.slice(0, 20).map(item => ({
    name: item.item_code.length > 8 ? item.item_code.substring(0, 8) + '...' : item.item_code,
    fullName: item.item_code,
    turnover: item.turnover_ratio,
    velocity: item.movement_velocity,
    classification: item.classification
  }));

  const categoryMovement = items.reduce((acc, item) => {
    const category = item.category_name || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = { 
        name: category, 
        fast: 0, 
        medium: 0, 
        slow: 0, 
        dead: 0,
        total: 0
      };
    }
    const key = item.classification.toLowerCase().split('_')[0];
    if (key === 'fast') acc[category].fast += 1;
    else if (key === 'medium') acc[category].medium += 1;
    else if (key === 'slow') acc[category].slow += 1;
    else if (key === 'dead') acc[category].dead += 1;
    acc[category].total += 1;
    return acc;
  }, {} as Record<string, { name: string; fast: number; medium: number; slow: number; dead: number; total: number }>);

  const categoryChartData = Object.values(categoryMovement).slice(0, 10);

  return (
    <div className="space-y-6" id="movement-classification-panel">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Movement Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Classification</label>
              <Select
                value={localFilters.classification || ""}
                onValueChange={(value) => handleFilterChange('classification', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All classifications" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All classifications</SelectItem>
                  <SelectItem value="FAST_MOVING">Fast Moving</SelectItem>
                  <SelectItem value="MEDIUM_MOVING">Medium Moving</SelectItem>
                  <SelectItem value="SLOW_MOVING">Slow Moving</SelectItem>
                  <SelectItem value="DEAD_STOCK">Dead Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Min Turnover Ratio</label>
              <Select
                value={localFilters.minTurnover?.toString() || ""}
                onValueChange={(value) => handleFilterChange('minTurnover', value ? parseFloat(value) : undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any turnover" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any turnover</SelectItem>
                  <SelectItem value="0.5">≥ 0.5</SelectItem>
                  <SelectItem value="1">≥ 1.0</SelectItem>
                  <SelectItem value="2">≥ 2.0</SelectItem>
                  <SelectItem value="5">≥ 5.0</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Turnover Ratio</label>
              <Select
                value={localFilters.maxTurnover?.toString() || ""}
                onValueChange={(value) => handleFilterChange('maxTurnover', value ? parseFloat(value) : undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any turnover" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any turnover</SelectItem>
                  <SelectItem value="1">≤ 1.0</SelectItem>
                  <SelectItem value="2">≤ 2.0</SelectItem>
                  <SelectItem value="5">≤ 5.0</SelectItem>
                  <SelectItem value="10">≤ 10.0</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select
                value={localFilters.category || ""}
                onValueChange={(value) => handleFilterChange('category', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {Object.keys(categoryMovement).map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
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
              <Zap className="w-4 h-4 text-green-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Fast Moving Items</p>
                <p className="text-2xl font-bold text-green-600">{summary?.fastMovingItems || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Medium Moving Items</p>
                <p className="text-2xl font-bold text-blue-600">{summary?.mediumMovingItems || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-4 h-4 text-orange-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Slow Moving Items</p>
                <p className="text-2xl font-bold text-orange-600">{summary?.slowMovingItems || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Package2 className="w-4 h-4 text-red-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Dead Stock Items</p>
                <p className="text-2xl font-bold text-red-600">{summary?.deadStockItems || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Classification Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Movement Classification</CardTitle>
            <CardDescription>Distribution of items by movement velocity</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={classificationDistribution.filter(d => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {classificationDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Turnover Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Turnover Ratio Analysis</CardTitle>
            <CardDescription>Top items by turnover ratio</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={turnoverData}>
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
                  formatter={(value) => [`${value}`, 'Turnover Ratio']}
                  labelFormatter={(label) => turnoverData.find(s => s.name === label)?.fullName || label}
                />
                <Bar dataKey="turnover" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Items List */}
      <Card>
        <CardHeader>
          <CardTitle>Item Movement Analysis</CardTitle>
          <CardDescription>
            Detailed classification with optimization recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {items.slice(0, 50).map((item) => {
                const TrendIcon = trendIcons[item.movement_trend];
                return (
                  <div
                    key={item.item_code}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.item_code}</p>
                        <Badge 
                          variant={
                            item.classification === 'FAST_MOVING' ? 'default' :
                            item.classification === 'MEDIUM_MOVING' ? 'secondary' :
                            item.classification === 'SLOW_MOVING' ? 'outline' : 'destructive'
                          }
                          style={{
                            backgroundColor: classificationColors[item.classification],
                            color: 'white'
                          }}
                        >
                          {item.classification.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <TrendIcon className="w-3 h-3" />
                          {item.movement_trend.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.item_name}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Category: {item.category_name}</span>
                        <span>Current Qty: {item.current_qty}</span>
                        <span>Turnover: {item.turnover_ratio}x</span>
                        <span>Velocity: {item.movement_velocity}</span>
                        <span>30d Consumption: {item.avg_monthly_consumption}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right space-y-1 mr-2">
                        <p className="text-sm font-medium">
                          Recommendation: {item.reorder_recommendation.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Issues: {item.total_issues_30d} | Receipts: {item.total_receipts_30d}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={
                          item.reorder_recommendation === 'INCREASE_STOCK' ? 'default' :
                          item.reorder_recommendation === 'REDUCE_STOCK' ? 'destructive' :
                          item.reorder_recommendation === 'DISCONTINUE' ? 'destructive' : 'outline'
                        }
                        onClick={() => {
                          const action = item.reorder_recommendation === 'INCREASE_STOCK' ? 'INCREASE' :
                                       item.reorder_recommendation === 'REDUCE_STOCK' ? 'DECREASE' : 'MAINTAIN';
                          onOptimizeStock?.(item.item_code, action);
                        }}
                        className="gap-1"
                      >
                        <Package2 className="w-3 h-3" />
                        Optimize
                      </Button>
                    </div>
                  </div>
                );
              })}
              {items.length > 50 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  ... and {items.length - 50} more items
                </div>
              )}
              {items.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No items found with current filters
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}