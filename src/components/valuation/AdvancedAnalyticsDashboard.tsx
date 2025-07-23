import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, TrendingDown, AlertTriangle, Target, 
  BarChart3, PieChart, LineChart, Download 
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subMonths } from "date-fns";

interface PriceVarianceAnalysis {
  item_code: string;
  item_name: string;
  category_name: string;
  current_price: number;
  previous_price: number;
  variance_amount: number;
  variance_percentage: number;
  last_change_date: string;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
}

interface DeadStockAnalysis {
  item_code: string;
  item_name: string;
  current_qty: number;
  current_value: number;
  last_movement_date: string;
  days_since_movement: number;
  category_name: string;
}

export function AdvancedAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [activeTab, setActiveTab] = useState('variance');

  // Price Variance Analysis - Using existing valuation analytics
  const { data: priceVarianceData = [] } = useQuery({
    queryKey: ['price-variance-analysis', timeRange],
    queryFn: async () => {
      const startDate = getStartDate(timeRange);
      
      // Use existing valuation price history to calculate variance
      const { data, error } = await supabase
        .from('valuation_price_history')
        .select(`
          item_code,
          old_price,
          new_price,
          change_reason,
          effective_date,
          created_at
        `)
        .gte('effective_date', startDate)
        .order('effective_date', { ascending: false });

      if (error) throw error;

      // Process the data to calculate variance
      const varianceMap = new Map();
      data?.forEach(record => {
        if (!varianceMap.has(record.item_code)) {
          const variance_amount = record.new_price - record.old_price;
          const variance_percentage = (variance_amount / record.old_price) * 100;
          
          varianceMap.set(record.item_code, {
            item_code: record.item_code,
            item_name: record.item_code, // We'll need to join with item master for names
            category_name: 'Various',
            current_price: record.new_price,
            previous_price: record.old_price,
            variance_amount,
            variance_percentage,
            last_change_date: record.effective_date,
            trend: variance_amount > 0 ? 'INCREASING' : variance_amount < 0 ? 'DECREASING' : 'STABLE'
          });
        }
      });

      return Array.from(varianceMap.values()) as PriceVarianceAnalysis[];
    }
  });

  // Dead Stock Analysis - Using existing stock data
  const { data: deadStockData = [] } = useQuery({
    queryKey: ['dead-stock-analysis'],
    queryFn: async () => {
      // This would typically come from stock movement analysis
      // For now, we'll return mock data that matches the structure
      return [] as DeadStockAnalysis[];
    }
  });

  function getStartDate(range: string): string {
    const now = new Date();
    switch (range) {
      case '7d': return format(subDays(now, 7), 'yyyy-MM-dd');
      case '30d': return format(subDays(now, 30), 'yyyy-MM-dd');
      case '90d': return format(subDays(now, 90), 'yyyy-MM-dd');
      case '1y': return format(subMonths(now, 12), 'yyyy-MM-dd');
      default: return format(subDays(now, 30), 'yyyy-MM-dd');
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'INCREASING': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'DECREASING': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Target className="h-4 w-4 text-gray-500" />;
    }
  };

  // Calculate summary metrics
  const totalVarianceImpact = priceVarianceData.reduce((sum, item) => sum + Math.abs(item.variance_amount), 0);
  const deadStockValue = deadStockData.reduce((sum, item) => sum + item.current_value, 0);

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advanced Analytics</h2>
          <p className="text-muted-foreground">
            Deep insights into pricing trends, variance analysis, and risk assessment
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange as any}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(totalVarianceImpact)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total Price Variance Impact
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(deadStockValue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Dead Stock Value
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {priceVarianceData.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Price Changes
                </p>
              </div>
              <PieChart className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {deadStockData.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Items with No Movement
                </p>
              </div>
              <LineChart className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="variance">Price Variance</TabsTrigger>
          <TabsTrigger value="deadstock">Dead Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="variance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Price Variance Analysis</CardTitle>
              <CardDescription>
                Items with significant price changes in the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Item Code</th>
                      <th className="text-left p-2">Item Name</th>
                      <th className="text-left p-2">Category</th>
                      <th className="text-right p-2">Current Price</th>
                      <th className="text-right p-2">Previous Price</th>
                      <th className="text-right p-2">Variance %</th>
                      <th className="text-center p-2">Trend</th>
                      <th className="text-left p-2">Last Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceVarianceData.slice(0, 20).map((item) => (
                      <tr key={item.item_code} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-mono text-sm">{item.item_code}</td>
                        <td className="p-2">{item.item_name}</td>
                        <td className="p-2">{item.category_name}</td>
                        <td className="p-2 text-right">₹{item.current_price.toFixed(2)}</td>
                        <td className="p-2 text-right">₹{item.previous_price.toFixed(2)}</td>
                        <td className="p-2 text-right">
                          <span className={
                            item.variance_percentage > 0 ? 'text-green-600' : 'text-red-600'
                          }>
                            {item.variance_percentage.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          {getTrendIcon(item.trend)}
                        </td>
                        <td className="p-2">
                          {format(new Date(item.last_change_date), 'MMM d, yyyy')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deadstock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dead Stock Analysis</CardTitle>
              <CardDescription>
                Items with no movement for more than 90 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deadStockData.length === 0 ? (
                <div className="text-center py-8">
                  <LineChart className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-muted-foreground">No dead stock detected in the current period</p>
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
                        <th className="text-right p-2">Value</th>
                        <th className="text-right p-2">Days Since Movement</th>
                        <th className="text-left p-2">Last Movement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deadStockData.slice(0, 20).map((item) => (
                        <tr key={item.item_code} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-mono text-sm">{item.item_code}</td>
                          <td className="p-2">{item.item_name}</td>
                          <td className="p-2">{item.category_name}</td>
                          <td className="p-2 text-right">{item.current_qty.toFixed(2)}</td>
                          <td className="p-2 text-right">{formatCurrency(item.current_value)}</td>
                          <td className="p-2 text-right">
                            <Badge variant={
                              item.days_since_movement > 180 ? 'destructive' :
                              item.days_since_movement > 120 ? 'secondary' : 'outline'
                            }>
                              {item.days_since_movement} days
                            </Badge>
                          </td>
                          <td className="p-2">
                            {format(new Date(item.last_movement_date), 'MMM d, yyyy')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}