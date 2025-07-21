
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Minus, Filter, Download } from "lucide-react";
import { useMovementClassification } from "@/hooks/useMovementClassification";
import { useState } from "react";

interface MovementClassificationPanelProps {
  onOptimizeStock?: (itemCode: string, action: string) => void;
}

const movementColors = {
  'Fast Moving': '#22c55e',
  'Medium Moving': '#f59e0b', 
  'Slow Moving': '#ef4444',
  'Non Moving': '#6b7280'
};

export function MovementClassificationPanel({ onOptimizeStock }: MovementClassificationPanelProps) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [movementFilter, setMovementFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("90");
  
  const { 
    movementClassification, 
    movementSummary 
  } = useMovementClassification({
    category: categoryFilter === "all" ? undefined : categoryFilter,
    movementType: movementFilter === "all" ? undefined : movementFilter,
    days: parseInt(periodFilter)
  });

  const getMovementIcon = (movement: string) => {
    switch (movement.toLowerCase()) {
      case 'fast moving': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'medium moving': return <Minus className="w-4 h-4 text-yellow-500" />;
      case 'slow moving': return <TrendingDown className="w-4 h-4 text-orange-500" />;
      case 'non moving': return <Minus className="w-4 h-4 text-red-500" />;
      default: return <TrendingUp className="w-4 h-4" />;
    }
  };

  const getMovementColor = (movement: string) => {
    switch (movement.toLowerCase()) {
      case 'fast moving': return 'bg-green-500';
      case 'medium moving': return 'bg-yellow-500';
      case 'slow moving': return 'bg-orange-500';
      case 'non moving': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const items = movementClassification.data || [];
  const filteredItems = items.filter(item => {
    const categoryMatch = categoryFilter === "all" || item.category === categoryFilter;
    const movementMatch = movementFilter === "all" || item.movementClassification === movementFilter;
    return categoryMatch && movementMatch;
  });

  // Prepare chart data
  const movementData = Object.entries(movementColors).map(([name, color]) => ({
    name,
    value: items.filter(item => item.movementClassification === name).length,
    color
  }));

  const categoryData = items.reduce((acc, item) => {
    const category = item.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = { name: category, fastMoving: 0, slowMoving: 0, nonMoving: 0 };
    }
    if (item.movementClassification === 'Fast Moving') acc[category].fastMoving++;
    else if (item.movementClassification === 'Slow Moving') acc[category].slowMoving++;
    else if (item.movementClassification === 'Non Moving') acc[category].nonMoving++;
    return acc;
  }, {} as Record<string, any>);

  const categoryChartData = Object.values(categoryData).slice(0, 10);

  if (movementClassification.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Movement Classification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Analyzing movement patterns...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Movement Analysis Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Time Period</label>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="60">Last 60 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="180">Last 180 days</SelectItem>
                  <SelectItem value="365">Last 1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="raw_materials">Raw Materials</SelectItem>
                  <SelectItem value="finished_goods">Finished Goods</SelectItem>
                  <SelectItem value="work_in_progress">Work in Progress</SelectItem>
                  <SelectItem value="consumables">Consumables</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Movement Type</label>
              <Select value={movementFilter} onValueChange={setMovementFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by movement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Movement Types</SelectItem>
                  <SelectItem value="Fast Moving">Fast Moving</SelectItem>
                  <SelectItem value="Medium Moving">Medium Moving</SelectItem>
                  <SelectItem value="Slow Moving">Slow Moving</SelectItem>
                  <SelectItem value="Non Moving">Non Moving</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" className="w-full gap-2">
                <Download className="w-4 h-4" />
                Export Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Fast Moving</p>
                <p className="text-2xl font-bold text-green-500">
                  {movementSummary.data?.fastMovingItems || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Minus className="w-4 h-4 text-yellow-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Medium Moving</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {movementSummary.data?.mediumMovingItems || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-4 h-4 text-orange-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Slow Moving</p>
                <p className="text-2xl font-bold text-orange-500">
                  {movementSummary.data?.slowMovingItems || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Minus className="w-4 h-4 text-red-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Non Moving</p>
                <p className="text-2xl font-bold text-red-500">
                  {movementSummary.data?.nonMovingItems || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Movement Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Movement Distribution</CardTitle>
            <CardDescription>Items by movement classification</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={movementData.filter(d => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {movementData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Movement by Category</CardTitle>
            <CardDescription>Movement patterns across categories</CardDescription>
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
                <Bar dataKey="fastMoving" fill="#22c55e" name="Fast Moving" />
                <Bar dataKey="slowMoving" fill="#ef4444" name="Slow Moving" />
                <Bar dataKey="nonMoving" fill="#6b7280" name="Non Moving" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Items List */}
      <Card>
        <CardHeader>
          <CardTitle>Item Movement Analysis</CardTitle>
          <CardDescription>
            Detailed movement classification for inventory optimization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items found with current filters
                </div>
              ) : (
                filteredItems.slice(0, 50).map((item) => (
                  <div
                    key={item.itemCode}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {getMovementIcon(item.movementClassification)}
                        <p className="font-medium">{item.itemCode}</p>
                        <Badge className={`${getMovementColor(item.movementClassification)} text-white`}>
                          {item.movementClassification}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.itemName}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Category: {item.category}</span>
                        <span>Current Stock: {item.currentStock}</span>
                        <span>Avg Monthly Usage: {item.avgMonthlyUsage}</span>
                        <span>Days Since Last Issue: {item.daysSinceLastMovement}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOptimizeStock?.(item.itemCode, 'optimize')}
                        className="gap-1"
                      >
                        Optimize
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {/* View details */}}
                        className="gap-1"
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                ))
              )}
              {filteredItems.length > 50 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  ... and {filteredItems.length - 50} more items
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
