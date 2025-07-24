import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  TrendingUp, 
  Factory, 
  Package, 
  AlertTriangle, 
  DollarSign,
  Activity,
  Settings,
  RefreshCw,
  ExternalLink,
  Maximize2
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";

interface PowerBIReport {
  id: string;
  name: string;
  embedUrl: string;
  description: string;
  category: 'production' | 'quality' | 'supply-chain' | 'cost';
  icon: React.ReactNode;
  status: 'active' | 'loading' | 'error';
}

export function PowerBIEmbedded() {
  const [activeReport, setActiveReport] = useState<string>("production-efficiency");
  const [isLoading, setIsLoading] = useState(false);

  // Mock Power BI reports for flexible packaging manufacturing
  const reports: PowerBIReport[] = [
    {
      id: "production-efficiency",
      name: "Production Efficiency Dashboard",
      embedUrl: "https://app.powerbi.com/reportEmbed?reportId=production-efficiency",
      description: "Real-time OEE, machine utilization, and production line performance",
      category: 'production',
      icon: <Factory className="w-5 h-5" />,
      status: 'active'
    },
    {
      id: "quality-control",
      name: "Quality Control Analytics",
      embedUrl: "https://app.powerbi.com/reportEmbed?reportId=quality-control",
      description: "Defect rates, color consistency, and coating quality metrics",
      category: 'quality',
      icon: <AlertTriangle className="w-5 h-5" />,
      status: 'active'
    },
    {
      id: "supply-chain",
      name: "Supply Chain Optimization",
      embedUrl: "https://app.powerbi.com/reportEmbed?reportId=supply-chain",
      description: "Supplier performance, lead times, and inventory optimization",
      category: 'supply-chain',
      icon: <Package className="w-5 h-5" />,
      status: 'active'
    },
    {
      id: "cost-analysis",
      name: "Cost Management Dashboard",
      embedUrl: "https://app.powerbi.com/reportEmbed?reportId=cost-analysis",
      description: "Material costs, variance analysis, and profitability insights",
      category: 'cost',
      icon: <DollarSign className="w-5 h-5" />,
      status: 'active'
    },
    {
      id: "predictive-maintenance",
      name: "Predictive Maintenance",
      embedUrl: "https://app.powerbi.com/reportEmbed?reportId=predictive-maintenance",
      description: "Equipment health monitoring and failure prediction",
      category: 'production',
      icon: <Activity className="w-5 h-5" />,
      status: 'loading'
    }
  ];

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Dashboard refreshed",
        description: "Power BI reports have been updated with latest data",
      });
    }, 2000);
  };

  const handleFullscreen = (reportName: string) => {
    toast({
      title: "Opening in Power BI",
      description: `${reportName} will open in a new window`,
    });
    // In real implementation, this would open the report in Power BI service
    window.open("https://app.powerbi.com", "_blank");
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'production': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'quality': return 'bg-red-500/10 text-red-700 border-red-200';
      case 'supply-chain': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'cost': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const currentReport = reports.find(r => r.id === activeReport);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Power BI Manufacturing Analytics
          </h2>
          <p className="text-muted-foreground">
            Advanced analytics and insights for flexible packaging operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleFullscreen(currentReport?.name || 'Dashboard')}
            className="gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Open in Power BI
          </Button>
        </div>
      </div>

      {/* Report Categories */}
      <Tabs value={activeReport} onValueChange={setActiveReport} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          {reports.map((report) => (
            <TabsTrigger 
              key={report.id} 
              value={report.id}
              className="flex items-center gap-2 text-xs"
            >
              {report.icon}
              <span className="hidden sm:inline">{report.name.split(' ')[0]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {reports.map((report) => (
          <TabsContent key={report.id} value={report.id} className="space-y-4">
            {/* Report Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {report.icon}
                    <div>
                      <CardTitle className="text-lg">{report.name}</CardTitle>
                      <CardDescription>{report.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={getCategoryColor(report.category)}
                    >
                      {report.category.replace('-', ' ')}
                    </Badge>
                    <Badge 
                      variant={report.status === 'active' ? 'default' : 
                              report.status === 'loading' ? 'secondary' : 'destructive'}
                    >
                      {report.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Embedded Report */}
            <Card className="min-h-[600px]">
              <CardContent className="p-0">
                {report.status === 'active' ? (
                  <div className="relative w-full h-[600px] bg-muted/30 rounded-lg overflow-hidden">
                    <iframe
                      src={`${report.embedUrl}&navContentPaneEnabled=false&filterPaneEnabled=false`}
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      allowFullScreen
                      title={report.name}
                      className="border-0"
                    />
                    <div className="absolute top-4 right-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleFullscreen(report.name)}
                        className="gap-2 bg-white/90 hover:bg-white"
                      >
                        <Maximize2 className="w-4 h-4" />
                        Fullscreen
                      </Button>
                    </div>
                  </div>
                ) : report.status === 'loading' ? (
                  <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <div className="text-center">
                      <h3 className="font-semibold">Loading Dashboard</h3>
                      <p className="text-sm text-muted-foreground">
                        Preparing {report.name}...
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
                    <AlertTriangle className="w-12 h-12 text-destructive" />
                    <div className="text-center">
                      <h3 className="font-semibold">Dashboard Unavailable</h3>
                      <p className="text-sm text-muted-foreground">
                        Unable to load {report.name}. Please try again later.
                      </p>
                      <Button variant="outline" size="sm" className="mt-2">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Manufacturing KPIs Quick View */}
            {report.category === 'production' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">OEE</p>
                        <p className="text-2xl font-bold text-green-600">87.5%</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Uptime</p>
                        <p className="text-2xl font-bold text-blue-600">94.2%</p>
                      </div>
                      <Activity className="w-8 h-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Yield</p>
                        <p className="text-2xl font-bold text-purple-600">91.8%</p>
                      </div>
                      <Package className="w-8 h-8 text-purple-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Defect Rate</p>
                        <p className="text-2xl font-bold text-red-600">0.8%</p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Manufacturing Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Manufacturing Intelligence Insights
          </CardTitle>
          <CardDescription>
            AI-powered recommendations for flexible packaging operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900">Production Optimization</h4>
                <p className="text-sm text-blue-700">
                  Line 3 efficiency can be improved by 12% by adjusting coating temperature to 185°C
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Package className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-900">Inventory Optimization</h4>
                <p className="text-sm text-green-700">
                  BOPP substrate stock levels are optimal. Consider reducing PET film inventory by 15%
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-900">Quality Alert</h4>
                <p className="text-sm text-yellow-700">
                  Color variance detected on Gravure Line 2. Recommend viscosity adjustment
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}