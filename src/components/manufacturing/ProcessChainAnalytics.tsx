
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Factory, 
  ArrowRight,
  Package,
  Zap,
  DollarSign
} from "lucide-react";

interface ProcessChainAnalyticsProps {
  uiorn?: string;
  timeRange?: 'today' | 'week' | 'month';
}

export function ProcessChainAnalytics({ 
  uiorn, 
  timeRange = 'today' 
}: ProcessChainAnalyticsProps) {
  const [processChainData, setProcessChainData] = useState<any[]>([]);
  const [materialFlowSummary, setMaterialFlowSummary] = useState<any>(null);

  // Fetch process chain material flow data
  const { data: materialFlowData, isLoading } = useQuery({
    queryKey: ['process-chain-analytics', uiorn, timeRange],
    queryFn: async () => {
      let query = supabase
        .from('material_flow_tracking')
        .select('*');
      
      if (uiorn) {
        query = query.eq('uiorn', uiorn);
      }
      
      // Add time range filter
      const now = new Date();
      let startDate = new Date();
      
      switch (timeRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      query = query.gte('recorded_at', startDate.toISOString());
      
      const { data, error } = await query.order('recorded_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: true,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch process transfers for flow analysis
  const { data: transferData } = useQuery({
    queryKey: ['process-transfers', uiorn, timeRange],
    queryFn: async () => {
      let query = supabase
        .from('process_transfers')
        .select('*');
      
      if (uiorn) {
        query = query.eq('uiorn', uiorn);
      }
      
      const { data, error } = await query.order('sent_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: true
  });

  useEffect(() => {
    if (materialFlowData) {
      analyzeProcessChain(materialFlowData, transferData || []);
    }
  }, [materialFlowData, transferData]);

  const analyzeProcessChain = (flowData: any[], transfers: any[]) => {
    const processStages = ['GRAVURE_PRINTING', 'LAMINATION', 'ADHESIVE_COATING', 'SLITTING', 'PACKAGING'];
    
    const processAnalysis = processStages.map((stage, index) => {
      const stageData = flowData.filter(item => item.process_stage === stage);
      const totalInput = stageData.reduce((sum, item) => sum + (item.input_quantity || 0), 0);
      const totalOutput = stageData.reduce((sum, item) => sum + (item.output_good_quantity || 0), 0);
      const totalWaste = stageData.reduce((sum, item) => sum + (item.output_waste_quantity || 0), 0);
      const totalRework = stageData.reduce((sum, item) => sum + (item.output_rework_quantity || 0), 0);
      
      const yieldPercentage = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0;
      const wastePercentage = totalInput > 0 ? (totalWaste / totalInput) * 100 : 0;
      
      // Check material availability from previous process
      const previousStage = index > 0 ? processStages[index - 1] : null;
      const availableMaterial = previousStage ? 
        transfers.filter(t => t.from_process === previousStage && t.to_process === stage && t.transfer_status === 'RECEIVED')
          .reduce((sum, t) => sum + (t.quantity_received || 0), 0) : totalInput;
      
      return {
        stage,
        stageName: stage.replace('_', ' '),
        totalInput,
        totalOutput,
        totalWaste,
        totalRework,
        yieldPercentage: Math.round(yieldPercentage * 100) / 100,
        wastePercentage: Math.round(wastePercentage * 100) / 100,
        availableMaterial,
        recordCount: stageData.length,
        status: yieldPercentage > 90 ? 'excellent' : yieldPercentage > 80 ? 'good' : yieldPercentage > 70 ? 'warning' : 'critical',
        bottleneck: wastePercentage > 10 || yieldPercentage < 80,
        lastActivity: stageData[0]?.recorded_at || null
      };
    });
    
    setProcessChainData(processAnalysis);
    
    // Calculate overall summary
    const totalSystemInput = processAnalysis[0]?.totalInput || 0;
    const totalSystemOutput = processAnalysis[processAnalysis.length - 1]?.totalOutput || 0;
    const totalSystemWaste = processAnalysis.reduce((sum, p) => sum + p.totalWaste, 0);
    const overallYieldPercentage = totalSystemInput > 0 ? (totalSystemOutput / totalSystemInput) * 100 : 0;
    
    setMaterialFlowSummary({
      totalInput: totalSystemInput,
      totalOutput: totalSystemOutput,
      totalWaste: totalSystemWaste,
      overallYieldPercentage: Math.round(overallYieldPercentage * 100) / 100,
      processesActive: processAnalysis.filter(p => p.recordCount > 0).length,
      bottleneckStages: processAnalysis.filter(p => p.bottleneck).map(p => p.stageName)
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'good': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Factory className="h-4 w-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Loading process chain analytics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      {materialFlowSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Process Chain Summary {uiorn && `- ${uiorn}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {materialFlowSummary.totalInput.toFixed(1)} KG
                </div>
                <div className="text-sm text-muted-foreground">Total Input</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {materialFlowSummary.totalOutput.toFixed(1)} KG
                </div>
                <div className="text-sm text-muted-foreground">Final Output</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {materialFlowSummary.overallYieldPercentage.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Overall Yield</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {materialFlowSummary.totalWaste.toFixed(1)} KG
                </div>
                <div className="text-sm text-muted-foreground">Total Waste</div>
              </div>
            </div>
            
            {materialFlowSummary.bottleneckStages.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Bottleneck Alert</span>
                </div>
                <div className="text-sm text-yellow-700 mt-1">
                  Performance issues detected in: {materialFlowSummary.bottleneckStages.join(', ')}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Process Chain Flow */}
      <Card>
        <CardHeader>
          <CardTitle>Process Chain Material Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {processChainData.map((process, index) => (
              <div key={process.stage} className="relative">
                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(process.status)}
                    <div>
                      <h4 className="font-medium">{process.stageName}</h4>
                      <div className="text-sm text-muted-foreground">
                        {process.recordCount} records recorded
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="font-medium text-blue-600">
                        {process.totalInput.toFixed(1)} KG
                      </div>
                      <div className="text-muted-foreground">Input</div>
                    </div>
                    <div>
                      <div className="font-medium text-green-600">
                        {process.totalOutput.toFixed(1)} KG
                      </div>
                      <div className="text-muted-foreground">Output</div>
                    </div>
                    <div>
                      <div className="font-medium text-orange-600">
                        {process.yieldPercentage.toFixed(1)}%
                      </div>
                      <div className="text-muted-foreground">Yield</div>
                    </div>
                    <div>
                      <div className="font-medium text-red-600">
                        {process.totalWaste.toFixed(1)} KG
                      </div>
                      <div className="text-muted-foreground">Waste</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={process.yieldPercentage} 
                      className="w-20" 
                    />
                    <Badge className={getStatusColor(process.status)}>
                      {process.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                
                {index < processChainData.length - 1 && (
                  <div className="flex justify-center my-2">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Real-time Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Real-time Process Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800">
                <Factory className="h-4 w-4" />
                <span className="font-medium">Active Processes</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 mt-2">
                {materialFlowSummary?.processesActive || 0}
              </div>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Efficiency Score</span>
              </div>
              <div className="text-2xl font-bold text-green-600 mt-2">
                {materialFlowSummary?.overallYieldPercentage?.toFixed(1) || 0}%
              </div>
            </div>
            
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-2 text-orange-800">
                <DollarSign className="h-4 w-4" />
                <span className="font-medium">Cost Impact</span>
              </div>
              <div className="text-2xl font-bold text-orange-600 mt-2">
                ₹{((materialFlowSummary?.totalWaste || 0) * 150).toFixed(0)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
