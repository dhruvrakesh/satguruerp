
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Activity, Thermometer, Droplets, CheckCircle, AlertTriangle, Play, Pause, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManufacturingOrders } from "@/hooks/useManufacturingOrders";
import { useOrderProcessHistoryView } from "@/hooks/useProcessHistory";
import { useArtworkByUiorn } from "@/hooks/useArtworkData";
import { ViscosityTables } from "@/components/manufacturing/ViscosityTables";
import { PrintingTemplateLoader } from "@/components/manufacturing/PrintingTemplateLoader";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export default function GravurePrinting() {
  const [printingLogs, setPrintingLogs] = useState([]);
  const [selectedUiorn, setSelectedUiorn] = useState<string>("");
  const [historyFilters, setHistoryFilters] = useState({
    uiorn: "",
    customer: "",
    startDate: "",
    endDate: ""
  });
  
  // Job setup form state
  const [jobSetup, setJobSetup] = useState({
    print_speed: "",
    drying_temperature: "",
    ink_viscosity: "",
    color_tolerance: "",
    registration_tolerance: "",
    density_target: ""
  });

  const { data: orders = [] } = useManufacturingOrders({
    status: "IN_PROGRESS"
  });

  const { data: processHistory = [] } = useOrderProcessHistoryView();

  useEffect(() => {
    fetchPrintingData();
  }, []);

  const fetchPrintingData = async () => {
    const { data: logs } = await supabase
      .from('process_logs_se')
      .select('*')
      .eq('stage', 'PRINTING')
      .order('captured_at', { ascending: false })
      .limit(20);
      
    setPrintingLogs(logs || []);
  };

  // Enhanced active jobs with real customer data
  const activeJobs = orders.map((order, index) => {
    const artworkData = useArtworkByUiorn(order.uiorn);
    const customerName = artworkData.data?.customer_name || order.customer_name || "Loading...";
    const colorCount = extractColorCount(artworkData.data?.no_of_colours || order.product_description || "");
    
    return {
      id: index + 1,
      uiorn: order.uiorn,
      customer: customerName,
      product: order.product_description,
      substrate: index % 2 === 0 ? "BOPP Film" : "PET Film",
      colors: generateColorNames(colorCount),
      colorCount: colorCount,
      speed: index % 2 === 0 ? "120 m/min" : "95 m/min",
      temperature: index % 2 === 0 ? "185°C" : "175°C",
      status: index === 0 ? "RUNNING" : "SETUP",
      progress: index === 0 ? 65 : 15,
      operator: index % 2 === 0 ? "Rajesh Kumar" : "Suresh Patel"
    };
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'text-green-600 bg-green-50 border-green-200';
      case 'SETUP': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'PAUSED': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'MAINTENANCE': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const extractColorCount = (colorString: string): number => {
    console.log('Processing color string:', colorString);
    
    if (!colorString) return 4;
    
    // Handle various formats: "7COL", "8COL", "COL", "YTRCOL", etc.
    const colMatch = colorString.match(/(\d+)COL/i);
    if (colMatch) {
      const count = parseInt(colMatch[1]);
      console.log('Extracted color count:', count);
      return count > 0 && count <= 12 ? count : 4;
    }
    
    // Handle pure numbers
    const numberMatch = colorString.match(/\b(\d+)\b/);
    if (numberMatch) {
      const count = parseInt(numberMatch[1]);
      if (count > 0 && count <= 12) {
        console.log('Extracted numeric color count:', count);
        return count;
      }
    }
    
    // Default fallback
    console.log('Using default color count: 4');
    return 4;
  };

  const generateColorNames = (count: number): string[] => {
    const allColors = ['Cyan', 'Magenta', 'Yellow', 'Black', 'Blue', 'Green', 'Red', 'White', 'Orange', 'Purple', 'Pink', 'Brown'];
    return allColors.slice(0, count);
  };

  const handleTemplateLoad = (template: any) => {
    setJobSetup({
      print_speed: template.print_speed?.toString() || "",
      drying_temperature: template.drying_temperature?.toString() || "",
      ink_viscosity: template.ink_viscosity?.toString() || "",
      color_tolerance: template.color_tolerance?.toString() || "",
      registration_tolerance: template.registration_tolerance?.toString() || "",
      density_target: template.density_target?.toString() || ""
    });
  };

  const filteredHistory = processHistory.filter(record => {
    const matchesUiorn = !historyFilters.uiorn || record.uiorn?.includes(historyFilters.uiorn);
    const matchesCustomer = !historyFilters.customer || record.customer_name?.toLowerCase().includes(historyFilters.customer.toLowerCase());
    
    let matchesDate = true;
    if (historyFilters.startDate && record.captured_at) {
      matchesDate = new Date(record.captured_at) >= new Date(historyFilters.startDate);
    }
    if (historyFilters.endDate && record.captured_at && matchesDate) {
      matchesDate = new Date(record.captured_at) <= new Date(historyFilters.endDate);
    }
    
    return matchesUiorn && matchesCustomer && matchesDate;
  });

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
            <div className="text-2xl font-bold">{activeJobs.filter(j => j.status === 'RUNNING').length}</div>
            <p className="text-xs text-muted-foreground">Currently printing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Process Records</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{printingLogs.length}</div>
            <p className="text-xs text-muted-foreground">Historical records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Speed</CardTitle>
            <Thermometer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">108</div>
            <p className="text-xs text-muted-foreground">m/min current</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
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
              <CardDescription>Real-time monitoring of printing operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeJobs.map((job) => (
                  <div key={job.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-semibold">{job.uiorn}</h3>
                          <p className="text-sm text-muted-foreground">{job.customer}</p>
                          <p className="text-xs text-muted-foreground">{job.product}</p>
                        </div>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{job.progress}% Complete</p>
                        <p className="text-xs text-muted-foreground">Operator: {job.operator}</p>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="mt-1"
                          onClick={() => setSelectedUiorn(job.uiorn)}
                        >
                          View Details
                        </Button>
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
                        <p className="text-muted-foreground">Colors ({job.colorCount})</p>
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

                    {/* Dynamic Viscosity Tables */}
                    {selectedUiorn === job.uiorn && (
                      <div className="mt-4 pt-4 border-t">
                        <ViscosityTables 
                          uiorn={job.uiorn}
                          colorCount={job.colorCount}
                        />
                      </div>
                    )}
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
              <CardDescription>Configure printing parameters and job settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Printing Parameters</h3>
                  <PrintingTemplateLoader 
                    uiorn={selectedUiorn}
                    onTemplateLoad={handleTemplateLoad}
                  />
                </div>
                
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      <div>
                        <label className="text-sm font-medium">Print Speed (m/min)</label>
                        <Input 
                          type="number" 
                          placeholder="120"
                          value={jobSetup.print_speed}
                          onChange={(e) => setJobSetup(prev => ({...prev, print_speed: e.target.value}))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Drying Temperature (°C)</label>
                        <Input 
                          type="number" 
                          placeholder="185"
                          value={jobSetup.drying_temperature}
                          onChange={(e) => setJobSetup(prev => ({...prev, drying_temperature: e.target.value}))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Ink Viscosity (cPs)</label>
                        <Input 
                          type="number" 
                          placeholder="18"
                          value={jobSetup.ink_viscosity}
                          onChange={(e) => setJobSetup(prev => ({...prev, ink_viscosity: e.target.value}))}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="font-semibold">Quality Settings</h3>
                    <div className="grid gap-3">
                      <div>
                        <label className="text-sm font-medium">Color Tolerance (ΔE)</label>
                        <Input 
                          type="number" 
                          placeholder="2.5"
                          value={jobSetup.color_tolerance}
                          onChange={(e) => setJobSetup(prev => ({...prev, color_tolerance: e.target.value}))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Registration Tolerance (mm)</label>
                        <Input 
                          type="number" 
                          placeholder="0.1"
                          value={jobSetup.registration_tolerance}
                          onChange={(e) => setJobSetup(prev => ({...prev, registration_tolerance: e.target.value}))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Density Target</label>
                        <Input 
                          type="number" 
                          placeholder="1.4"
                          value={jobSetup.density_target}
                          onChange={(e) => setJobSetup(prev => ({...prev, density_target: e.target.value}))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button>Save Configuration</Button>
                  <Button variant="outline">Reset</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality">
          <Card>
            <CardHeader>
              <CardTitle>Quality Control Dashboard</CardTitle>
              <CardDescription>Monitor print quality and defect tracking</CardDescription>
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
              <CardDescription>Historical printing records and process logs</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Enhanced Filtering */}
              <div className="grid gap-4 md:grid-cols-4 mb-6 p-4 bg-muted/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium mb-1 block">UIORN</label>
                  <Input
                    placeholder="Search UIORN..."
                    value={historyFilters.uiorn}
                    onChange={(e) => setHistoryFilters(prev => ({...prev, uiorn: e.target.value}))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Customer</label>
                  <Input
                    placeholder="Search customer..."
                    value={historyFilters.customer}
                    onChange={(e) => setHistoryFilters(prev => ({...prev, customer: e.target.value}))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Start Date</label>
                  <Input
                    type="date"
                    value={historyFilters.startDate}
                    onChange={(e) => setHistoryFilters(prev => ({...prev, startDate: e.target.value}))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">End Date</label>
                  <Input
                    type="date"
                    value={historyFilters.endDate}
                    onChange={(e) => setHistoryFilters(prev => ({...prev, endDate: e.target.value}))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                {filteredHistory.slice(0, 20).map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Droplets className="w-5 h-5 text-blue-500" />
                      <div>
                        <h4 className="font-medium">{log.uiorn}</h4>
                        <p className="text-sm text-muted-foreground">
                          {log.customer_name && <span className="font-medium">{log.customer_name}</span>}
                          {log.customer_name && " • "}
                          {log.metric}: {log.value || log.txt_value}
                        </p>
                        {log.product_description && (
                          <p className="text-xs text-muted-foreground">{log.product_description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {log.captured_at && format(new Date(log.captured_at), 'MMM dd, HH:mm')}
                    </div>
                  </div>
                ))}
                
                {filteredHistory.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No printing records found matching your filters.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
