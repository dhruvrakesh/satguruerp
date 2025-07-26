import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Target,
  BarChart3,
  Zap,
  Factory,
  Package,
  Loader2
} from 'lucide-react';
import { ManufacturingIntelligenceService, ManufacturingInsight } from '@/services/manufacturingIntelligence';
import { useToast } from '@/hooks/use-toast';

interface IntelligenceDashboardProps {
  className?: string;
}

export function ManufacturingIntelligenceDashboard({ className }: IntelligenceDashboardProps) {
  const [insights, setInsights] = useState<ManufacturingInsight[]>([]);
  const [analysisResults, setAnalysisResults] = useState<any>({});
  const [summary, setSummary] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const { toast } = useToast();

  const loadRealTimeInsights = async () => {
    try {
      setIsLoading(true);
      const data = await ManufacturingIntelligenceService.getRealTimeInsights();
      
      setInsights(data.insights);
      setAnalysisResults(data.analysisResults);
      setSummary(data.summary);
      setLastUpdated(data.timestamp);

      if (data.error) {
        console.warn('Partial insights loaded with errors:', data.error);
      }
    } catch (error) {
      console.error('Failed to load real-time insights:', error);
      toast({
        title: "Error",
        description: "Failed to load manufacturing intelligence data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runSpecificAnalysis = async (analysisType: 'inventory' | 'process' | 'predictive') => {
    try {
      setIsLoading(true);
      let result;
      
      switch (analysisType) {
        case 'inventory':
          result = await ManufacturingIntelligenceService.analyzeInventory('comprehensive');
          break;
        case 'process':
          result = await ManufacturingIntelligenceService.analyzeProcessOptimization();
          break;
        case 'predictive':
          result = await ManufacturingIntelligenceService.generatePredictiveAnalytics();
          break;
      }

      toast({
        title: "Analysis Complete",
        description: `${result.insights.length} insights generated in ${result.executionTime}ms`,
      });

      // Refresh all insights
      await loadRealTimeInsights();
    } catch (error) {
      console.error(`Failed to run ${analysisType} analysis:`, error);
      toast({
        title: "Analysis Failed",
        description: `Failed to run ${analysisType} analysis`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRealTimeInsights();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(loadRealTimeInsights, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'high': return <TrendingUp className="h-4 w-4" />;
      case 'medium': return <Clock className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Manufacturing Intelligence</h2>
          {lastUpdated && (
            <Badge variant="outline" className="text-xs">
              Updated {new Date(lastUpdated).toLocaleTimeString()}
            </Badge>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={loadRealTimeInsights} 
            disabled={isLoading}
            size="sm"
            variant="outline"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Insights</p>
                <p className="text-2xl font-bold">{summary.totalInsights || 0}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Critical Alerts</p>
                <p className="text-2xl font-bold text-red-500">{summary.criticalAlerts || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold text-orange-500">{summary.highPriority || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Actionable Items</p>
                <p className="text-2xl font-bold text-blue-500">{summary.actionableItems || 0}</p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="insights">Real-Time Insights</TabsTrigger>
          <TabsTrigger value="analytics">Analysis Tools</TabsTrigger>
          <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Manufacturing Intelligence Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {insights.length === 0 ? (
                  <div className="text-center py-8">
                    <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No Insights Available</h3>
                    <p className="text-muted-foreground">
                      Run analysis to generate manufacturing intelligence insights.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {insights.map((insight, index) => (
                      <Card key={index} className="border-l-4 border-l-primary">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {getPriorityIcon(insight.priority)}
                                <h4 className="font-medium">{insight.title}</h4>
                                <Badge 
                                  variant="outline" 
                                  className={`text-white ${getPriorityColor(insight.priority)}`}
                                >
                                  {insight.priority}
                                </Badge>
                                {insight.actionable && (
                                  <Badge variant="secondary">Actionable</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {insight.message}
                              </p>
                              <p className="text-sm font-medium text-primary">
                                💡 {insight.recommendation}
                              </p>
                            </div>
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

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Inventory Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Analyze inventory levels, turnover rates, and optimization opportunities.
                </p>
                <Button 
                  onClick={() => runSpecificAnalysis('inventory')}
                  disabled={isLoading}
                  className="w-full"
                >
                  Run Inventory Analysis
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Factory className="h-5 w-5" />
                  Process Optimization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Identify bottlenecks, efficiency issues, and process improvements.
                </p>
                <Button 
                  onClick={() => runSpecificAnalysis('process')}
                  disabled={isLoading}
                  className="w-full"
                >
                  Analyze Processes
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Predictive Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate demand forecasts and predictive maintenance insights.
                </p>
                <Button 
                  onClick={() => runSpecificAnalysis('predictive')}
                  disabled={isLoading}
                  className="w-full"
                >
                  Generate Forecasts
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysisResults.inventory && (
                  <div>
                    <h4 className="font-medium mb-2">Inventory Intelligence</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>Total Items: {analysisResults.inventory.inventory_intelligence?.total_items || 'N/A'}</div>
                      <div>Low Stock: {analysisResults.inventory.inventory_intelligence?.low_stock_items || 'N/A'}</div>
                      <div>Zero Stock: {analysisResults.inventory.inventory_intelligence?.zero_stock_items || 'N/A'}</div>
                      <div>High Value: {analysisResults.inventory.inventory_intelligence?.high_value_items || 'N/A'}</div>
                    </div>
                  </div>
                )}

                {analysisResults.process && (
                  <div>
                    <h4 className="font-medium mb-2">Process Performance</h4>
                    <div className="space-y-2">
                      {analysisResults.process.stage_statistics?.map((stage: any, index: number) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span>{stage.stage}</span>
                          <div className="flex items-center gap-2">
                            <span>{stage.unique_orders} orders</span>
                            <Progress value={stage.efficiency_score} className="w-20" />
                            <span>{stage.efficiency_score?.toFixed(0)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysisResults.predictive && (
                  <div>
                    <h4 className="font-medium mb-2">Predictive Insights</h4>
                    <p className="text-sm text-muted-foreground">
                      Demand forecasting and predictive maintenance recommendations available.
                    </p>
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