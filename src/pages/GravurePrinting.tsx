import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Activity, Thermometer, Droplets, CheckCircle, AlertTriangle, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useManufacturingOrders } from "@/hooks/useManufacturingOrders";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export default function GravurePrinting() {
  const [printingLogs, setPrintingLogs] = useState([]);
  const [activeJobs, setActiveJobs] = useState([]);
  
  const { data: orders = [] } = useManufacturingOrders({
    status: "IN_PROGRESS"
  });

  useEffect(() => {
    // Fetch printing-specific process logs
    const fetchPrintingData = async () => {
      const { data: logs } = await supabase
        .from('process_logs_se')
        .select('*')
        .eq('stage', 'PRINTING')
        .order('captured_at', { ascending: false })
        .limit(20);
        
      setPrintingLogs(logs || []);
    };

    fetchPrintingData();
  }, []);

  // Mock active printing jobs data (would come from actual process tracking)
  const mockActiveJobs = [
    {
      id: 1,
      uiorn: "250718001",
      customer: "ABC Packaging",
      substrate: "BOPP Film",
      colors: ["Cyan", "Magenta", "Yellow", "Black"],
      speed: "120 m/min",
      temperature: "185°C",
      status: "RUNNING",
      progress: 65,
      operator: "Rajesh Kumar"
    },
    {
      id: 2,
      uiorn: "250718003",
      customer: "XYZ Industries",
      substrate: "PET Film",
      colors: ["Blue", "White", "Silver"],
      speed: "95 m/min",
      temperature: "175°C",
      status: "SETUP",
      progress: 15,
      operator: "Suresh Patel"
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Palette className="w-8 h-8 text-primary" />
            Gravure Printing
          </h1>
          <p className="text-muted-foreground">High-quality printing operations and quality control</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Play className="h-4 w-4 mr-2" />
            Start Job
          </Button>
          <Button variant="outline">
            <Pause className="h-4 w-4 mr-2" />
            Pause All
          </Button>
        </div>
      </div>

      {/* Printing Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockActiveJobs.filter(j => j.status === 'RUNNING').length}</div>
            <p className="text-xs text-muted-foreground">
              Currently printing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Process Records</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">543</div>
            <p className="text-xs text-muted-foreground">
              Historical records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Speed</CardTitle>
            <Thermometer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">108</div>
            <p className="text-xs text-muted-foreground">
              m/min current
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active">Active Jobs</TabsTrigger>
          <TabsTrigger value="setup">Job Setup</TabsTrigger>
          <TabsTrigger value="quality">Quality Control</TabsTrigger>
          <TabsTrigger value="history">Process History</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Printing Jobs</CardTitle>
              <CardDescription>
                Real-time monitoring of printing operations
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
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{job.progress}% Complete</p>
                        <p className="text-xs text-muted-foreground">Operator: {job.operator}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Substrate</p>
                        <p className="font-medium">{job.substrate}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Speed</p>
                        <p className="font-medium">{job.speed}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Temperature</p>
                        <p className="font-medium">{job.temperature}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Colors</p>
                        <div className="flex gap-1 mt-1">
                          {job.colors.map((color, index) => (
                            <div 
                              key={index}
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: color.toLowerCase() }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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

        <TabsContent value="setup">
          <Card>
            <CardHeader>
              <CardTitle>Job Setup & Configuration</CardTitle>
              <CardDescription>
                Configure printing parameters and job settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="font-semibold">Printing Parameters</h3>
                  <div className="grid gap-3">
                    <div>
                      <label className="text-sm font-medium">Print Speed (m/min)</label>
                      <Input type="number" placeholder="120" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Drying Temperature (°C)</label>
                      <Input type="number" placeholder="185" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Ink Viscosity (cPs)</label>
                      <Input type="number" placeholder="18" />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-semibold">Quality Settings</h3>
                  <div className="grid gap-3">
                    <div>
                      <label className="text-sm font-medium">Color Tolerance (ΔE)</label>
                      <Input type="number" placeholder="2.5" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Registration Tolerance (mm)</label>
                      <Input type="number" placeholder="0.1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Density Target</label>
                      <Input type="number" placeholder="1.4" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex gap-2">
                <Button>Save Configuration</Button>
                <Button variant="outline">Load Template</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality">
          <Card>
            <CardHeader>
              <CardTitle>Quality Control Dashboard</CardTitle>
              <CardDescription>
                Monitor print quality and defect tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Color Accuracy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">98.5%</div>
                    <p className="text-sm text-muted-foreground">Within tolerance</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Registration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">±0.08mm</div>
                    <p className="text-sm text-muted-foreground">Average deviation</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Defect Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">0.3%</div>
                    <p className="text-sm text-muted-foreground">Below target</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Printing Process History</CardTitle>
              <CardDescription>
                Historical printing records and process logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {printingLogs.slice(0, 10).map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Droplets className="w-5 h-5 text-blue-500" />
                      <div>
                        <h4 className="font-medium">{log.uiorn}</h4>
                        <p className="text-sm text-muted-foreground">
                          {log.metric}: {log.value || log.txt_value}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {log.captured_at && format(new Date(log.captured_at), 'MMM dd, HH:mm')}
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