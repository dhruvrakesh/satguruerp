import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, Thermometer, Gauge, Beaker, CheckCircle2, AlertTriangle, Play, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useManufacturingOrders } from "@/hooks/useManufacturingOrders";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export default function LaminationCoating() {
  const [laminationLogs, setLaminationLogs] = useState([]);
  const [coatingLogs, setCoatingLogs] = useState([]);
  const [activeProcesses, setActiveProcesses] = useState([]);
  
  const { data: orders = [] } = useManufacturingOrders({
    status: "IN_PROGRESS"
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
            <div className="text-2xl font-bold">180</div>
            <p className="text-xs text-muted-foreground">
              Historical records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coating Records</CardTitle>
            <Beaker className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">40</div>
            <p className="text-xs text-muted-foreground">
              Historical records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">
              Needs attention
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active">Active Processes</TabsTrigger>
          <TabsTrigger value="parameters">Process Parameters</TabsTrigger>
          <TabsTrigger value="quality">Quality Control</TabsTrigger>
          <TabsTrigger value="history">Process History</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
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

        <TabsContent value="parameters">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Lamination Parameters</CardTitle>
                <CardDescription>Configure substrate bonding settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Lamination Speed (m/min)</label>
                    <Input type="number" placeholder="85" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Temperature (°C)</label>
                    <Input type="number" placeholder="145" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Pressure (N/cm)</label>
                    <Input type="number" placeholder="25" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Adhesive Type</label>
                    <Input placeholder="Polyurethane" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Solvent Mix Ratio</label>
                    <Input placeholder="60:40" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Coating Parameters</CardTitle>
                <CardDescription>Configure coating application settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Coating Speed (m/min)</label>
                    <Input type="number" placeholder="120" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Drying Temperature (°C)</label>
                    <Input type="number" placeholder="165" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Coat Weight (gsm)</label>
                    <Input type="number" placeholder="3.5" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Coating Material</label>
                    <Input placeholder="Acrylic" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Viscosity (cPs)</label>
                    <Input type="number" placeholder="45" />
                  </div>
                </div>
              </CardContent>
            </Card>
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