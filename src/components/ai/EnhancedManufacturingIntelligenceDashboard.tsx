import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, 
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
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Enhanced AI Intelligence Service
import { ManufacturingIntelligenceService } from '@/services/manufacturingIntelligence';
import { CategoryIntelligenceDashboard } from './CategoryIntelligenceDashboard';
import { HistoricalIntelligenceBrowser } from './HistoricalIntelligenceBrowser';
import { SessionIntelligenceTracker } from './SessionIntelligenceTracker';
import { EnhancedCategoryIntelligenceService } from '@/services/enhancedCategoryIntelligence';

interface EnhancedIntelligenceDashboardProps {
  className?: string;
}

interface AIInsight {
  type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  recommendation?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface AnalyticsResults {
  inventory_intelligence?: {
    total_items: number;
    low_stock_items: number;
    zero_stock_items: number;
    high_value_items: number;
    total_inventory_value: number;
    avg_stock_days: number;
    dead_stock_count: number;
    inventory_health_score: number;
  };
  process_efficiency?: {
    active_orders: number;
    process_stages: Record<string, any>;
    bottlenecks: Array<{
      stage: string;
      pending_count: number;
      avg_wait_time: number;
    }>;
    overall_efficiency: number;
  };
  quality_metrics?: {
    total_quality_checks: number;
    quality_rate: number;
    defect_rate: number;
    quality_trend: string;
    recent_issues: Array<{
      uiorn: string;
      stage: string;
      timestamp: string;
    }>;
  };
  predictive_insights?: {
    demand_pattern: string;
    seasonality_factor: number;
    predicted_stockouts: Array<{
      item_code: string;
      item_name: string;
      days_until_stockout: number;
    }>;
    maintenance_alerts: Array<{
      equipment: string;
      priority: string;
      recommendation: string;
    }>;
  };
  ai_recommendations?: Array<{
    type: string;
    priority: string;
    message: string;
    action: string;
  }>;
}

export function EnhancedManufacturingIntelligenceDashboard({ className }: EnhancedIntelligenceDashboardProps) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [analyticsResults, setAnalyticsResults] = useState<AnalyticsResults>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const { toast } = useToast();

  // Load real-time enhanced intelligence
  const loadEnhancedIntelligence = async () => {
    setIsLoading(true);
    try {
      const results = await ManufacturingIntelligenceService.getRealTimeInsights();
      
      if (results.insights) {
        setInsights(results.insights || []);
        setAnalyticsResults(results.analysisResults || {});
        setLastUpdated(new Date().toISOString());
        
        toast({
          title: "Intelligence Updated",
          description: "Enhanced manufacturing intelligence loaded successfully",
        });
      } else {
        throw new Error('Failed to load intelligence');
      }
    } catch (error) {
      console.error('Failed to load enhanced intelligence:', error);
      toast({
        title: "Error",
        description: "Failed to load enhanced intelligence data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Run specific enhanced analysis
  const runEnhancedAnalysis = async (analysisType: 'inventory' | 'process' | 'predictive') => {
    setIsLoading(true);
    try {
      let results;
      
      switch (analysisType) {
        case 'inventory':
          results = await ManufacturingIntelligenceService.analyzeInventory('comprehensive');
          break;
        case 'process':
          results = await ManufacturingIntelligenceService.analyzeProcessOptimization();
          break;
        case 'predictive':
          results = await ManufacturingIntelligenceService.generatePredictiveAnalytics('comprehensive');
          break;
        default:
          throw new Error('Unknown analysis type');
      }

      if (results.success) {
        setAnalyticsResults(prev => ({ ...prev, ...results.results }));
        
        toast({
          title: `${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} Analysis Complete`,
          description: `Enhanced ${analysisType} analysis completed successfully`,
        });
      } else {
        throw new Error(results.error || 'Analysis failed');
      }
    } catch (error) {
      console.error(`Enhanced ${analysisType} analysis failed:`, error);
      toast({
        title: "Analysis Failed",
        description: `Enhanced ${analysisType} analysis failed`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh every 5 minutes
  useEffect(() => {
    loadEnhancedIntelligence();
    const interval = setInterval(loadEnhancedIntelligence, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Get priority styling
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-destructive text-destructive-foreground';
      case 'HIGH': return 'bg-orange-500 text-white';
      case 'MEDIUM': return 'bg-yellow-500 text-black';
      case 'LOW': return 'bg-blue-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return <AlertTriangle className="h-4 w-4" />;
      case 'HIGH': return <AlertCircle className="h-4 w-4" />;
      case 'MEDIUM': return <Clock className="h-4 w-4" />;
      case 'LOW': return <CheckCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const summaryMetrics = {
    totalInsights: insights.length,
    criticalAlerts: insights.filter(i => i.priority === 'CRITICAL').length,
    actionableItems: insights.filter(i => i.recommendation).length,
    inventoryHealth: analyticsResults.inventory_intelligence?.inventory_health_score || 0,
    processEfficiency: analyticsResults.process_efficiency?.overall_efficiency || 0,
    qualityRate: analyticsResults.quality_metrics?.quality_rate || 0
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Enhanced AI Intelligence
          </h2>
          <p className="text-muted-foreground">
            Advanced manufacturing intelligence with predictive analytics and cross-module insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <Button 
            onClick={loadEnhancedIntelligence} 
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Enhanced Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Insights</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryMetrics.totalInsights}</div>
            <p className="text-xs text-muted-foreground">
              AI-generated insights
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summaryMetrics.criticalAlerts}</div>
            <p className="text-xs text-muted-foreground">
              Require immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Health</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryMetrics.inventoryHealth}%</div>
            <Progress value={summaryMetrics.inventoryHealth} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Process Efficiency</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryMetrics.processEfficiency}%</div>
            <Progress value={summaryMetrics.processEfficiency} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryMetrics.qualityRate.toFixed(1)}%</div>
            <Progress value={summaryMetrics.qualityRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actionable Items</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryMetrics.actionableItems}</div>
            <p className="text-xs text-muted-foreground">
              With recommendations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Tabbed Interface */}
      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="categories">Category Intelligence</TabsTrigger>
          <TabsTrigger value="historical">Historical Data</TabsTrigger>
          <TabsTrigger value="session">Session Intelligence</TabsTrigger>
          <TabsTrigger value="analytics">Advanced Analytics</TabsTrigger>
          <TabsTrigger value="predictive">Predictive Intelligence</TabsTrigger>
          <TabsTrigger value="recommendations">Smart Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Real-Time AI Insights
              </CardTitle>
              <CardDescription>
                Intelligent analysis of your manufacturing operations with priority-based alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] space-y-4">
                {insights.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {isLoading ? 'Loading enhanced insights...' : 'No insights available'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {insights.map((insight, index) => (
                      <Card key={index} className="border-l-4 border-l-primary">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <Badge className={getPriorityColor(insight.priority)}>
                                  {getPriorityIcon(insight.priority)}
                                  {insight.priority}
                                </Badge>
                                <Badge variant="outline">{insight.type}</Badge>
                              </div>
                              <h4 className="font-semibold">{insight.title}</h4>
                              <p className="text-sm text-muted-foreground">{insight.message}</p>
                              {insight.recommendation && (
                                <div className="bg-muted p-3 rounded-md">
                                  <p className="text-sm font-medium">💡 Recommendation:</p>
                                  <p className="text-sm">{insight.recommendation}</p>
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                              {insight.timestamp ? new Date(insight.timestamp).toLocaleTimeString() : 'Just now'}
                            </span>
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

        <TabsContent value="categories" className="space-y-4">
          <CategoryIntelligenceDashboard />
        </TabsContent>

        <TabsContent value="historical" className="space-y-4">
          <HistoricalIntelligenceBrowser />
        </TabsContent>

        <TabsContent value="session" className="space-y-4">
          <SessionIntelligenceTracker />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Inventory Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={() => runEnhancedAnalysis('inventory')} 
                  disabled={isLoading}
                  className="w-full"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Run Enhanced Inventory Analysis
                </Button>
                
                {analyticsResults.inventory_intelligence && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Total Items:</span>
                        <span className="ml-2">{analyticsResults.inventory_intelligence.total_items}</span>
                      </div>
                      <div>
                        <span className="font-medium">Low Stock:</span>
                        <span className="ml-2 text-orange-600">{analyticsResults.inventory_intelligence.low_stock_items}</span>
                      </div>
                      <div>
                        <span className="font-medium">Zero Stock:</span>
                        <span className="ml-2 text-red-600">{analyticsResults.inventory_intelligence.zero_stock_items}</span>
                      </div>
                      <div>
                        <span className="font-medium">Dead Stock:</span>
                        <span className="ml-2">{analyticsResults.inventory_intelligence.dead_stock_count}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Health Score</span>
                        <span className="text-sm font-medium">{analyticsResults.inventory_intelligence.inventory_health_score}%</span>
                      </div>
                      <Progress value={analyticsResults.inventory_intelligence.inventory_health_score} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Factory className="h-5 w-5" />
                  Process Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={() => runEnhancedAnalysis('process')} 
                  disabled={isLoading}
                  className="w-full"
                >
                  <Gauge className="h-4 w-4 mr-2" />
                  Analyze Process Efficiency
                </Button>
                
                {analyticsResults.process_efficiency && (
                  <div className="space-y-3">
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span>Active Orders:</span>
                        <span className="font-medium">{analyticsResults.process_efficiency.active_orders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Overall Efficiency:</span>
                        <span className="font-medium">{analyticsResults.process_efficiency.overall_efficiency}%</span>
                      </div>
                    </div>
                    
                    {analyticsResults.process_efficiency.bottlenecks && analyticsResults.process_efficiency.bottlenecks.length > 0 && (
                      <div>
                        <h5 className="font-medium text-sm mb-2">Process Bottlenecks:</h5>
                        <div className="space-y-1">
                          {analyticsResults.process_efficiency.bottlenecks.map((bottleneck, idx) => (
                            <div key={idx} className="text-xs bg-orange-50 p-2 rounded">
                              <span className="font-medium">{bottleneck.stage}:</span>
                              <span className="ml-1">{bottleneck.pending_count} pending</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="predictive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Predictive Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => runEnhancedAnalysis('predictive')} 
                disabled={isLoading}
                className="w-full"
              >
                <Brain className="h-4 w-4 mr-2" />
                Generate Predictive Insights
              </Button>
              
              {analyticsResults.predictive_insights && (
                <div className="grid gap-4 md:grid-cols-2">
                  {analyticsResults.predictive_insights.predicted_stockouts && analyticsResults.predictive_insights.predicted_stockouts.length > 0 && (
                    <div>
                      <h5 className="font-medium mb-2">Predicted Stockouts</h5>
                      <div className="space-y-2">
                        {analyticsResults.predictive_insights.predicted_stockouts.map((item, idx) => (
                          <div key={idx} className="text-sm bg-yellow-50 p-2 rounded">
                            <div className="font-medium">{item.item_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.days_until_stockout} days until stockout
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {analyticsResults.predictive_insights.maintenance_alerts && analyticsResults.predictive_insights.maintenance_alerts.length > 0 && (
                    <div>
                      <h5 className="font-medium mb-2">Maintenance Alerts</h5>
                      <div className="space-y-2">
                        {analyticsResults.predictive_insights.maintenance_alerts.map((alert, idx) => (
                          <div key={idx} className="text-sm bg-blue-50 p-2 rounded">
                            <div className="font-medium">{alert.equipment}</div>
                            <div className="text-xs text-muted-foreground">{alert.recommendation}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Smart Recommendations
              </CardTitle>
              <CardDescription>
                AI-powered actionable recommendations based on comprehensive analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsResults.ai_recommendations && analyticsResults.ai_recommendations.length > 0 ? (
                <div className="space-y-4">
                  {analyticsResults.ai_recommendations.map((rec, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge className={getPriorityColor(rec.priority)}>
                                {rec.priority}
                              </Badge>
                              <Badge variant="outline">{rec.type}</Badge>
                            </div>
                            <h4 className="font-semibold">{rec.message}</h4>
                            <div className="bg-muted p-3 rounded-md">
                              <p className="text-sm font-medium">🎯 Action:</p>
                              <p className="text-sm">{rec.action}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No recommendations available. Run analysis to generate smart recommendations.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}