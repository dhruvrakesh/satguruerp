
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, TrendingUp, TrendingDown, Target, Filter, Download } from "lucide-react";
import { useInventoryOptimization } from "@/hooks/useInventoryOptimization";
import { useState } from "react";

export function InventoryOptimizationPanel() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  
  const { 
    optimizationRecommendations, 
    optimizationSummary 
  } = useInventoryOptimization({
    category: categoryFilter === "all" ? undefined : categoryFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter
  });

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'increase': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'decrease': return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'optimize': return <Target className="w-4 h-4 text-blue-500" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const recommendations = optimizationRecommendations.data || [];
  const filteredRecommendations = recommendations.filter(rec => {
    const categoryMatch = categoryFilter === "all" || rec.category === categoryFilter;
    const priorityMatch = priorityFilter === "all" || rec.priority === priorityFilter;
    return categoryMatch && priorityMatch;
  });

  if (optimizationRecommendations.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Inventory Optimization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Analyzing inventory optimization opportunities...
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
            Optimization Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
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
              <label className="text-sm font-medium">Priority</label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="low">Low Priority</SelectItem>
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
              <Target className="w-4 h-4 text-blue-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Total Recommendations</p>
                <p className="text-2xl font-bold">{optimizationSummary.data?.totalRecommendations || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Potential Savings</p>
                <p className="text-2xl font-bold text-green-500">
                  ₹{(optimizationSummary.data?.potentialSavings || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-orange-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">High Priority Items</p>
                <p className="text-2xl font-bold text-orange-500">
                  {optimizationSummary.data?.highPriorityItems || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-purple-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Turnover Improvement</p>
                <p className="text-2xl font-bold text-purple-500">
                  {optimizationSummary.data?.turnoverImprovement || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations List */}
      <Card>
        <CardHeader>
          <CardTitle>Optimization Recommendations</CardTitle>
          <CardDescription>
            AI-powered suggestions to improve inventory efficiency and reduce costs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredRecommendations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No optimization recommendations found with current filters
                </div>
              ) : (
                filteredRecommendations.map((recommendation) => (
                  <div
                    key={recommendation.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {getActionIcon(recommendation.action)}
                        <p className="font-medium">{recommendation.itemCode}</p>
                        <Badge className={`${getPriorityColor(recommendation.priority)} text-white`}>
                          {recommendation.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{recommendation.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Category: {recommendation.category}</span>
                        <span>Current Stock: {recommendation.currentStock}</span>
                        <span>Recommended: {recommendation.recommendedStock}</span>
                        <span>Impact: ₹{recommendation.impactValue?.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {/* Implement action */}}
                        className="gap-1"
                      >
                        {recommendation.action === 'increase' ? 'Order More' : 
                         recommendation.action === 'decrease' ? 'Reduce Stock' : 
                         'Optimize'}
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
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
