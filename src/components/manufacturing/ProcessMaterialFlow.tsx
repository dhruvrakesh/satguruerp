
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
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowRight, 
  Package, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Factory,
  BarChart3,
  Zap
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
    
    // Show success notification
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="continuity">Material Flow</TabsTrigger>
          <TabsTrigger value="tracking">Process Data</TabsTrigger>
          <TabsTrigger value="consumption">RM Consumption</TabsTrigger>
          <TabsTrigger value="transfer">Process Transfer</TabsTrigger>
          <TabsTrigger value="analytics">Chain Analytics</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
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
          <ProcessChainIntelligence 
            uiorn={uiorn}
            currentProcess={currentProcess}
            processChain={processChainStatus}
            receivedMaterials={receivedMaterials}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Enhanced Process Chain Intelligence Component
function ProcessChainIntelligence({ 
  uiorn, 
  currentProcess, 
  processChain,
  receivedMaterials = []
}: { 
  uiorn: string; 
  currentProcess: string; 
  processChain: any[];
  receivedMaterials?: any[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Process Chain Intelligence & Optimization
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Material Flow Status */}
          {receivedMaterials.length > 0 && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 text-green-800 mb-2">
                <Zap className="h-4 w-4" />
                <span className="font-medium">Active Material Flow</span>
              </div>
              <div className="text-sm text-green-700">
                {receivedMaterials.length} material batch(es) received and ready for processing in {currentProcess}
              </div>
              <div className="mt-2 space-y-1">
                {receivedMaterials.slice(0, 3).map((material, index) => (
                  <div key={index} className="text-xs text-green-600">
                    • {material.material_type}: {material.quantity_sent?.toFixed(1)} KG (Grade {material.quality_grade})
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Process Chain Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">85.5%</div>
                    <div className="text-sm text-muted-foreground">Overall Yield</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">12.8%</div>
                    <div className="text-sm text-muted-foreground">Total Waste</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* AI-Powered Recommendations */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
            <h4 className="font-semibold text-blue-900 mb-2">🚀 AI-Powered Recommendations</h4>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• Material flow continuity is now active - {receivedMaterials.length} upstream materials available</li>
              <li>• Optimize material transfer timing between {currentProcess} and next process</li>
              <li>• Reduce setup waste by 15% through predictive parameter adjustment</li>
              <li>• Implement real-time quality monitoring to prevent downstream issues</li>
              <li>• Schedule preventive maintenance based on material flow patterns</li>
            </ul>
          </div>

          {/* Process Coverage Status */}
          <div className="text-center text-muted-foreground">
            <p>Complete process chain intelligence available with material flow continuity active.</p>
            <p className="text-sm mt-2">
              Current Coverage: {processChain.filter(p => p.status !== 'pending').length}/{processChain.length} processes
              {receivedMaterials.length > 0 && " • Material Flow: Active"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
