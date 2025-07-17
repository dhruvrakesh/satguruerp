import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Target, Calendar } from "lucide-react";
import { useConsumptionPatterns, useConsumptionTrends, ConsumptionFilters } from "@/hooks/useConsumptionPatterns";
import { useState } from "react";
import { useCategories } from "@/hooks/useCategories";

interface ConsumptionPatternsPanelProps {
  onOptimizeStock?: (itemCode: string, action: string) => void;
}

const PATTERN_COLORS = {
  regular: '#22c55e',
  irregular: '#f59e0b', 
  seasonal: '#3b82f6',
  declining: '#ef4444'
};

const TREND_COLORS = {
  increasing: '#22c55e',
  decreasing: '#ef4444',
  stable: '#6b7280'
};

export function ConsumptionPatternsPanel({ onOptimizeStock }: ConsumptionPatternsPanelProps) {
  const [filters, setFilters] = useState<ConsumptionFilters>({
    months: 12,
    minConsumption: 0
  });

  const { data: categories } = useCategories();
  const { data: consumptionData, isLoading } = useConsumptionPatterns(filters);
  const { data: trendData } = useConsumptionTrends(filters.months);

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'increasing': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'decreasing': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPatternBadge = (pattern: string) => {
    const variants = {
      regular: 'default',
      irregular: 'secondary',
      seasonal: 'outline',
      declining: 'destructive'
    } as const;

    return (
      <Badge variant={variants[pattern as keyof typeof variants] || 'default'}>
        {pattern}
      </Badge>
    );
  };

  const getRiskBadge = (coefficient: number) => {
    if (coefficient > 75) return <Badge variant="destructive">High Risk</Badge>;
    if (coefficient > 50) return <Badge variant="secondary">Medium Risk</Badge>;
    if (coefficient > 25) return <Badge variant="outline">Low Risk</Badge>;
    return <Badge variant="default">Stable</Badge>;
  };

  // Prepare chart data
  const patternDistribution = consumptionData?.reduce((acc, item) => {
    const existing = acc.find(p => p.pattern === item.consumption_pattern);
    if (existing) {
      existing.count += 1;
      existing.value += item.monthly_consumption;
    } else {
      acc.push({
        pattern: item.consumption_pattern,
        count: 1,
        value: item.monthly_consumption
      });
    }
    return acc;
  }, [] as { pattern: string; count: number; value: number }[]) || [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Consumption Pattern Analysis</CardTitle>
          <CardDescription>
            Analyze consumption patterns, trends, and forecasting for inventory optimization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium">Time Period</label>
              <Select
                value={filters.months?.toString()}
                onValueChange={(value) => setFilters({ ...filters, months: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">Last 6 months</SelectItem>
                  <SelectItem value="12">Last 12 months</SelectItem>
                  <SelectItem value="24">Last 24 months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Category</label>
              <Select
                value={filters.category || "all"}
                onValueChange={(value) => setFilters({ ...filters, category: value === "all" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map(cat => (
                    <SelectItem key={cat.id} value={cat.category_name}>
                      {cat.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Min Consumption</label>
              <Input
                type="number"
                placeholder="0"
                value={filters.minConsumption || ""}
                onChange={(e) => setFilters({ ...filters, minConsumption: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Item Code</label>
              <Input
                placeholder="Filter by item code"
                value={filters.itemCode || ""}
                onChange={(e) => setFilters({ ...filters, itemCode: e.target.value || undefined })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analysis">Pattern Analysis</TabsTrigger>
          <TabsTrigger value="trends">Consumption Trends</TabsTrigger>
          <TabsTrigger value="forecasting">Forecasting</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pattern Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Pattern Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={patternDistribution}
                      dataKey="count"
                      nameKey="pattern"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {patternDistribution.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={PATTERN_COLORS[entry.pattern as keyof typeof PATTERN_COLORS] || '#8884d8'} 
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Variance Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Consumption Variability</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={consumptionData?.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="item_code" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="variance_coefficient" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Table */}
          <Card>
            <CardHeader>
              <CardTitle>Consumption Pattern Details</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading consumption patterns...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Avg Consumption</TableHead>
                      <TableHead>Pattern</TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead>Variability</TableHead>
                      <TableHead>Safety Stock</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumptionData?.slice(0, 20).map((item) => (
                      <TableRow key={item.item_code}>
                        <TableCell className="font-mono">{item.item_code}</TableCell>
                        <TableCell>{item.item_name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.average_consumption.toFixed(1)}</TableCell>
                        <TableCell>{getPatternBadge(item.consumption_pattern)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTrendIcon(item.trend_direction)}
                            <span className="text-sm">{item.trend_percentage.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{getRiskBadge(item.variance_coefficient)}</TableCell>
                        <TableCell>{item.safety_stock_recommended}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOptimizeStock?.(item.item_code, 'optimize')}
                          >
                            Optimize
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Consumption Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="total_consumption" stroke="#8884d8" strokeWidth={2} />
                  <Line type="monotone" dataKey="unique_items" stroke="#82ca9d" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecasting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Consumption Forecasting</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Current Avg</TableHead>
                    <TableHead>Forecast Next Month</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Recommended Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumptionData?.slice(0, 15).map((item) => {
                    const confidence = 100 - item.variance_coefficient;
                    let action = 'Monitor';
                    if (item.trend_direction === 'increasing') action = 'Increase Stock';
                    else if (item.trend_direction === 'decreasing') action = 'Reduce Stock';
                    
                    return (
                      <TableRow key={item.item_code}>
                        <TableCell className="font-mono">{item.item_code}</TableCell>
                        <TableCell>{item.average_consumption.toFixed(1)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTrendIcon(item.trend_direction)}
                            {item.forecast_next_month}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={confidence > 70 ? 'default' : confidence > 50 ? 'secondary' : 'outline'}>
                            {confidence.toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell>{action}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Seasonal Items</p>
                    <p className="text-2xl font-bold">
                      {consumptionData?.filter(item => item.consumption_pattern === 'seasonal').length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Growing Demand</p>
                    <p className="text-2xl font-bold">
                      {consumptionData?.filter(item => item.trend_direction === 'increasing').length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">High Variability</p>
                    <p className="text-2xl font-bold">
                      {consumptionData?.filter(item => item.variance_coefficient > 50).length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Target className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Need Optimization</p>
                    <p className="text-2xl font-bold">
                      {consumptionData?.filter(item => item.consumption_pattern === 'irregular').length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}