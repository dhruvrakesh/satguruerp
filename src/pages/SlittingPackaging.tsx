
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors, Package2, Gauge, CheckCircle2, AlertTriangle, Play, Settings, Brain } from "lucide-react";
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

export default function SlittingPackaging() {
  const [processLogs, setProcessLogs] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [slittingParams, setSlittingParams] = useState({
    slitWidth: '',
    slitCount: '',
    coreSize: '',
    tension: '',
    speed: ''
  });
  
  const { data: orders = [] } = useManufacturingOrders({
    status: "IN_PROGRESS"
  });
  
  const { data: slittingParameters = [] } = useProcessParameters("SLITTING");
  const { data: slittingAlerts = [] } = useProcessQualityAlerts("SLITTING");

  // Use the enhanced artwork hook for selected order
  const { data: artworkData, isLoading: isLoadingArtwork } = useArtworkByUiorn(
    selectedOrder?.uiorn || ""
  );

  useEffect(() => {
    // Fetch slitting process logs
    const fetchProcessData = async () => {
      const { data: logs } = await supabase
        .from('process_logs_se')
        .select('*')
        .eq('stage', 'SLITTING')
        .order('captured_at', { ascending: false })
        .limit(15);
        
      setProcessLogs(logs || []);
    };

    fetchProcessData();
  }, []);

  // Mock active processes data
  const mockActiveProcesses = [
    {
      id: 1,
      uiorn: "250718001",
      customer: "ABC Packaging Ltd",
      substrate: "Laminated Film",
      slitWidth: "250mm",
      slitCount: 4,
      coreSize: "76mm",
      tension: "150N",
      speed: "300 m/min",
      status: "RUNNING",
      progress: 65,
      operator: "Ramesh Patel"
    },
    {
      id: 2,
      uiorn: "250718003",
      customer: "XYZ Foods Pvt Ltd",
      substrate: "Coated Film",
      slitWidth: "200mm",
      slitCount: 6,
      coreSize: "76mm",
      tension: "120N",
      speed: "250 m/min",
      status: "SETUP",
      progress: 15,
      operator: "Prakash Singh"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'text-green-600 bg-green-50 border-green-200';
      case 'SETUP': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'PAUSED': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'MAINTENANCE': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const applyRecommendations = (parameters: any[]) => {
    const paramMap = new Map(parameters.map(p => [p.metric, p.recommended_value]));
    
    setSlittingParams({
      slitWidth: paramMap.get('slit_width_mm')?.toFixed(0) || '',
      slitCount: paramMap.get('slit_count')?.toFixed(0) || '',
      coreSize: paramMap.get('core_size_mm')?.toFixed(0) || '',
      tension: paramMap.get('tension_n')?.toFixed(0) || '',
      speed: paramMap.get('line_speed_mpm')?.toFixed(0) || ''
    });
  };

  const handleParametersApplied = (parameters: any) => {
    setSlittingParams({
      slitWidth: parameters.slit_width_mm?.toString() || '',
      slitCount: parameters.slit_count?.toString() || '',
      coreSize: parameters.core_size_mm?.toString() || '76',
      tension: parameters.tension_n?.toString() || '',
      speed: parameters.line_speed_mpm?.toString() || ''
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
          <p className="text-muted-foreground">Precision slitting and final packaging with integrated material flow</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Play className="h-4 w-4 mr-2" />
            Start Slitting
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Machine Setup
          </Button>
        </div>
      </div>

      {/* Process Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Slitting Jobs</CardTitle>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockActiveProcesses.filter(p => p.status === 'RUNNING').length}</div>
            <p className="text-xs text-muted-foreground">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Material Flow</CardTitle>
            <Package2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Active</div>
            <p className="text-xs text-muted-foreground">
              Continuous tracking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Slitting Precision</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">±0.1mm</div>
            <p className="text-xs text-muted-foreground">
              Width tolerance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{slittingAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              AI-detected issues
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="material-flow" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="material-flow">Material Flow</TabsTrigger>
          <TabsTrigger value="slitting">Slitting Control</TabsTrigger>
          <TabsTrigger value="packaging">Packaging</TabsTrigger>
          <TabsTrigger value="monitoring">Real-time Monitor</TabsTrigger>
          <TabsTrigger value="intelligence">AI Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="material-flow" className="space-y-6">
          {selectedOrder ? (
            <ProcessMaterialFlow
              uiorn={selectedOrder.uiorn}
              currentProcess="SLITTING"
              previousProcess="ADHESIVE_COATING"
              artworkData={artworkData}
              onFlowUpdate={(flowData) => {
                console.log('Material flow updated:', flowData);
              }}
            />
          ) : (
            <Card>
              <CardContent className="text-center p-8">
                <Package2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select Order for Material Flow</h3>
                <p className="text-muted-foreground mb-4">
                  Choose an order below to track material flow through slitting and packaging
                </p>
                <div className="grid gap-3 max-w-md mx-auto">
                  {orders.slice(0, 3).map((order) => (
                    <Button
                      key={order.uiorn}
                      variant="outline"
                      className="justify-start"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="text-left">
                        <div className="font-medium">{order.uiorn}</div>
                        <div className="text-sm text-muted-foreground">{order.customer_name}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="slitting" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Available Orders</CardTitle>
                <CardDescription>Select an order to start slitting process</CardDescription>
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
                          <h4 className="font-medium">
                            {selectedOrder?.uiorn === order.uiorn && artworkData?.customer_name ? 
                              artworkData.customer_name : order.customer_name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {order.product_description}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">{order.uiorn}</Badge>
                            <Badge 
                              variant={order.priority_level === 'URGENT' ? 'destructive' : 'default'}
                            >
                              {order.priority_level}
                            </Badge>
                            {selectedOrder?.uiorn === order.uiorn && isLoadingArtwork && (
                              <Badge variant="secondary">Loading artwork...</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant={selectedOrder?.uiorn === order.uiorn ? "default" : "outline"}
                          >
                            {selectedOrder?.uiorn === order.uiorn ? "Selected" : "Select"}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Slitting Parameters</CardTitle>
                <CardDescription>Configure slitting parameters for precision cutting</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Slit Width (mm)</label>
                      <Input 
                        value={slittingParams.slitWidth}
                        onChange={(e) => setSlittingParams({...slittingParams, slitWidth: e.target.value})}
                        placeholder="250"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Number of Slits</label>
                      <Input 
                        value={slittingParams.slitCount}
                        onChange={(e) => setSlittingParams({...slittingParams, slitCount: e.target.value})}
                        placeholder="4"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Core Size (mm)</label>
                      <Input 
                        value={slittingParams.coreSize}
                        onChange={(e) => setSlittingParams({...slittingParams, coreSize: e.target.value})}
                        placeholder="76"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Tension (N)</label>
                      <Input 
                        value={slittingParams.tension}
                        onChange={(e) => setSlittingParams({...slittingParams, tension: e.target.value})}
                        placeholder="150"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Line Speed (m/min)</label>
                    <Input 
                      value={slittingParams.speed}
                      onChange={(e) => setSlittingParams({...slittingParams, speed: e.target.value})}
                      placeholder="300"
                    />
                  </div>
                  <Button className="w-full">Apply Parameters & Start Slitting</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="packaging" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Packaging Operations</CardTitle>
              <CardDescription>Final packaging and quality inspection</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center p-8 text-muted-foreground">
                <Package2 className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Packaging Module</h3>
                <p>Packaging operations will be integrated here with quality checkpoints and final inspection.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring">
          <Card>
            <CardHeader>
              <CardTitle>Active Slitting Operations</CardTitle>
              <CardDescription>
                Real-time monitoring of slitting machines
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockActiveProcesses.map((process) => (
                  <div key={process.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-semibold">{process.uiorn}</h3>
                          <p className="text-sm text-muted-foreground">{process.customer}</p>
                        </div>
                        <Badge className={getStatusColor(process.status)}>
                          {process.status}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{process.progress}% Complete</p>
                        <p className="text-xs text-muted-foreground">Operator: {process.operator}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Substrate</p>
                        <p className="font-medium">{process.substrate}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Slit Width</p>
                        <p className="font-medium">{process.slitWidth}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Slits</p>
                        <p className="font-medium">{process.slitCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Core Size</p>
                        <p className="font-medium">{process.coreSize}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tension</p>
                        <p className="font-medium">{process.tension}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Speed</p>
                        <p className="font-medium">{process.speed}</p>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${process.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intelligence">
          <ProcessIntelligencePanel 
            stage="SLITTING"
            onApplyRecommendations={applyRecommendations}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
