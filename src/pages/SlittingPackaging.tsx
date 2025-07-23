
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors, Package, Gauge, CheckCircle2, AlertTriangle, Play, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useManufacturingOrders } from "@/hooks/useManufacturingOrders";
import { useProcessParameters, useProcessQualityAlerts } from "@/hooks/useProcessIntelligence";
import { ProcessIntelligencePanel } from "@/components/manufacturing/ProcessIntelligencePanel";
import { ProcessMaterialFlow } from "@/components/manufacturing/ProcessMaterialFlow";
import { useArtworkByUiorn } from "@/hooks/useArtworkData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function SlittingPackaging() {
  const [slittingLogs, setSlittingLogs] = useState([]);
  const [packagingLogs, setPackagingLogs] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [slittingParams, setSlittingParams] = useState({
    speed: '',
    bladeAngle: '',
    tension: '',
    widthTolerance: ''
  });
  
  const { toast } = useToast();
  
  const { data: orders = [] } = useManufacturingOrders({
    status: "IN_PROGRESS"
  });
  
  // Fixed hook calls - now properly passing process parameters
  const { data: slittingParameters = [] } = useProcessParameters("SLITTING");
  const { data: slittingAlerts = [] } = useProcessQualityAlerts("SLITTING");

  // Use the enhanced artwork hook for selected order
  const { data: artworkData, isLoading: isLoadingArtwork } = useArtworkByUiorn(
    selectedOrder?.uiorn || ""
  );

  useEffect(() => {
    // Fetch slitting and packaging process logs
    const fetchProcessData = async () => {
      const { data: slitLogs } = await supabase
        .from('process_logs_se')
        .select('*')
        .eq('stage', 'SLITTING')
        .order('captured_at', { ascending: false })
        .limit(15);
        
      const { data: packLogs } = await supabase
        .from('process_logs_se')
        .select('*')
        .eq('stage', 'PACKAGING')
        .order('captured_at', { ascending: false })
        .limit(15);
        
      setSlittingLogs(slitLogs || []);
      setPackagingLogs(packLogs || []);
    };

    fetchProcessData();
  }, []);

  const handleStartProcess = async () => {
    if (!selectedOrder) {
      toast({
        title: "No Order Selected",
        description: "Please select an order before starting the process.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Log process initiation
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('process_logs_se')
        .insert({
          uiorn: selectedOrder.uiorn,
          stage: 'SLITTING',
          metric: 'process_start',
          txt_value: 'Process initiated from UI',
          captured_by: user?.id
        });

      if (error) throw error;

      toast({
        title: "Process Started",
        description: `Slitting process initiated for order ${selectedOrder.uiorn}`,
      });

      setTimeout(() => {
        setIsProcessing(false);
      }, 2000);

    } catch (error) {
      console.error('Error starting process:', error);
      toast({
        title: "Error",
        description: "Failed to start process. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const applyRecommendations = (parameters: any[]) => {
    const paramMap = new Map(parameters.map(p => [p.metric, p.recommended_value]));
    
    setSlittingParams({
      speed: paramMap.get('line_speed_mpm')?.toFixed(0) || '',
      bladeAngle: '45',
      tension: paramMap.get('winding_tension')?.toFixed(1) || '',
      widthTolerance: '±0.5'
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Scissors className="w-8 h-8 text-primary" />
            Slitting & Packaging
          </h1>
          <p className="text-muted-foreground">Precision cutting and final packaging operations</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleStartProcess}
            disabled={isProcessing || !selectedOrder}
          >
            <Play className="h-4 w-4 mr-2" />
            {isProcessing ? "Starting..." : "Start Process"}
          </Button>
          <Button variant="outline" disabled={!selectedOrder}>
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </Button>
        </div>
      </div>

      {/* Process Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Slitting Records</CardTitle>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{slittingLogs.length}</div>
            <p className="text-xs text-muted-foreground">AI-analyzed records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Packaging Records</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{packagingLogs.length}</div>
            <p className="text-xs text-muted-foreground">AI-analyzed records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{slittingAlerts.length}</div>
            <p className="text-xs text-muted-foreground">AI-detected issues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Process Parameters</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{slittingParameters.length}</div>
            <p className="text-xs text-muted-foreground">Optimized settings</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="material-flow" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="material-flow">Material Flow</TabsTrigger>
          <TabsTrigger value="slitting">Slitting Control</TabsTrigger>
          <TabsTrigger value="packaging">Packaging Control</TabsTrigger>
          <TabsTrigger value="intelligence">AI Intelligence</TabsTrigger>
          <TabsTrigger value="monitoring">Active Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="material-flow" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Available Orders</CardTitle>
                <CardDescription>Select an order to start material flow tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {orders.map((order) => (
                    <Card 
                      key={order.uiorn} 
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedOrder?.uiorn === order.uiorn ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{order.customer_name}</h4>
                          <p className="text-sm text-muted-foreground">{order.product_description}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">{order.uiorn}</Badge>
                            <Badge variant={order.priority_level === 'URGENT' ? 'destructive' : 'default'}>
                              {order.priority_level}
                            </Badge>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant={selectedOrder?.uiorn === order.uiorn ? "default" : "outline"}
                        >
                          {selectedOrder?.uiorn === order.uiorn ? "Selected" : "Select"}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Process Material Flow</CardTitle>
                <CardDescription>Integrated material flow tracking for Slitting & Packaging</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedOrder ? (
                  <ProcessMaterialFlow
                    uiorn={selectedOrder.uiorn}
                    currentProcess="SLITTING"
                    nextProcess="PACKAGING"
                    previousProcess="ADHESIVE_COATING"
                    artworkData={artworkData}
                    onFlowUpdate={(flowData) => {
                      console.log('Material flow updated:', flowData);
                    }}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Select an order to begin material flow tracking
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="slitting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Slitting Parameters</CardTitle>
              <CardDescription>Configure slitting settings for selected order</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Line Speed (m/min)</label>
                    <Input 
                      value={slittingParams.speed}
                      onChange={(e) => setSlittingParams({...slittingParams, speed: e.target.value})}
                      placeholder="150"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Blade Angle (°)</label>
                    <Input 
                      value={slittingParams.bladeAngle}
                      onChange={(e) => setSlittingParams({...slittingParams, bladeAngle: e.target.value})}
                      placeholder="45"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Tension (N/m)</label>
                    <Input 
                      value={slittingParams.tension}
                      onChange={(e) => setSlittingParams({...slittingParams, tension: e.target.value})}
                      placeholder="120"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Width Tolerance</label>
                    <Input 
                      value={slittingParams.widthTolerance}
                      onChange={(e) => setSlittingParams({...slittingParams, widthTolerance: e.target.value})}
                      placeholder="±0.5"
                    />
                  </div>
                </div>
                <Button 
                  className="w-full"
                  onClick={handleStartProcess}
                  disabled={isProcessing || !selectedOrder}
                >
                  {isProcessing ? "Starting Process..." : "Apply Parameters & Start Slitting"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packaging" className="space-y-6">
          {selectedOrder && (
            <ProcessMaterialFlow
              uiorn={selectedOrder.uiorn}
              currentProcess="PACKAGING"
              previousProcess="SLITTING"
              artworkData={artworkData}
              onFlowUpdate={(flowData) => {
                console.log('Packaging material flow updated:', flowData);
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="intelligence">
          <ProcessIntelligencePanel 
            uiorn={selectedOrder?.uiorn || ""}
            currentProcess="SLITTING"
            onApplyRecommendations={applyRecommendations}
          />
        </TabsContent>

        <TabsContent value="monitoring">
          <Card>
            <CardHeader>
              <CardTitle>Active Slitting & Packaging Operations</CardTitle>
              <CardDescription>Real-time monitoring of cutting and packaging processes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.uiorn} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{order.uiorn}</h3>
                        <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                      </div>
                      <Badge variant={order.priority_level === 'URGENT' ? 'destructive' : 'default'}>
                        {order.priority_level}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{order.product_description}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-purple-600 h-2 rounded-full" style={{ width: '80%' }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">80% Complete</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
