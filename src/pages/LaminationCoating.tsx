import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, Thermometer, Gauge, Beaker, CheckCircle2, AlertTriangle, Play, Settings, Brain, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useManufacturingOrders } from "@/hooks/useManufacturingOrders";
import { useProcessParameters, useProcessQualityAlerts } from "@/hooks/useProcessIntelligence";
import { ProcessIntelligencePanel } from "@/components/manufacturing/ProcessIntelligencePanel";
import { ArtworkProcessDisplay } from "@/components/manufacturing/ArtworkProcessDisplay";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

export default function LaminationCoating() {
  const [laminationLogs, setLaminationLogs] = useState([]);
  const [coatingLogs, setCoatingLogs] = useState([]);
  const [activeProcesses, setActiveProcesses] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [laminationParams, setLaminationParams] = useState({
    speed: '',
    temperature: '',
    pressure: '',
    adhesive: '',
    solventRatio: ''
  });
  const [coatingParams, setCoatingParams] = useState({
    speed: '',
    temperature: '',
    coatWeight: '',
    material: '',
    viscosity: ''
  });
  
  const { data: orders = [] } = useManufacturingOrders({
    status: "IN_PROGRESS"
  });
  
  const { data: laminationParameters = [] } = useProcessParameters("LAMINATION");
  const { data: coatingParameters = [] } = useProcessParameters("ADHESIVE_COATING");
  const { data: laminationAlerts = [] } = useProcessQualityAlerts("LAMINATION");
  const { data: coatingAlerts = [] } = useProcessQualityAlerts("ADHESIVE_COATING");

  // Fetch artwork data for selected order
  const { data: artworkData = null } = useQuery({
    queryKey: ["artwork-for-order", selectedOrder?.product_description],
    queryFn: async () => {
      if (!selectedOrder?.product_description) return null;
      
      const { data, error } = await supabase
        .from("_artworks_revised_staging")
        .select("item_code, customer_name, item_name, dimensions, no_of_colours, file_hyperlink, ups, circum")
        .or(`item_name.ilike.%${selectedOrder.product_description}%,customer_name.ilike.%${selectedOrder.customer_name}%`)
        .limit(1)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: !!selectedOrder
  });

  useEffect(() => {
    // Fetch lamination and coating process logs
    const fetchProcessData = async () => {
      const { data: lamLogs } = await supabase
        .from('process_logs_se')
        .select('*')
        .eq('stage', 'LAMINATION')
        .order('captured_at', { ascending: false })
        .limit(15);
        
      const { data: coatLogs } = await supabase
        .from('process_logs_se')
        .select('*')
        .eq('stage', 'ADHESIVE_COATING')
        .order('captured_at', { ascending: false })
        .limit(15);
        
      setLaminationLogs(lamLogs || []);
      setCoatingLogs(coatLogs || []);
    };

    fetchProcessData();
  }, []);

  // Mock active processes data
  const mockActiveProcesses = [
    {
      id: 1,
      uiorn: "250718002",
      customer: "FlexiPack Ltd",
      process: "LAMINATION",
      substrate: "BOPP + PET",
      temperature: "145°C",
      speed: "85 m/min",
      adhesive: "Polyurethane",
      status: "RUNNING",
      progress: 45,
      operator: "Amit Singh"
    },
    {
      id: 2,
      uiorn: "250718004",
      customer: "SafePack Industries",
      process: "COATING",
      substrate: "LDPE Film",
      temperature: "165°C",
      speed: "120 m/min",
      coating: "Acrylic",
      status: "SETUP",
      progress: 20,
      operator: "Priya Sharma"
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

  const getProcessColor = (process: string) => {
    return process === 'LAMINATION' ? 'text-blue-600 bg-blue-50' : 'text-purple-600 bg-purple-50';
  };

  const applyRecommendations = (parameters: any[], type: 'lamination' | 'coating') => {
    const paramMap = new Map(parameters.map(p => [p.metric, p.recommended_value]));
    
    if (type === 'lamination') {
      setLaminationParams({
        speed: paramMap.get('line_speed_mpm')?.toFixed(0) || '',
        temperature: '145', // Default fallback
        pressure: '25',
        adhesive: paramMap.get('adhesive_gsm')?.toFixed(1) || '',
        solventRatio: '60:40'
      });
    } else {
      setCoatingParams({
        speed: paramMap.get('line_speed_mpm')?.toFixed(0) || '',
        temperature: paramMap.get('drying_temp_c')?.toFixed(0) || '',
        coatWeight: paramMap.get('coating_weight_gsm')?.toFixed(1) || '',
        material: 'Acrylic',
        viscosity: '45'
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Layers className="w-8 h-8 text-primary" />
            Lamination & Coating
          </h1>
          <p className="text-muted-foreground">Substrate bonding, adhesive coating, and barrier enhancement</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Play className="h-4 w-4 mr-2" />
            Start Process
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </Button>
        </div>
      </div>

      {/* Process Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Processes</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Lamination Records</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{laminationLogs.length}</div>
            <p className="text-xs text-muted-foreground">
              AI-analyzed records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coating Records</CardTitle>
            <Beaker className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coatingLogs.length}</div>
            <p className="text-xs text-muted-foreground">
              AI-analyzed records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{laminationAlerts.length + coatingAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              AI-detected issues
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="lamination" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="lamination">Lamination Control</TabsTrigger>
          <TabsTrigger value="coating">Coating Control</TabsTrigger>
          <TabsTrigger value="artwork">Artwork Intelligence</TabsTrigger>
          <TabsTrigger value="monitoring">Real-time Monitoring</TabsTrigger>
          <TabsTrigger value="intelligence">AI Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="lamination" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Available Orders</CardTitle>
                <CardDescription>Select an order to start lamination process</CardDescription>
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
          </div>
        </TabsContent>

        <TabsContent value="coating" className="space-y-6">
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
                      artworkData={artworkData}
                      processType="lamination"
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
                  {artworkData ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 rounded-lg">
                        <h4 className="font-medium text-green-800 mb-2">Auto-Configured Parameters</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="font-medium">Substrate Width:</span>
                            <div className="text-green-700">{artworkData.dimensions}</div>
                          </div>
                          <div>
                            <span className="font-medium">Color Layers:</span>
                            <div className="text-green-700">{artworkData.no_of_colours}</div>
                          </div>
                          <div>
                            <span className="font-medium">Roll Setup:</span>
                            <div className="text-green-700">{artworkData.circum}mm circum</div>
                          </div>
                          <div>
                            <span className="font-medium">Units/Sheet:</span>
                            <div className="text-green-700">{artworkData.ups}</div>
                          </div>
                        </div>
                      </div>
                      
                      <Button className="w-full">
                        Apply Artwork Parameters to Process
                      </Button>
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
              <CardTitle>Active Lamination & Coating Operations</CardTitle>
              <CardDescription>
                Real-time monitoring of substrate processing
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
                        <Badge className={getProcessColor(process.process)}>
                          {process.process}
                        </Badge>
                        <Badge className={getStatusColor(process.status)}>
                          {process.status}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{process.progress}% Complete</p>
                        <p className="text-xs text-muted-foreground">Operator: {process.operator}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Substrate</p>
                        <p className="font-medium">{process.substrate}</p>
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
                        <p className="text-muted-foreground">
                          {process.process === 'LAMINATION' ? 'Adhesive' : 'Coating'}
                        </p>
                        <p className="font-medium">
                          {process.adhesive || process.coating}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
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
          <div className="grid gap-6 lg:grid-cols-2">
            <ProcessIntelligencePanel 
              stage="LAMINATION"
              onApplyRecommendations={(params) => applyRecommendations(params, 'lamination')}
            />
            <ProcessIntelligencePanel 
              stage="ADHESIVE_COATING"
              onApplyRecommendations={(params) => applyRecommendations(params, 'coating')}
            />
          </div>
        </TabsContent>

        <TabsContent value="quality">
          <Card>
            <CardHeader>
              <CardTitle>Quality Control Metrics</CardTitle>
              <CardDescription>
                Monitor adhesion strength, coating uniformity, and barrier properties
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Gauge className="w-5 h-5" />
                      Adhesion Strength
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">2.8 N/15mm</div>
                    <p className="text-sm text-muted-foreground">Target: &gt;2.5</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Thermometer className="w-5 h-5" />
                      Coating Uniformity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">±0.2 gsm</div>
                    <p className="text-sm text-muted-foreground">Variance</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Beaker className="w-5 h-5" />
                      Barrier Properties
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">0.8 g/m²/day</div>
                    <p className="text-sm text-muted-foreground">Water vapor transmission</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Lamination History</CardTitle>
                <CardDescription>{laminationLogs.length} records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {laminationLogs.slice(0, 8).map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Layers className="w-4 h-4 text-blue-500" />
                        <div>
                          <h4 className="font-medium text-sm">{log.uiorn}</h4>
                          <p className="text-xs text-muted-foreground">
                            {log.metric}: {log.value || log.txt_value}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {log.captured_at && format(new Date(log.captured_at), 'MMM dd, HH:mm')}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Coating History</CardTitle>
                <CardDescription>{coatingLogs.length} records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {coatingLogs.slice(0, 8).map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Beaker className="w-4 h-4 text-purple-500" />
                        <div>
                          <h4 className="font-medium text-sm">{log.uiorn}</h4>
                          <p className="text-xs text-muted-foreground">
                            {log.metric}: {log.value || log.txt_value}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {log.captured_at && format(new Date(log.captured_at), 'MMM dd, HH:mm')}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}