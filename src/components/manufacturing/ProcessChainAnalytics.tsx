
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Package, 
  DollarSign,
  BarChart3,
  Activity
} from "lucide-react";

interface ProcessChainAnalyticsProps {
  uiorn: string;
  timeRange?: 'today' | 'week' | 'month';
}

interface ProcessData {
  process_stage: string;
  input_quantity: number;
  output_good_quantity: number;
  output_waste_quantity: number;
  output_rework_quantity: number;
  total_input_cost: number;
  waste_cost_impact: number;
  yieldPercentage: number;
  wastePercentage: number;
  costPerKg: number;
}

export function ProcessChainAnalytics({ uiorn, timeRange = 'today' }: ProcessChainAnalyticsProps) {
  const { data: analyticsData, isLoading, error } = useQuery({
    queryKey: ['process-chain-analytics', uiorn, timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_flow_tracking')
        .select('*')
        .eq('uiorn', uiorn)
        .order('recorded_at', { ascending: true });

      if (error) throw error;

      // Process the data to calculate analytics
      const processData: ProcessData[] = [];
      const processMap = new Map<string, any>();

      data.forEach(record => {
        const existing = processMap.get(record.process_stage) || {
          process_stage: record.process_stage,
          input_quantity: 0,
          output_good_quantity: 0,
          output_waste_quantity: 0,
          output_rework_quantity: 0,
          total_input_cost: 0,
          waste_cost_impact: 0
        };

        existing.input_quantity += record.input_quantity || 0;
        existing.output_good_quantity += record.output_good_quantity || 0;
        existing.output_waste_quantity += record.output_waste_quantity || 0;
        existing.output_rework_quantity += record.output_rework_quantity || 0;
        existing.total_input_cost += record.total_input_cost || 0;
        existing.waste_cost_impact += record.waste_cost_impact || 0;

        processMap.set(record.process_stage, existing);
      });

      // Calculate derived metrics
      processMap.forEach((process, key) => {
        const totalOutput = process.output_good_quantity + process.output_waste_quantity + process.output_rework_quantity;
        process.yieldPercentage = process.input_quantity > 0 ? (process.output_good_quantity / process.input_quantity) * 100 : 0;
        process.wastePercentage = process.input_quantity > 0 ? (process.output_waste_quantity / process.input_quantity) * 100 : 0;
        process.costPerKg = process.output_good_quantity > 0 ? process.total_input_cost / process.output_good_quantity : 0;
        
        processData.push(process);
      });

      return processData;
    },
    enabled: !!uiorn,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Calculate overall metrics
  const overallMetrics = analyticsData ? {
    totalInput: analyticsData.reduce((sum, p) => sum + p.input_quantity, 0),
    totalGoodOutput: analyticsData.reduce((sum, p) => sum + p.output_good_quantity, 0),
    totalWaste: analyticsData.reduce((sum, p) => sum + p.output_waste_quantity, 0),
    totalCost: analyticsData.reduce((sum, p) => sum + p.total_input_cost, 0),
    totalWasteCost: analyticsData.reduce((sum, p) => sum + p.waste_cost_impact, 0),
    overallYieldPercentage: 0,
    overallWastePercentage: 0
  } : null;

  if (overallMetrics && overallMetrics.totalInput > 0) {
    overallMetrics.overallYieldPercentage = (overallMetrics.totalGoodOutput / overallMetrics.totalInput) * 100;
    overallMetrics.overallWastePercentage = (overallMetrics.totalWaste / overallMetrics.totalInput) * 100;
  }

  const getYieldPercentageColor = (yieldPercentage: number) => {
    if (yieldPercentage >= 95) return 'text-green-600 bg-green-50 border-green-200';
    if (yieldPercentage >= 90) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (yieldPercentage >= 85) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getYieldPercentageIcon = (yieldPercentage: number) => {
    if (yieldPercentage >= 90) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (yieldPercentage >= 85) return <TrendingUp className="h-4 w-4 text-blue-600" />;
    return <AlertTriangle className="h-4 w-4 text-red-600" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Activity className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading process chain analytics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Error loading analytics: {error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analyticsData || analyticsData.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="h-8 w-8 mx-auto mb-2" />
            <p>No process data available for UIORN {uiorn}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Metrics */}
      {overallMetrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Overall Process Chain Performance - {uiorn}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-xl font-bold text-blue-600">
                  {overallMetrics.overallYieldPercentage.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Overall Yield</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-xl font-bold text-red-600">
                  {overallMetrics.overallWastePercentage.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Overall Waste</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600">
                  ₹{overallMetrics.totalCost.toFixed(0)}
                </div>
                <div className="text-xs text-muted-foreground">Total Cost</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-xl font-bold text-orange-600">
                  ₹{overallMetrics.totalWasteCost.toFixed(0)}
                </div>
                <div className="text-xs text-muted-foreground">Waste Cost</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Process-wise Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Process-wise Performance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsData.map((process, index) => (
              <div key={process.process_stage} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getYieldPercentageIcon(process.yieldPercentage)}
                    <h4 className="font-semibold">{process.process_stage.replace('_', ' ')}</h4>
                  </div>
                  <Badge className={getYieldPercentageColor(process.yieldPercentage)}>
                    {process.yieldPercentage.toFixed(1)}% Yield
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-blue-600">
                      {process.input_quantity.toFixed(1)} KG
                    </div>
                    <div className="text-muted-foreground">Input</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-green-600">
                      {process.output_good_quantity.toFixed(1)} KG
                    </div>
                    <div className="text-muted-foreground">Good Output</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-red-600">
                      {process.output_waste_quantity.toFixed(1)} KG
                    </div>
                    <div className="text-muted-foreground">Waste</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-orange-600">
                      {process.wastePercentage.toFixed(1)}%
                    </div>
                    <div className="text-muted-foreground">Waste %</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-purple-600">
                      ₹{process.costPerKg.toFixed(2)}/KG
                    </div>
                    <div className="text-muted-foreground">Cost/KG</div>
                  </div>
                </div>

                {process.output_rework_quantity > 0 && (
                  <div className="mt-2 p-2 bg-yellow-50 rounded text-sm">
                    <span className="font-medium text-yellow-800">
                      Rework: {process.output_rework_quantity.toFixed(1)} KG
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cost Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Cost Impact Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analyticsData.map((process) => (
              <div key={process.process_stage} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">{process.process_stage.replace('_', ' ')}</div>
                  <div className="text-sm text-muted-foreground">
                    Input Cost: ₹{process.total_input_cost.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-red-600">
                    -₹{process.waste_cost_impact.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">Waste Impact</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
