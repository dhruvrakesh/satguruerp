import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, Gauge, CheckCircle2, AlertTriangle, Play, Settings } from "lucide-react";
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

export default function GravurePrinting() {
  const [processLogs, setProcessLogs] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [printingParams, setPrintingParams] = useState({
    speed: '',
    pressure: '',
    temperature: '',
    inkViscosity: '',
    registration: ''
  });
  
  const { toast } = useToast();
  
  const { data: orders = [] } = useManufacturingOrders({
    status: "IN_PROGRESS"
  });
  
  // Fixed hook calls - now properly passing process parameters
  const { data: printingParameters = [] } = useProcessParameters("GRAVURE_PRINTING");
  const { data: printingAlerts = [] } = useProcessQualityAlerts("GRAVURE_PRINTING");

  // Use the enhanced artwork hook for selected order
  const { data: artworkData, isLoading: isLoadingArtwork } = useArtworkByUiorn(
    selectedOrder?.uiorn || ""
  );

  useEffect(() => {
    // Fetch process logs
    const fetchProcessData = async () => {
      const { data } = await supabase
        .from('process_logs_se')
        .select('*')
        .eq('stage', 'GRAVURE_PRINTING')
        .order('captured_at', { ascending: false })
        .limit(15);
        
      setProcessLogs(data || []);
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
          stage: 'GRAVURE_PRINTING',
          metric: 'process_start',
          txt_value: 'Process initiated from UI',
          captured_by: user?.id
        });

      if (error) throw error;

      toast({
        title: "Process Started",
        description: `Gravure printing process initiated for order ${selectedOrder.uiorn}`,
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
    
    setPrintingParams({
      speed: paramMap.get('line_speed_mpm')?.toFixed(0) || '',
      pressure: paramMap.get('printing_pressure')?.toFixed(1) || '',
      temperature: paramMap.get('drying_temp_c')?.toFixed(0) || '',
      inkViscosity: paramMap.get('ink_viscosity')?.toFixed(1) || '',
      registration: '±0.1'
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Printer className="w-8 h-8 text-primary" />
            Gravure Printing
          </h1>
          <p className="text-muted-foreground">High-quality rotogravure printing operations</p>
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
            <CardTitle className="text-sm font-medium">Printing Records</CardTitle>
            <Printer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processLogs.length}</div>
            <p className="text-xs text-muted-foreground">AI-analyzed records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{printingAlerts.length}</div>
            <p className="text-xs text-muted-foreground">AI-detected issues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Process Parameters</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{printingParameters.length}</div>
            <p className="text-xs text-muted-foreground">Optimized settings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-muted-foreground">Currently processing</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="material-flow" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="material-flow">Material Flow</TabsTrigger>
          <TabsTrigger value="printing">Printing Control</TabsTrigger>
          <TabsTrigger value="artwork">Artwork Intelligence</TabsTrigger>
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
                <CardDescription>Integrated material flow tracking for Gravure Printing</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedOrder ? (
                  <ProcessMaterialFlow
                    uiorn={selectedOrder.uiorn}
                    currentProcess="GRAVURE_PRINTING"
                    nextProcess="LAMINATION"
                    previousProcess="PREPRESS"
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

        <TabsContent value="printing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Printing Parameters</CardTitle>
              <CardDescription>Configure printing settings for selected order</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Line Speed (m/min)</label>
                    <Input 
                      value={printingParams.speed}
                      onChange={(e) => setPrintingParams({...printingParams, speed: e.target.value})}
                      placeholder="150"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Printing Pressure (bar)</label>
                    <Input 
                      value={printingParams.pressure}
                      onChange={(e) => setPrintingParams({...printingParams, pressure: e.target.value})}
                      placeholder="12"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Drying Temperature (°C)</label>
                    <Input 
                      value={printingParams.temperature}
                      onChange={(e) => setPrintingParams({...printingParams, temperature: e.target.value})}
                      placeholder="60"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Ink Viscosity (sec)</label>
                    <Input 
                      value={printingParams.inkViscosity}
                      onChange={(e) => setPrintingParams({...printingParams, inkViscosity: e.target.value})}
                      placeholder="25"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Registration Tolerance</label>
                  <Input 
                    value={printingParams.registration}
                    onChange={(e) => setPrintingParams({...printingParams, registration: e.target.value})}
                    placeholder="±0.1"
                  />
                </div>
                <Button 
                  className="w-full"
                  onClick={handleStartProcess}
                  disabled={isProcessing || !selectedOrder}
                >
                  {isProcessing ? "Starting Process..." : "Apply Parameters & Start Printing"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="artwork" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Artwork Intelligence</CardTitle>
              <CardDescription>View artwork specifications and process parameters</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedOrder ? (
                <ProcessMaterialFlow
                  uiorn={selectedOrder.uiorn}
                  currentProcess="GRAVURE_PRINTING"
                  nextProcess="LAMINATION"
                  previousProcess="PREPRESS"
                  artworkData={artworkData}
                  onFlowUpdate={(flowData) => {
                    console.log('Material flow updated:', flowData);
                  }}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Select an order to view artwork specifications
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intelligence">
          <ProcessIntelligencePanel 
            uiorn={selectedOrder?.uiorn || ""}
            currentProcess="GRAVURE_PRINTING"
            onApplyRecommendations={applyRecommendations}
          />
        </TabsContent>

        <TabsContent value="monitoring">
          <Card>
            <CardHeader>
              <CardTitle>Active Gravure Printing Operations</CardTitle>
              <CardDescription>Real-time monitoring of printing processes</CardDescription>
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
