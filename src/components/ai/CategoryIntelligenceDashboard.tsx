import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Package2, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  BarChart3,
  RefreshCw,
  Activity,
  Target,
  Zap,
  Factory,
  Package,
  Gauge,
  AlertCircle,
  Clock,
  Filter,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CategoryIntelligenceService, CategoryMovement, CategoryInsight, MATERIAL_CATEGORIES } from '@/services/categoryIntelligence';

interface CategoryIntelligenceDashboardProps {
  className?: string;
}

export function CategoryIntelligenceDashboard({ className }: CategoryIntelligenceDashboardProps) {
  const [movements, setMovements] = useState<CategoryMovement[]>([]);
  const [insights, setInsights] = useState<CategoryInsight[]>([]);
  const [summary, setSummary] = useState({
    total_categories: 0,
    high_performing: 0,
    needs_attention: 0,
    critical_issues: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { toast } = useToast();

  // Load category intelligence
  const loadCategoryIntelligence = async () => {
    setIsLoading(true);
    try {
      const results = await CategoryIntelligenceService.analyzeCategoryMovements();
      
      setMovements(results.movements);
      setInsights(results.insights);
      setSummary(results.summary);
      setLastUpdated(new Date().toISOString());
      
      toast({
        title: "Category Intelligence Updated",
        description: "Material category analysis completed successfully",
      });
    } catch (error) {
      console.error('Failed to load category intelligence:', error);
      toast({
        title: "Error",
        description: "Failed to load category intelligence data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh every 10 minutes
  useEffect(() => {
    loadCategoryIntelligence();
    const interval = setInterval(loadCategoryIntelligence, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Get priority styling for insights
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getVelocityColor = (velocity: string) => {
    switch (velocity) {
      case 'FAST': return 'text-green-600';
      case 'MEDIUM': return 'text-blue-600';
      case 'SLOW': return 'text-orange-600';
      case 'STAGNANT': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'IMPROVING': return <ArrowUp className="h-4 w-4 text-green-600" />;
      case 'DECLINING': return <ArrowDown className="h-4 w-4 text-red-600" />;
      case 'STABLE': return <Minus className="h-4 w-4 text-blue-600" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const filteredMovements = selectedCategory 
    ? movements.filter(m => m.category === selectedCategory)
    : movements;

  const filteredInsights = selectedCategory
    ? insights.filter(i => i.category === selectedCategory)
    : insights;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package2 className="h-8 w-8 text-primary" />
            Category Intelligence
          </h2>
          <p className="text-muted-foreground">
            Advanced analytics for material categories: BOPP, PET, INK, PAPER, GRAN, LDPELAM, CHEM & more
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <Button 
            onClick={loadCategoryIntelligence} 
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Categories</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_categories}</div>
            <p className="text-xs text-muted-foreground">
              Material categories tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Performing</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.high_performing}</div>
            <p className="text-xs text-muted-foreground">
              Categories above 80% health
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summary.needs_attention}</div>
            <p className="text-xs text-muted-foreground">
              Categories requiring optimization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summary.critical_issues}</div>
            <p className="text-xs text-muted-foreground">
              Critical alerts requiring action
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Category Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All Categories
            </Button>
            {Object.keys(MATERIAL_CATEGORIES).map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Interface */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Category Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance Analysis</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="recommendations">Action Items</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMovements.map((movement, index) => (
              <Card key={index} className="border-l-4 border-l-primary">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{movement.category}</span>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(movement.trend)}
                      <Badge className={getVelocityColor(movement.movement_velocity)}>
                        {movement.movement_velocity}
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Total Items:</span>
                      <span className="ml-2">{movement.total_items}</span>
                    </div>
                    <div>
                      <span className="font-medium">Active:</span>
                      <span className="ml-2">{movement.active_items}</span>
                    </div>
                    <div>
                      <span className="font-medium">Low Stock:</span>
                      <span className="ml-2 text-orange-600">{movement.low_stock_items}</span>
                    </div>
                    <div>
                      <span className="font-medium">Out of Stock:</span>
                      <span className="ml-2 text-red-600">{movement.out_of_stock_items}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Health Score</span>
                      <span className="text-sm font-medium">{movement.health_score}%</span>
                    </div>
                    <Progress value={movement.health_score} />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Turnover Rate:</span>
                      <span className="font-medium">{movement.avg_turnover}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Value:</span>
                      <span className="font-medium">₹{movement.total_value.toLocaleString()}</span>
                    </div>
                  </div>

                  {movement.critical_items.length > 0 && (
                    <div className="pt-2 border-t">
                      <h5 className="text-sm font-medium text-red-600 mb-1">
                        Critical Items ({movement.critical_items.length})
                      </h5>
                      <div className="space-y-1">
                        {movement.critical_items.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="text-xs bg-red-50 p-2 rounded">
                            <div className="font-medium">{item.item_code}</div>
                            <div className="text-muted-foreground">
                              {item.status.replace('_', ' ')} - {item.days_cover} days cover
                            </div>
                          </div>
                        ))}
                        {movement.critical_items.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{movement.critical_items.length - 3} more items
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Category Performance Matrix</CardTitle>
              <CardDescription>
                Comparative analysis of health scores and movement velocity across categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredMovements
                  .sort((a, b) => b.health_score - a.health_score)
                  .map((movement, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <h4 className="font-semibold">{movement.category}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{movement.total_items} items</span>
                          <span className={getVelocityColor(movement.movement_velocity)}>
                            {movement.movement_velocity} velocity
                          </span>
                          <span>₹{movement.total_value.toLocaleString()} value</span>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-lg font-bold">{movement.health_score}%</div>
                        <Progress value={movement.health_score} className="w-32" />
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                AI Category Insights
              </CardTitle>
              <CardDescription>
                Intelligent analysis and recommendations for material category optimization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] space-y-4">
                {filteredInsights.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {isLoading ? 'Loading category insights...' : 'No insights available'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredInsights.map((insight, index) => (
                      <Card key={index} className="border-l-4 border-l-primary">
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Badge className={getPriorityColor(insight.priority)}>
                                {insight.priority.toUpperCase()}
                              </Badge>
                              <Badge variant="outline">{insight.category}</Badge>
                              <Badge variant="secondary">{insight.type}</Badge>
                            </div>
                            
                            <h4 className="font-semibold">{insight.title}</h4>
                            <p className="text-sm text-muted-foreground">{insight.message}</p>
                            
                            <div className="bg-muted p-3 rounded-md">
                              <p className="text-sm font-medium">💡 Recommendation:</p>
                              <p className="text-sm">{insight.recommendation}</p>
                            </div>

                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Current:</span>
                                <span className="ml-2">{insight.metrics.current_value}</span>
                              </div>
                              <div>
                                <span className="font-medium">Target:</span>
                                <span className="ml-2">{insight.metrics.target_value}</span>
                              </div>
                              <div>
                                <span className="font-medium">Trend:</span>
                                <span className="ml-2 capitalize">{insight.metrics.trend}</span>
                              </div>
                            </div>

                            {insight.action_items.length > 0 && (
                              <div className="bg-blue-50 p-3 rounded-md">
                                <p className="text-sm font-medium mb-2">🎯 Action Items:</p>
                                <ul className="text-sm space-y-1">
                                  {insight.action_items.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <span className="text-blue-600">•</span>
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Strategic Recommendations
              </CardTitle>
              <CardDescription>
                Priority-based action plan for material category optimization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredInsights
                  .filter(insight => insight.priority === 'critical' || insight.priority === 'high')
                  .map((insight, index) => (
                    <Card key={index} className="border-l-4 border-l-orange-500">
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className={getPriorityColor(insight.priority)}>
                                {insight.priority.toUpperCase()}
                              </Badge>
                              <h4 className="font-semibold">{insight.category}</h4>
                            </div>
                          </div>
                          
                          <p className="text-sm">{insight.recommendation}</p>
                          
                          <div className="bg-orange-50 p-3 rounded-md">
                            <p className="text-sm font-medium mb-2">📋 Implementation Steps:</p>
                            <ol className="text-sm space-y-1">
                              {insight.action_items.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-orange-600 font-medium">{idx + 1}.</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                
                {filteredInsights.filter(i => i.priority === 'critical' || i.priority === 'high').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No high-priority recommendations at this time. Your material categories are performing well!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}