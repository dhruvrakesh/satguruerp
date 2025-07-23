import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProcessIntelligence } from "@/hooks/useProcessIntelligence";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Target,
  BarChart3,
  RefreshCw,
  Zap,
  Route
} from "lucide-react";

interface ProcessIntelligencePanelProps {
  uiorn: string;
  currentProcess: string;
  stage?: string;
  onApplyRecommendations?: (params: any) => void;
}

const PROCESS_SEQUENCE = [
  'GRAVURE_PRINTING',
  'LAMINATION', 
  'ADHESIVE_COATING',
  'SLITTING',
  'PACKAGING'
];

export function ProcessIntelligencePanel({ uiorn, currentProcess }: ProcessIntelligencePanelProps) {
  const { toast } = useToast();
  
  const {
    useProcessReadiness,
    useEndToEndYield,
    useBottleneckAnalysis,
    routeReworkMutation,
  } = useProcessIntelligence();

  // Process readiness for all processes
  const readinessQueries = PROCESS_SEQUENCE.map(process => ({
    process,
    ...useProcessReadiness(uiorn, process)
  }));

  // Yield analysis for current order
  const { data: yieldData, isLoading: isLoadingYield } = useEndToEndYield(uiorn);

  // Bottleneck analysis (global and order-specific)
  const { data: globalBottlenecks } = useBottleneckAnalysis();
  const { data: orderBottlenecks } = useBottleneckAnalysis(uiorn);

  const getReadinessColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getReadinessIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (score >= 70) return <Clock className="h-4 w-4 text-yellow-600" />;
    return <AlertTriangle className="h-4 w-4 text-red-600" />;
  };

  const handleAutoRouteRework = async (processStage: string) => {
    try {
      await routeReworkMutation.mutateAsync({
        uiorn,
        materialType: 'REWORK_MATERIAL',
        qualityGrade: 'REWORK',
        reworkQuantity: 10, // This would come from actual rework data
        currentProcess: processStage
      });
      
      toast({
        title: "Rework Routed",
        description: `Rework material from ${processStage} has been automatically routed for reprocessing.`,
      });
    } catch (error) {
      toast({
        title: "Routing Failed",
        description: "Failed to route rework material. Please try manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Brain className="h-5 w-5" />
            Process Intelligence Dashboard
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Advanced analytics and automated process optimization for UIORN: {uiorn}
          </p>
        </CardHeader>
      </Card>

      <Tabs defaultValue="readiness" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="readiness">Process Readiness</TabsTrigger>
          <TabsTrigger value="yield">Yield Analysis</TabsTrigger>
          <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
          <TabsTrigger value="automation">Smart Routing</TabsTrigger>
        </TabsList>

        <TabsContent value="readiness" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Real-Time Process Readiness Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {readinessQueries.map(({ process, data, isLoading, isError }) => (
                  <div key={process} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {data && getReadinessIcon(data.readiness_score)}
                        <div>
                          <div className="font-medium">{process.replace('_', ' ')}</div>
                          <div className="text-sm text-muted-foreground">
                            {process === currentProcess && (
                              <Badge variant="secondary" className="text-xs">Current</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {isLoading ? (
                          <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
                        ) : data ? (
                          <div className={`text-2xl font-bold ${getReadinessColor(data.readiness_score)}`}>
                            {data.readiness_score}%
                          </div>
                        ) : (
                          <div className="text-gray-400">N/A</div>
                        )}
                      </div>
                    </div>
                    
                    {data && (
                      <>
                        <Progress value={data.readiness_score} className="mb-3" />
                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div className="text-center">
                            <div className="font-medium text-blue-600">{data.available_materials}</div>
                            <div className="text-xs text-muted-foreground">Materials</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-green-600">{data.total_quantity.toFixed(1)} KG</div>
                            <div className="text-xs text-muted-foreground">Quantity</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-orange-600">{data.quality_issues}</div>
                            <div className="text-xs text-muted-foreground">Issues</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-purple-600">{data.pending_transfers}</div>
                            <div className="text-xs text-muted-foreground">Pending</div>
                          </div>
                        </div>
                        
                        {data.readiness_score < 70 && (
                          <Alert className="mt-3">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              Process not ready. Check material availability and resolve pending transfers.
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    )}
                    
                    {isError && (
                      <Alert variant="destructive" className="mt-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Failed to assess readiness for {process}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="yield" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                End-to-End Yield Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingYield ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">Calculating yield metrics...</p>
                </div>
              ) : yieldData ? (
                <div className="space-y-6">
                  {/* Overall Yield Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="text-3xl font-bold text-green-600">
                        {yieldData.overall_yield_percentage.toFixed(1)}%
                      </div>
                      <div className="text-sm text-green-700">Overall Yield</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-2xl font-bold text-blue-600">
                        {yieldData.total_input.toFixed(1)} KG
                      </div>
                      <div className="text-sm text-blue-700">Total Input</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="text-2xl font-bold text-red-600">
                        {yieldData.waste_percentage.toFixed(1)}%
                      </div>
                      <div className="text-sm text-red-700">Waste</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="text-2xl font-bold text-orange-600">
                        {yieldData.rework_percentage.toFixed(1)}%
                      </div>
                      <div className="text-sm text-orange-700">Rework</div>
                    </div>
                  </div>

                  <Separator />

                  {/* Process-Specific Yields */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Process-Specific Yields</h4>
                    {yieldData.process_yields.map((processYield: any, index: number) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{processYield.process.replace('_', ' ')}</div>
                          <div className="text-xl font-bold text-primary">
                            {processYield.yield_percentage}%
                          </div>
                        </div>
                        <Progress value={processYield.yield_percentage} className="mb-2" />
                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div className="text-center">
                            <div className="font-medium">{processYield.input_quantity}</div>
                            <div className="text-xs text-muted-foreground">Input</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-green-600">{processYield.output_quantity}</div>
                            <div className="text-xs text-muted-foreground">Output</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-red-600">{processYield.waste_quantity}</div>
                            <div className="text-xs text-muted-foreground">Waste</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-orange-600">{processYield.rework_quantity}</div>
                            <div className="text-xs text-muted-foreground">Rework</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No yield data available for this order
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bottlenecks" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Order-Specific Bottlenecks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Order Bottlenecks
                </CardTitle>
                <p className="text-sm text-muted-foreground">Issues specific to {uiorn}</p>
              </CardHeader>
              <CardContent>
                {orderBottlenecks?.bottlenecks.length ? (
                  <div className="space-y-3">
                    {orderBottlenecks.bottlenecks.slice(0, 3).map((bottleneck, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{bottleneck.process.replace('_', ' ')}</div>
                          <Badge variant={bottleneck.bottleneck_score > 50 ? "destructive" : "secondary"}>
                            Score: {bottleneck.bottleneck_score}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {bottleneck.recommendation}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>Yield: {bottleneck.avg_yield.toFixed(1)}%</div>
                          <div>Time: {bottleneck.avg_processing_hours.toFixed(1)}h</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No bottlenecks detected for this order
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Global Bottlenecks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Global Bottlenecks
                </CardTitle>
                <p className="text-sm text-muted-foreground">System-wide performance issues</p>
              </CardHeader>
              <CardContent>
                {globalBottlenecks?.bottlenecks.length ? (
                  <div className="space-y-3">
                    {globalBottlenecks.bottlenecks.slice(0, 3).map((bottleneck, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{bottleneck.process.replace('_', ' ')}</div>
                          <Badge variant={bottleneck.bottleneck_score > 50 ? "destructive" : "secondary"}>
                            Score: {bottleneck.bottleneck_score}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {bottleneck.recommendation}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>Avg Yield: {bottleneck.avg_yield.toFixed(1)}%</div>
                          <div>Avg Time: {bottleneck.avg_processing_hours.toFixed(1)}h</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No system-wide bottlenecks detected
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                Smart Material Routing & Automation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Auto-Rework Routing */}
                <div className="p-4 border-2 border-orange-200 rounded-lg bg-orange-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-orange-800">Automatic Rework Routing</h4>
                      <p className="text-sm text-orange-700">
                        Intelligently route rework materials back to appropriate processes
                      </p>
                    </div>
                    <Button
                      onClick={() => handleAutoRouteRework(currentProcess)}
                      disabled={routeReworkMutation.isPending}
                      variant="outline"
                      className="border-orange-300 text-orange-700 hover:bg-orange-100"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {routeReworkMutation.isPending ? 'Routing...' : 'Auto-Route Rework'}
                    </Button>
                  </div>
                </div>

                {/* Material Type Validation */}
                <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <h4 className="font-medium text-blue-800">Material Type Validation</h4>
                  </div>
                  <p className="text-sm text-blue-700 mb-3">
                    Automatic validation ensures only compatible materials flow between processes
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      GRAVURE → LAMINATION: PRINTED_MATERIAL
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      LAMINATION → COATING: LAMINATED_MATERIAL
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      COATING → SLITTING: COATED_MATERIAL
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      SLITTING → PACKAGING: SLIT_MATERIAL
                    </div>
                  </div>
                </div>

                {/* Quality Gate Enforcement */}
                <div className="p-4 border-2 border-green-200 rounded-lg bg-green-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-5 w-5 text-green-600" />
                    <h4 className="font-medium text-green-800">Quality Gate Enforcement</h4>
                  </div>
                  <p className="text-sm text-green-700 mb-3">
                    Only GRADE_A and GRADE_B materials proceed automatically. REWORK materials are auto-routed back.
                  </p>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800 border-green-200">✓ GRADE_A: Auto-proceed</Badge>
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">✓ GRADE_B: Auto-proceed</Badge>
                    <Badge className="bg-orange-100 text-orange-800 border-orange-200">↺ REWORK: Auto-route back</Badge>
                    <Badge className="bg-red-100 text-red-800 border-red-200">✗ WASTE: Stop</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}