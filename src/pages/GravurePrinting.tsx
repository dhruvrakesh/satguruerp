import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Droplets, Gauge, Thermometer, CheckCircle2, AlertTriangle, Play, Settings, Brain, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useManufacturingOrders } from "@/hooks/useManufacturingOrders";
import { useProcessParameters, useProcessQualityAlerts } from "@/hooks/useProcessIntelligence";
import { ProcessIntelligencePanel } from "@/components/manufacturing/ProcessIntelligencePanel";
import { ArtworkProcessDisplay } from "@/components/manufacturing/ArtworkProcessDisplay";
import { ViscosityTables } from "@/components/manufacturing/ViscosityTables";
import { ProcessMaterialFlow } from "@/components/manufacturing/ProcessMaterialFlow";
import { FlexiblePackagingDashboard } from "@/components/manufacturing/FlexiblePackagingDashboard";
import { useArtworkByUiorn } from "@/hooks/useArtworkData";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

// Utility functions defined before usage
const extractColorCount = (colorString: string): number => {
  if (!colorString) return 4;
  const match = colorString.match(/(\d+)/);
  return match ? parseInt(match[1]) : 4;
};

const generateColorNames = (count: number): string[] => {
  const baseColors = ['Cyan', 'Magenta', 'Yellow', 'Black', 'Spot Color 1', 'Spot Color 2', 'Spot Color 3', 'Spot Color 4'];
  return baseColors.slice(0, count);
};

export default function GravurePrinting() {
  const [printingLogs, setPrintingLogs] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [printingParams, setPrintingParams] = useState({
    speed: '',
    temperature: '',
    pressure: '',
    viscosity: '',
    solventRatio: ''
  });
  
  const { data: orders = [] } = useManufacturingOrders({
    status: "IN_PROGRESS"
  });
  
  const { data: printingParameters = [] } = useProcessParameters("GRAVURE_PRINTING");
  const { data: printingAlerts = [] } = useProcessQualityAlerts("GRAVURE_PRINTING");

  // Use the enhanced artwork hook for selected order
  const { data: artworkData, isLoading: isLoadingArtwork } = useArtworkByUiorn(
    selectedOrder?.uiorn || ""
  );

  useEffect(() => {
    // Fetch printing process logs
    const fetchProcessData = async () => {
      const { data: printLogs } = await supabase
        .from('process_logs_se')
        .select('*')
        .eq('stage', 'GRAVURE_PRINTING')
        .order('captured_at', { ascending: false })
        .limit(15);
        
      setPrintingLogs(printLogs || []);
    };

    fetchProcessData();
  }, []);

  // Mock active processes data
  const mockActiveProcesses = [
    {
      id: 1,
      uiorn: "250718001",
      customer: "ABC Packaging Ltd",
      substrate: "BOPP Film",
      colors: extractColorCount(artworkData?.no_of_colours || "4COL"),
      speed: "150 m/min",
      temperature: "45°C",
      viscosity: "18 sec",
      status: "RUNNING",
      progress: 75,
      operator: "Rajesh Kumar"
    },
    {
      id: 2,
      uiorn: "250718003",
      customer: "XYZ Foods Pvt Ltd",
      substrate: "PET Film",
      colors: 6,
      speed: "120 m/min",
      temperature: "50°C",
      viscosity: "20 sec",
      status: "SETUP",
      progress: 25,
      operator: "Suresh Sharma"
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
    
    setPrintingParams({
      speed: paramMap.get('line_speed_mpm')?.toFixed(0) || '',
      temperature: paramMap.get('drying_temp_c')?.toFixed(0) || '',
      pressure: '2.5',
      viscosity: paramMap.get('ink_viscosity_sec')?.toFixed(0) || '',
      solventRatio: '70:30'
    });
  };

  // Handle parameter application from artwork
  const handleParametersApplied = (parameters: any) => {
    setPrintingParams({
      speed: parameters.line_speed_mpm?.toString() || '',
      temperature: parameters.drying_temp_c?.toString() || '',
      pressure: parameters.impression_pressure?.toString() || '2.5',
      viscosity: parameters.ink_viscosity_sec?.toString() || '',
      solventRatio: parameters.solvent_ratio || '70:30'
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Palette className="w-8 h-8 text-primary" />
            Gravure Printing - Flexible Packaging
          </h1>
          <p className="text-muted-foreground">High-quality rotogravure printing for soap wrappers, stiffeners, laminates, and packaging materials</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Play className="h-4 w-4 mr-2" />
            Start Print Run
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Press Setup
          </Button>
        </div>
      </div>

      {/* Enhanced Process Metrics for Flexible Packaging */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Print Jobs</CardTitle>
            <Palette className="h-4 w-4 text-muted-foreground" />
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
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Active</div>
            <p className="text-xs text-muted-foreground">
              Real-time tracking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Color Accuracy</CardTitle>
            <Droplets className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">98.5%</div>
            <p className="text-xs text-muted-foreground">
              Delta E compliance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Substrate Yield</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">91.2%</div>
            <p className="text-xs text-muted-foreground">
              Material efficiency
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{printingAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              AI-detected issues
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="flexible-packaging" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="flexible-packaging">Flexible Packaging</TabsTrigger>
          <TabsTrigger value="material-flow">Material Flow</TabsTrigger>
          <TabsTrigger value="printing">Print Control</TabsTrigger>
          <TabsTrigger value="colors">Color Management</TabsTrigger>
          <TabsTrigger value="artwork">Artwork Intelligence</TabsTrigger>
          <TabsTrigger value="monitoring">Real-time Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="flexible-packaging" className="space-y-6">
          {selectedOrder ? (
            <FlexiblePackagingDashboard
              uiorn={selectedOrder.uiorn}
              orderData={{
                ...selectedOrder,
                product_type: 'SOAP_WRAPPER', // Default to soap wrapper
                substrate_type: artworkData?.artwork ? `${artworkData.artwork.dimensions} Film` : 'BOPP Film'
              }}
            />
          ) : (
            <Card>
              <CardContent className="text-center p-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select Order for Flexible Packaging Production</h3>
                <p className="text-muted-foreground mb-4">
                  Choose an order below to start the comprehensive flexible packaging workflow
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

        <TabsContent value="material-flow" className="space-y-6">
          {selectedOrder ? (
            <ProcessMaterialFlow
              uiorn={selectedOrder.uiorn}
              currentProcess="GRAVURE_PRINTING"
              nextProcess="LAMINATION"
              artworkData={artworkData}
              onFlowUpdate={(flowData) => {
                console.log('Material flow updated:', flowData);
              }}
            />
          ) : (
            <Card>
              <CardContent className="text-center p-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select Order for Material Flow</h3>
                <p className="text-muted-foreground mb-4">
                  Choose an order below to track material flow through the production process
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

        <TabsContent value="printing" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Available Orders</CardTitle>
                <CardDescription>Select an order to start printing process</CardDescription>
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
                <CardTitle>Print Parameters</CardTitle>
                <CardDescription>Configure printing parameters for selected order</CardDescription>
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
                      <label className="text-sm font-medium">Drying Temp (°C)</label>
                      <Input 
                        value={printingParams.temperature}
                        onChange={(e) => setPrintingParams({...printingParams, temperature: e.target.value})}
                        placeholder="45"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Impression Pressure</label>
                      <Input 
                        value={printingParams.pressure}
                        onChange={(e) => setPrintingParams({...printingParams, pressure: e.target.value})}
                        placeholder="2.5 bar"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Ink Viscosity (sec)</label>
                      <Input 
                        value={printingParams.viscosity}
                        onChange={(e) => setPrintingParams({...printingParams, viscosity: e.target.value})}
                        placeholder="18"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Solvent Ratio</label>
                    <Input 
                      value={printingParams.solventRatio}
                      onChange={(e) => setPrintingParams({...printingParams, solventRatio: e.target.value})}
                      placeholder="70:30"
                    />
                  </div>
                  <Button className="w-full">Apply Parameters & Start Print</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="colors" className="space-y-6">
          <ViscosityTables
            uiorn={selectedOrder?.uiorn || ""}
            colorCount={selectedOrder && artworkData?.no_of_colours ? 
              extractColorCount(artworkData.no_of_colours) : 4}
            artworkData={artworkData}
            onParametersApplied={handleParametersApplied}
          />
        </TabsContent>

        <TabsContent value="artwork" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Selected Order Artwork
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedOrder ? (
                    <ArtworkProcessDisplay
                      uiorn={selectedOrder.uiorn}
                      itemCode={selectedOrder.product_description}
                      artworkData={artworkData?.artwork}
                      processType="printing"
                    />
                  ) : (
                    <div className="text-center p-8 text-muted-foreground">
                      Select an order to view artwork specifications
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Smart Parameter Loading
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {artworkData?.artwork ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-800 mb-2">Auto-Configured Parameters</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="font-medium">Colors:</span>
                            <div className="text-blue-700">{artworkData.no_of_colours}</div>
                          </div>
                          <div>
                            <span className="font-medium">Substrate:</span>
                            <div className="text-blue-700">{artworkData.artwork.dimensions || "N/A"}</div>
                          </div>
                          <div>
                            <span className="font-medium">Customer:</span>
                            <div className="text-blue-700">{artworkData.customer_name || "N/A"}</div>
                          </div>
                          <div>
                            <span className="font-medium">Item Code:</span>
                            <div className="text-blue-700">{artworkData.item_code}</div>
                          </div>
                        </div>
                      </div>
                      
                      <Button className="w-full">
                        Apply Artwork Parameters to Press
                      </Button>
                    </div>
                  ) : isLoadingArtwork ? (
                    <div className="text-center p-4 text-muted-foreground">
                      Loading artwork parameters...
                    </div>
                  ) : (
                    <div className="text-center p-4 text-muted-foreground">
                      Artwork parameters will appear here when order is selected
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="monitoring">
          <Card>
            <CardHeader>
              <CardTitle>Active Printing Operations</CardTitle>
              <CardDescription>
                Real-time monitoring of gravure printing presses for flexible packaging
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
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Substrate</p>
                        <p className="font-medium">{process.substrate}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Colors</p>
                        <p className="font-medium">{process.colors}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Speed</p>
                        <p className="font-medium">{process.speed}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Temperature</p>
                        <p className="font-medium">{process.temperature}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Viscosity</p>
                        <p className="font-medium">{process.viscosity}</p>
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
      </Tabs>
    </div>
  );
}
