import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Target, TrendingDown, RefreshCw, DollarSign, Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useInventoryOptimization, useRefreshAnalytics } from "@/hooks/useInventoryOptimization";
import { useCategories } from "@/hooks/useCategories";
import { toast } from "sonner";

export const InventoryOptimizationPanel = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [serviceLevel, setServiceLevel] = useState<number>(0.95);

  const { data: categories } = useCategories();
  
  const { data: optimizations, isLoading, refetch } = useInventoryOptimization({
    categoryId: selectedCategory || undefined,
    serviceLevel,
  });

  const refreshMutation = useRefreshAnalytics();

  const handleRefresh = async () => {
    try {
      await refreshMutation.mutateAsync();
      toast.success("Analytics refreshed successfully");
      refetch();
    } catch (error) {
      toast.error("Failed to refresh analytics");
    }
  };

  const getTotalSavings = () => {
    if (!optimizations) return 0;
    return optimizations.reduce((sum, opt) => sum + opt.total_cost_reduction, 0);
  };

  const getPriorityDistribution = () => {
    if (!optimizations) return [];
    
    const distribution = optimizations.reduce((acc, opt) => {
      acc[opt.implementation_priority] = (acc[opt.implementation_priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(distribution).map(([priority, count]) => ({
      name: priority,
      value: count,
      color: priority === 'HIGH' ? '#ef4444' : priority === 'MEDIUM' ? '#f59e0b' : '#10b981'
    }));
  };

  const getTopOptimizations = () => {
    if (!optimizations) return [];
    return optimizations
      .sort((a, b) => b.total_cost_reduction - a.total_cost_reduction)
      .slice(0, 10)
      .map(opt => ({
        item: opt.item_name,
        savings: opt.total_cost_reduction,
        priority: opt.implementation_priority,
        currentStock: opt.current_stock,
        recommendedReorder: opt.recommended_reorder_point,
        eoq: opt.economic_order_quantity,
      }));
  };

  const COLORS = {
    HIGH: '#ef4444',
    MEDIUM: '#f59e0b',
    LOW: '#10b981'
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Inventory Level Optimization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Category Filter</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Service Level</label>
              <Select value={serviceLevel.toString()} onValueChange={(v) => setServiceLevel(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.90">90% Service Level</SelectItem>
                  <SelectItem value="0.95">95% Service Level</SelectItem>
                  <SelectItem value="0.99">99% Service Level</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleRefresh}
                disabled={refreshMutation.isPending}
                className="w-full"
              >
                {refreshMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh Analytics
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : optimizations && optimizations.length > 0 ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Savings</p>
                        <p className="text-2xl font-bold">₹{getTotalSavings().toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Items Analyzed</p>
                        <p className="text-2xl font-bold">{optimizations.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">High Priority</p>
                        <p className="text-2xl font-bold">
                          {optimizations.filter(o => o.implementation_priority === 'HIGH').length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-orange-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Savings/Item</p>
                        <p className="text-2xl font-bold">
                          ₹{(getTotalSavings() / optimizations.length).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Optimizations Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top Cost Reduction Opportunities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={getTopOptimizations()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="item" 
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          fontSize={10}
                        />
                        <YAxis />
                        <Tooltip 
                          formatter={(value: any, name: string) => [
                            name === 'savings' ? `₹${value.toLocaleString()}` : value,
                            name === 'savings' ? 'Cost Reduction' : name
                          ]}
                        />
                        <Bar 
                          dataKey="savings" 
                          fill="#8884d8"
                          name="Cost Reduction (₹)"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Priority Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Implementation Priority Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={getPriorityDistribution()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {getPriorityDistribution().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Recommendations Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detailed Optimization Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Item</th>
                          <th className="text-left p-2">Current Stock</th>
                          <th className="text-left p-2">Recommended Reorder</th>
                          <th className="text-left p-2">Max Stock</th>
                          <th className="text-left p-2">EOQ</th>
                          <th className="text-left p-2">Cost Reduction</th>
                          <th className="text-left p-2">Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optimizations.slice(0, 20).map((opt, index) => (
                          <tr key={index} className="border-b hover:bg-muted/50">
                            <td className="p-2">
                              <div>
                                <p className="font-medium">{opt.item_name}</p>
                                <p className="text-xs text-muted-foreground">{opt.item_code}</p>
                              </div>
                            </td>
                            <td className="p-2">{opt.current_stock.toFixed(0)}</td>
                            <td className="p-2">{opt.recommended_reorder_point.toFixed(0)}</td>
                            <td className="p-2">{opt.recommended_max_stock.toFixed(0)}</td>
                            <td className="p-2">{opt.economic_order_quantity.toFixed(0)}</td>
                            <td className="p-2">₹{opt.total_cost_reduction.toLocaleString()}</td>
                            <td className="p-2">
                              <Badge 
                                variant={
                                  opt.implementation_priority === 'HIGH' ? 'destructive' :
                                  opt.implementation_priority === 'MEDIUM' ? 'default' : 'secondary'
                                }
                              >
                                {opt.implementation_priority}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No optimization data available. Ensure you have sufficient transaction history.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};