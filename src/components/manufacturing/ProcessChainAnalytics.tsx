import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useProcessIntelligence } from "@/hooks/useProcessIntelligence";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  ArrowRight,
  BarChart3,
  Target,
  Zap
} from "lucide-react";

interface ProcessChainAnalyticsProps {
  uiorn: string;
  timeRange?: string;
}

const PROCESS_SEQUENCE = [
  'GRAVURE_PRINTING',
  'LAMINATION', 
  'ADHESIVE_COATING',
  'SLITTING',
  'PACKAGING'
];

export function ProcessChainAnalytics({ uiorn }: ProcessChainAnalyticsProps) {
  const {
    useEndToEndYield,
    useBottleneckAnalysis,
  } = useProcessIntelligence();

  const { data: yieldData, isLoading: isLoadingYield } = useEndToEndYield(uiorn);
  const { data: bottleneckData } = useBottleneckAnalysis(uiorn);

  const getYieldTrend = (yieldPercentage: number) => {
    if (yieldPercentage >= 95) return { icon: TrendingUp, color: 'text-green-600', label: 'Excellent' };
    if (yieldPercentage >= 85) return { icon: TrendingUp, color: 'text-yellow-600', label: 'Good' };
    return { icon: TrendingDown, color: 'text-red-600', label: 'Needs Improvement' };
  };

  const getBottleneckSeverity = (score: number) => {
    if (score >= 70) return { color: 'bg-red-100 text-red-800 border-red-200', label: 'Critical' };
    if (score >= 40) return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Moderate' };
    return { color: 'bg-green-100 text-green-800 border-green-200', label: 'Minor' };
  };

  if (isLoadingYield) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Analyzing process chain...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Process Chain Overview */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <BarChart3 className="h-5 w-5" />
            Process Chain Analytics - {uiorn}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {yieldData ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-white rounded-lg border">
                <div className="text-3xl font-bold text-primary mb-1">
                  {yieldData.overall_yield_percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Overall Yield</div>
                <div className="flex items-center justify-center mt-1">
                  {(() => {
                    const trend = getYieldTrend(yieldData.overall_yield_percentage);
                    const Icon = trend.icon;
                    return (
                      <div className={`flex items-center gap-1 ${trend.color}`}>
                        <Icon className="h-3 w-3" />
                        <span className="text-xs">{trend.label}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
              
              <div className="text-center p-4 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {yieldData.total_input.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Total Input (KG)</div>
                <div className="text-xs text-blue-600 mt-1">Material Consumed</div>
              </div>
              
              <div className="text-center p-4 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-red-600 mb-1">
                  {yieldData.waste_percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Waste Ratio</div>
                <div className="text-xs text-red-600 mt-1">
                  {yieldData.total_waste.toFixed(1)} KG Lost
                </div>
              </div>
              
              <div className="text-center p-4 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-orange-600 mb-1">
                  {yieldData.rework_percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Rework Ratio</div>
                <div className="text-xs text-orange-600 mt-1">
                  {yieldData.total_rework.toFixed(1)} KG Rework
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No analytics data available for this order
            </div>
          )}
        </CardContent>
      </Card>

      {/* Process Flow Visualization */}
      {yieldData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Process Flow Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {yieldData.process_yields.map((processYield: any, index: number) => {
                const trend = getYieldTrend(processYield.yield_percentage);
                const Icon = trend.icon;
                const isLast = index === yieldData.process_yields.length - 1;
                
                return (
                  <div key={processYield.process} className="relative">
                    <div className="flex items-center gap-4 p-4 border rounded-lg">
                      {/* Process Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="font-medium text-lg">
                            {processYield.process.replace(/_/g, ' ')}
                          </div>
                          <Badge className={getBottleneckSeverity(
                            bottleneckData?.bottlenecks.find(b => b.process === processYield.process)?.bottleneck_score || 0
                          ).color}>
                            {getBottleneckSeverity(
                              bottleneckData?.bottlenecks.find(b => b.process === processYield.process)?.bottleneck_score || 0
                            ).label}
                          </Badge>
                        </div>
                        
                        {/* Yield Progress */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-muted-foreground">Yield Performance</span>
                            <div className="flex items-center gap-1">
                              <Icon className={`h-3 w-3 ${trend.color}`} />
                              <span className={`text-sm font-medium ${trend.color}`}>
                                {processYield.yield_percentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <Progress value={processYield.yield_percentage} className="h-2" />
                        </div>
                        
                        {/* Material Flow */}
                        <div className="grid grid-cols-4 gap-3 text-sm">
                          <div className="text-center">
                            <div className="font-medium text-blue-600">
                              {processYield.input_quantity.toFixed(1)}
                            </div>
                            <div className="text-xs text-muted-foreground">Input KG</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-green-600">
                              {processYield.output_quantity.toFixed(1)}
                            </div>
                            <div className="text-xs text-muted-foreground">Output KG</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-red-600">
                              {processYield.waste_quantity.toFixed(1)}
                            </div>
                            <div className="text-xs text-muted-foreground">Waste KG</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-orange-600">
                              {processYield.rework_quantity.toFixed(1)}
                            </div>
                            <div className="text-xs text-muted-foreground">Rework KG</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Flow Arrow */}
                    {!isLast && (
                      <div className="flex justify-center my-2">
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottleneck Analysis */}
      {bottleneckData && bottleneckData.bottlenecks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Identified Bottlenecks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bottleneckData.bottlenecks.slice(0, 3).map((bottleneck, index) => {
                const severity = getBottleneckSeverity(bottleneck.bottleneck_score);
                return (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="font-medium text-lg">
                          {bottleneck.process.replace(/_/g, ' ')}
                        </div>
                        <Badge className={severity.color}>
                          {severity.label} (Score: {bottleneck.bottleneck_score.toFixed(1)})
                        </Badge>
                      </div>
                      <Button size="sm" variant="outline">
                        <Zap className="h-3 w-3 mr-1" />
                        Optimize
                      </Button>
                    </div>
                    
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Recommendation:</strong> {bottleneck.recommendation}
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                      <div className="text-center">
                        <div className="font-medium">
                          {bottleneck.avg_yield.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Avg Yield</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">
                          {bottleneck.avg_processing_hours.toFixed(1)}h
                        </div>
                        <div className="text-xs text-muted-foreground">Avg Time</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-red-600">
                          {(bottleneck.total_waste + bottleneck.total_rework).toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">Total Loss</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Summary */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <CheckCircle className="h-5 w-5" />
            Process Chain Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {yieldData ? (100 - yieldData.waste_percentage - yieldData.rework_percentage).toFixed(1) : 'N/A'}%
              </div>
              <div className="text-sm text-green-700">First Pass Yield</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {bottleneckData ? Math.max(0, 5 - bottleneckData.bottlenecks.length) : 'N/A'}
              </div>
              <div className="text-sm text-green-700">Processes Running Smoothly</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {yieldData ? (yieldData.overall_yield_percentage >= 90 ? '✓' : '⚠') : 'N/A'}
              </div>
              <div className="text-sm text-green-700">Target Achievement</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}