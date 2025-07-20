
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors, Package, Ruler, Package2, CheckCircle, Truck, Settings, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useManufacturingOrders } from "@/hooks/useManufacturingOrders";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ProcessMaterialFlow } from "@/components/manufacturing/ProcessMaterialFlow";

export default function SlittingPackaging() {
  const [slittingLogs, setSlittingLogs] = useState([]);
  const [dispatchLogs, setDispatchLogs] = useState([]);
  const [activeJobs, setActiveJobs] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  const { data: orders = [] } = useManufacturingOrders({
    status: "IN_PROGRESS"
  });

  useEffect(() => {
    // Fetch slitting and dispatch process logs
    const fetchProcessData = async () => {
      const { data: slitLogs } = await supabase
        .from('process_logs_se')
        .select('*')
        .eq('stage', 'SLITTING')
        .order('captured_at', { ascending: false })
        .limit(15);
        
      const { data: dispLogs } = await supabase
        .from('process_logs_se')
        .select('*')
        .eq('stage', 'DISPATCH')
        .order('captured_at', { ascending: false })
        .limit(15);
        
      setSlittingLogs(slitLogs || []);
      setDispatchLogs(dispLogs || []);
    };

    fetchProcessData();
  }, []);

  // Mock active slitting and packaging jobs
  const mockActiveJobs = [
    {
      id: 1,
      uiorn: "250718005",
      customer: "QuickPack Solutions",
      process: "SLITTING",
      width: "1200mm → 300mm",
      rolls: 4,
      speed: "150 m/min",
      blade_life: "85%",
      status: "RUNNING",
      progress: 75,
      operator: "Deepak Kumar"
    },
    {
      id: 2,
      uiorn: "250718006",
      customer: "FlexiWrap Corp",
      process: "PACKAGING",
      rolls_packed: 12,
      target_rolls: 20,
      boxes: 3,
      weight: "240 kg",
      status: "PACKING",
      progress: 60,
      operator: "Sunita Devi"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'text-green-600 bg-green-50 border-green-200';
      case 'PACKING': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'SETUP': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'COMPLETED': return 'text-purple-600 bg-purple-50 border-purple-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getProcessColor = (process: string) => {
    return process === 'SLITTING' ? 'text-orange-600 bg-orange-50' : 'text-blue-600 bg-blue-50';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Scissors className="w-8 h-8 text-primary" />
            Slitting & Packaging
          </h1>
          <p className="text-muted-foreground">Final processing, cutting to size, and dispatch preparation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Play className="h-4 w-4 mr-2" />
            Start Job
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Setup
          </Button>
        </div>
      </div>

      {/* Process Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockActiveJobs.filter(j => j.status === 'RUNNING' || j.status === 'PACKING').length}</div>
            <p className="text-xs text-muted-foreground">
              Currently processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Slitting Records</CardTitle>
            <Ruler className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{slittingLogs.length}</div>
            <p className="text-xs text-muted-foreground">
              Historical records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispatch Records</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dispatchLogs.length}</div>
            <p className="text-xs text-muted-foreground">
              Historical records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready for Dispatch</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">
              Completed orders
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="material-flow" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="material-flow">Material Flow</TabsTrigger>
          <TabsTrigger value="active">Active Jobs</TabsTrigger>
          <TabsTrigger value="slitting">Slitting Setup</TabsTrigger>
          <TabsTrigger value="packaging">Packaging Setup</TabsTrigger>
          <TabsTrigger value="dispatch">Dispatch Queue</TabsTrigger>
          <TabsTrigger value="history">Process History</TabsTrigger>
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

            <Card>
              <CardHeader>
                <CardTitle>Process Material Flow</CardTitle>
                <CardDescription>
                  Integrated material flow tracking for Slitting & Packaging processes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedOrder ? (
                  <ProcessMaterialFlow
                    uiorn={selectedOrder.uiorn}
                    currentProcess="SLITTING"
                    nextProcess="PACKAGING"
                    previousProcess="ADHESIVE_COATING"
                    onFlowUpdate={(flowData) => {
                      console.log('Slitting material flow updated:', flowData);
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

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Slitting & Packaging Operations</CardTitle>
              <CardDescription>
                Real-time monitoring of final processing operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockActiveJobs.map((job) => (
                  <div key={job.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-semibold">{job.uiorn}</h3>
                          <p className="text-sm text-muted-foreground">{job.customer}</p>
                        </div>
                        <Badge className={getProcessColor(job.process)}>
                          {job.process}
                        </Badge>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{job.progress}% Complete</p>
                        <p className="text-xs text-muted-foreground">Operator: {job.operator}</p>
                      </div>
                    </div>
                    
                    {job.process === 'SLITTING' ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Width Cut</p>
                          <p className="font-medium">{job.width}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Rolls Output</p>
                          <p className="font-medium">{job.rolls} rolls</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Speed</p>
                          <p className="font-medium">{job.speed}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Blade Life</p>
                          <p className="font-medium">{job.blade_life}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Rolls Packed</p>
                          <p className="font-medium">{job.rolls_packed}/{job.target_rolls}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Boxes</p>
                          <p className="font-medium">{job.boxes} completed</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Weight</p>
                          <p className="font-medium">{job.weight}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <p className="font-medium">Packaging</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slitting">
          <Card>
            <CardHeader>
              <CardTitle>Slitting Configuration</CardTitle>
              <CardDescription>Set cutting parameters and roll specifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Parent Roll Width (mm)</label>
                  <Input type="number" placeholder="1200" />
                </div>
                <div>
                  <label className="text-sm font-medium">Cut Width (mm)</label>
                  <Input type="number" placeholder="300" />
                </div>
                <div>
                  <label className="text-sm font-medium">Number of Rolls</label>
                  <Input type="number" placeholder="4" />
                </div>
                <div>
                  <label className="text-sm font-medium">Slitting Speed (m/min)</label>
                  <Input type="number" placeholder="150" />
                </div>
                <div>
                  <label className="text-sm font-medium">Core Size (inches)</label>
                  <Input type="number" placeholder="3" />
                </div>
                {selectedOrder && (
                  <ProcessMaterialFlow
                    uiorn={selectedOrder.uiorn}
                    currentProcess="SLITTING"
                    nextProcess="PACKAGING"
                    previousProcess="ADHESIVE_COATING"
                    onFlowUpdate={(flowData) => {
                      console.log('Slitting setup flow updated:', flowData);
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packaging">
          <Card>
            <CardHeader>
              <CardTitle>Packaging Configuration</CardTitle>
              <CardDescription>Set packaging and labeling requirements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Rolls per Box</label>
                  <Input type="number" placeholder="4" />
                </div>
                <div>
                  <label className="text-sm font-medium">Box Type</label>
                  <Input placeholder="Corrugated" />
                </div>
                <div>
                  <label className="text-sm font-medium">Label Format</label>
                  <Input placeholder="Customer + Specs" />
                </div>
                <div>
                  <label className="text-sm font-medium">Pallet Configuration</label>
                  <Input placeholder="20 boxes per pallet" />
                </div>
                <div>
                  <label className="text-sm font-medium">Special Instructions</label>
                  <Input placeholder="Handle with care" />
                </div>
                {selectedOrder && (
                  <ProcessMaterialFlow
                    uiorn={selectedOrder.uiorn}
                    currentProcess="PACKAGING"
                    nextProcess="DISPATCH"
                    previousProcess="SLITTING"
                    onFlowUpdate={(flowData) => {
                      console.log('Packaging flow updated:', flowData);
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dispatch">
          <Card>
            <CardHeader>
              <CardTitle>Dispatch Queue</CardTitle>
              <CardDescription>
                Orders ready for shipment and delivery tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                    <div className="flex items-center gap-4">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <h3 className="font-semibold">25071800{i}</h3>
                        <p className="text-sm text-muted-foreground">Customer ABC {i}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{20 + i * 5} rolls</p>
                        <p className="text-xs text-muted-foreground">{150 + i * 50} kg total</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="text-green-600 bg-green-50 border-green-200">
                        READY
                      </Badge>
                      <Button size="sm">
                        <Truck className="w-4 h-4 mr-2" />
                        Dispatch
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Slitting History</CardTitle>
                <CardDescription>{slittingLogs.length} records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {slittingLogs.slice(0, 8).map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Scissors className="w-4 h-4 text-orange-500" />
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
                <CardTitle>Dispatch History</CardTitle>
                <CardDescription>{dispatchLogs.length} records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dispatchLogs.slice(0, 8).map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Truck className="w-4 h-4 text-blue-500" />
                        <div>
                          <h4 className="font-medium text-sm">{log.uiorn}</h4>
                          <p className="text-xs text-muted-foreground">
                            {log.metric}: {log.value || log.txt_value}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {log.received_at && format(new Date(log.received_at), 'MMM dd, HH:mm')}
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
