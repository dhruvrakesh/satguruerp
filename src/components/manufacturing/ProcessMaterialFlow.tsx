
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialFlowTracker } from "./MaterialFlowTracker";
import { ProcessTransferTracker } from "./ProcessTransferTracker";
import { RMConsumptionTracker } from "./RMConsumptionTracker";
import { ProcessChainAnalytics } from "./ProcessChainAnalytics";
import { MaterialFlowContinuity } from "./MaterialFlowContinuity";
import { MaterialFlowEndToEndTest } from "./MaterialFlowEndToEndTest";
import { BOMVariancePanel } from "./BOMVariancePanel";
import { OrderProgressTracker } from "./OrderProgressTracker";
import { ProcessIntelligencePanel } from "./ProcessIntelligencePanel";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowRight, 
  Package, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Factory,
  BarChart3,
  Zap,
  TestTube,
  Brain
} from "lucide-react";

interface ProcessMaterialFlowProps {
  uiorn: string;
  currentProcess: string;
  nextProcess?: string;
  previousProcess?: string;
  artworkData?: any;
  onFlowUpdate?: (flowData: any) => void;
}

const PROCESS_CHAIN = [
  { id: 'GRAVURE_PRINTING', name: 'Gravure Printing', color: 'bg-blue-500' },
  { id: 'LAMINATION', name: 'Lamination', color: 'bg-green-500' },
  { id: 'ADHESIVE_COATING', name: 'Adhesive Coating', color: 'bg-yellow-500' },
  { id: 'SLITTING', name: 'Slitting', color: 'bg-purple-500' },
  { id: 'PACKAGING', name: 'Packaging', color: 'bg-red-500' }
];

export function ProcessMaterialFlow({ 
  uiorn, 
  currentProcess, 
  nextProcess, 
  previousProcess, 
  artworkData,
  onFlowUpdate 
}: ProcessMaterialFlowProps) {
  const [materialFlowSummary, setMaterialFlowSummary] = useState<any>(null);
  const [processChainStatus, setProcessChainStatus] = useState<any[]>([]);
  const [receivedMaterials, setReceivedMaterials] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (uiorn) {
      updateProcessChainStatus();
    }
  }, [uiorn, currentProcess]);

  const updateProcessChainStatus = () => {
    const currentIndex = PROCESS_CHAIN.findIndex(p => p.id === currentProcess);
    
    const statusChain = PROCESS_CHAIN.map((process, index) => ({
      ...process,
      status: index < currentIndex ? 'completed' : 
              index === currentIndex ? 'active' : 'pending',
      isAvailable: index <= currentIndex + 1
    }));
    
    setProcessChainStatus(statusChain);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'active': return <Factory className="h-4 w-4 text-blue-600" />;
      case 'pending': return <Package className="h-4 w-4 text-gray-400" />;
      default: return <Package className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      'completed': 'bg-green-100 text-green-800 border-green-200',
      'active': 'bg-blue-100 text-blue-800 border-blue-200',
      'pending': 'bg-gray-100 text-gray-600 border-gray-200'
    };
    return statusStyles[status as keyof typeof statusStyles] || statusStyles.pending;
  };

  const handleMaterialFlowUpdate = (flowData: any) => {
    setMaterialFlowSummary(flowData);
    onFlowUpdate?.(flowData);
    
    toast({
      title: "Material Flow Updated",
      description: `Material flow data recorded for ${currentProcess}`,
    });
  };

  const handleMaterialReceived = (materials: any[]) => {
    setReceivedMaterials(materials);
    toast({
      title: "Materials Received",
      description: `${materials.length} material(s) received from upstream process`,
    });
  };

  const availableProcesses = PROCESS_CHAIN
    .filter(p => p.id !== currentProcess)
    .map(p => p.id);

  return (
    <div className="space-y-6">
      {/* Process Chain Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Production Process Chain - {uiorn}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
            {processChainStatus.map((process, index) => (
              <div key={process.id} className="flex items-center gap-2 min-w-fit">
                <div className={`p-3 rounded-lg border-2 ${
                  process.status === 'active' ? 'border-blue-300 bg-blue-50' :
                  process.status === 'completed' ? 'border-green-300 bg-green-50' :
                  'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(process.status)}
                    <span className="font-medium text-sm">{process.name}</span>
                  </div>
                  <Badge className={`mt-1 ${getStatusBadge(process.status)}`}>
                    {process.status.toUpperCase()}
                  </Badge>
                </div>
                {index < processChainStatus.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
          
          {materialFlowSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  {materialFlowSummary.totalInput || 0} KG
                </div>
                <div className="text-xs text-muted-foreground">Total Input</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">
                  {materialFlowSummary.goodOutput || 0} KG
                </div>
                <div className="text-xs text-muted-foreground">Good Output</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-600">
                  {materialFlowSummary.reworkOutput || 0} KG
                </div>
                <div className="text-xs text-muted-foreground">Rework</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-red-600">
                  {materialFlowSummary.wasteOutput || 0} KG
                </div>
                <div className="text-xs text-muted-foreground">Waste</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Material Flow Tabs */}
      <Tabs defaultValue="continuity" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="continuity">Material Flow</TabsTrigger>
          <TabsTrigger value="tracking">Process Data</TabsTrigger>
          <TabsTrigger value="consumption">RM Consumption</TabsTrigger>
          <TabsTrigger value="transfer">Process Transfer</TabsTrigger>
          <TabsTrigger value="analytics">Chain Analytics</TabsTrigger>
          <TabsTrigger value="intelligence">
            <Brain className="h-4 w-4 mr-1" />
            Intelligence
          </TabsTrigger>
          <TabsTrigger value="testing">System Test</TabsTrigger>
          <TabsTrigger value="bom-analysis">BOM Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="continuity">
          <MaterialFlowContinuity
            uiorn={uiorn}
            currentProcess={currentProcess}
            onMaterialReceived={handleMaterialReceived}
          />
        </TabsContent>

        <TabsContent value="tracking">
          <MaterialFlowTracker
            uiorn={uiorn}
            processStage={currentProcess}
            previousProcessStage={previousProcess}
            onFlowUpdate={handleMaterialFlowUpdate}
          />
        </TabsContent>

        <TabsContent value="consumption">
          <RMConsumptionTracker
            uiorn={uiorn}
            processStage={currentProcess}
            artworkData={artworkData}
            onConsumptionUpdate={(consumption) => {
              toast({
                title: "Raw Material Consumption Updated",
                description: `Consumption data saved for ${consumption.length} materials`,
              });
            }}
          />
        </TabsContent>

        <TabsContent value="transfer">
          <ProcessTransferTracker
            uiorn={uiorn}
            currentProcess={currentProcess}
            availableProcesses={availableProcesses}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <ProcessChainAnalytics 
            uiorn={uiorn}
            timeRange="today"
          />
        </TabsContent>

        <TabsContent value="intelligence">
          <ProcessIntelligencePanel 
            uiorn={uiorn}
            currentProcess={currentProcess}
            onApplyRecommendations={(params) => {
              toast({
                title: "Recommendations Applied",
                description: "Process parameters have been optimized based on AI recommendations",
              });
            }}
          />
        </TabsContent>

        <TabsContent value="testing">
          <MaterialFlowEndToEndTest 
            uiorn={uiorn}
          />
        </TabsContent>

        <TabsContent value="bom-analysis">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BOMVariancePanel uiorn={uiorn} processStage={currentProcess} />
            <OrderProgressTracker uiorn={uiorn} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
