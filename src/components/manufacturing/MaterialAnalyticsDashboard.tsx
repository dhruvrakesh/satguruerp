import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMaterialCostAnalysis } from "@/hooks/useMaterialCostAnalysis";
import { useOrderSelection } from "@/hooks/useOrderSelection";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart
} from "lucide-react";

interface MaterialAnalyticsDashboardProps {
  selectedUiorn?: string;
  onOrderSelect?: (uiorn: string) => void;
}

export function MaterialAnalyticsDashboard({ 
  selectedUiorn, 
  onOrderSelect 
}: MaterialAnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");
  
  const { 
    costSummary, 
    processEfficiency, 
    totalCostImpact, 
    isLoading,
    calculateProcessROI,
    getYieldTrend
  } = useMaterialCostAnalysis(selectedUiorn);

  const { availableOrders, searchOrders } = useOrderSelection();

  const getEfficiencyColor = (yield_pct: number) => {
    if (yield_pct >= 95) return 'text-green-600 bg-green-50';
    if (yield_pct >= 85) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <BarChart3 className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="text-muted-foreground">Loading material analytics...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Input Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalCostImpact.total_input_cost)}
            </div>
            <p className="text-xs text-muted-foreground">
              Material investment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Waste Cost Impact</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalCostImpact.total_waste_cost)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalCostImpact.total_input_cost > 0 ? 
                `${((totalCostImpact.total_waste_cost / totalCostImpact.total_input_cost) * 100).toFixed(1)}% of input` : 
                'No data'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Yield</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getEfficiencyColor(totalCostImpact.overall_yield).split(' ')[0]}`}>
              {totalCostImpact.overall_yield.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Production efficiency
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Material Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalCostImpact.total_input_cost - totalCostImpact.total_waste_cost)}
            </div>
            <p className="text-xs text-muted-foreground">
              Value after waste
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Process Overview</TabsTrigger>
          <TabsTrigger value="efficiency">Efficiency Analysis</TabsTrigger>
          <TabsTrigger value="costs">Cost Breakdown</TabsTrigger>
          <TabsTrigger value="trends">Trends & Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Process-wise Material Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {costSummary.map((process, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{process.process_stage}</h4>
                        <p className="text-sm text-muted-foreground">
                          Yield: {process.yield_percentage.toFixed(1)}% • 
                          ROI: {calculateProcessROI(process.process_stage).toFixed(1)}%
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(getYieldTrend(process.process_stage))}
                        <Badge className={getEfficiencyColor(process.yield_percentage)}>
                          {process.yield_percentage >= 95 ? 'Excellent' : 
                           process.yield_percentage >= 85 ? 'Good' : 'Needs Attention'}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm font-medium text-blue-600">
                          {formatCurrency(process.total_input_cost)}
                        </div>
                        <div className="text-xs text-muted-foreground">Input Cost</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-red-600">
                          {formatCurrency(process.total_waste_cost)}
                        </div>
                        <div className="text-xs text-muted-foreground">Waste Cost</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-green-600">
                          {formatCurrency(process.net_material_value)}
                        </div>
                        <div className="text-xs text-muted-foreground">Net Value</div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <Progress value={process.yield_percentage} className="h-2" />
                    </div>
                  </div>
                ))}
                
                {costSummary.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {selectedUiorn ? 
                      `No material flow data found for order ${selectedUiorn}` :
                      'Select an order to view process-wise material flow'
                    }
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="efficiency" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Process Efficiency Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {processEfficiency.map((process, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{process.process_stage}</h4>
                        <p className="text-sm text-muted-foreground">
                          {process.total_orders} orders analyzed
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(process.efficiency_trend)}
                        <Badge variant={process.efficiency_trend === 'improving' ? 'default' : 
                                       process.efficiency_trend === 'declining' ? 'destructive' : 'secondary'}>
                          {process.efficiency_trend}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-lg font-semibold">
                          {process.avg_yield.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Average Yield</div>
                        <Progress value={process.avg_yield} className="h-2 mt-1" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-red-600">
                          {formatCurrency(process.avg_waste_cost)}
                        </div>
                        <div className="text-sm text-muted-foreground">Avg Waste Cost</div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {processEfficiency.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No efficiency data available. Start tracking material flow to see analytics.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cost Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {costSummary.map((process, index) => {
                    const percentage = totalCostImpact.total_input_cost > 0 ? 
                      (process.total_input_cost / totalCostImpact.total_input_cost) * 100 : 0;
                    
                    return (
                      <div key={index}>
                        <div className="flex justify-between text-sm">
                          <span>{process.process_stage}</span>
                          <span>{formatCurrency(process.total_input_cost)} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Waste Impact Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {costSummary.map((process, index) => {
                    const wastePercentage = process.total_input_cost > 0 ? 
                      (process.total_waste_cost / process.total_input_cost) * 100 : 0;
                    
                    return (
                      <div key={index}>
                        <div className="flex justify-between text-sm">
                          <span>{process.process_stage}</span>
                          <span className="text-red-600">
                            {formatCurrency(process.total_waste_cost)} ({wastePercentage.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress value={wastePercentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {processEfficiency.filter(p => p.efficiency_trend === 'improving').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Improving Processes</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {processEfficiency.filter(p => p.efficiency_trend === 'declining').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Declining Processes</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {processEfficiency.filter(p => p.efficiency_trend === 'stable').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Stable Processes</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Recommendations</h4>
                  {processEfficiency.filter(p => p.avg_yield < 90).map((process, index) => (
                    <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium">{process.process_stage}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Yield below 90% ({process.avg_yield.toFixed(1)}%). 
                        Consider process optimization or equipment maintenance.
                      </p>
                    </div>
                  ))}
                  
                  {processEfficiency.filter(p => p.efficiency_trend === 'improving').map((process, index) => (
                    <div key={index} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{process.process_stage}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Showing improvement trend. Current practices should be documented and replicated.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}