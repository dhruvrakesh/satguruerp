
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  Package,
  DollarSign
} from "lucide-react";

interface MaterialFlowAnalyticsProps {
  uiorn?: string;
  timeRange?: '24h' | '7d' | '30d';
  processes?: string[];
}

export function MaterialFlowAnalytics({ 
  uiorn, 
  timeRange = '7d', 
  processes = ['GRAVURE_PRINTING', 'LAMINATION', 'ADHESIVE_COATING', 'SLITTING', 'PACKAGING']
}: MaterialFlowAnalyticsProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [uiorn, timeRange]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      // This would be replaced with actual database queries
      // For now, using mock data to demonstrate the structure
      const mockAnalytics = {
        overallYield: 87.5,
        totalWasteCost: 12500,
        totalMaterialCost: 185000,
        processEfficiencies: [
          { process: 'GRAVURE_PRINTING', yield: 92.0, waste: 8.0, cost: 750 },
          { process: 'LAMINATION', yield: 89.5, waste: 10.5, cost: 450 },
          { process: 'ADHESIVE_COATING', yield: 91.2, waste: 8.8, cost: 320 },
          { process: 'SLITTING', yield: 95.8, waste: 4.2, cost: 180 },
          { process: 'PACKAGING', yield: 98.5, waste: 1.5, cost: 80 }
        ],
        trends: {
          yieldTrend: 2.3, // percentage change
          wasteTrend: -1.8,
          costTrend: -5.2
        },
        alerts: [
          { type: 'warning', message: 'Lamination yield below target (89.5% vs 92% target)' },
          { type: 'info', message: 'Overall material costs reduced by 5.2% this week' }
        ]
      };
      
      setAnalytics(mockAnalytics);
    } catch (error) {
      console.error('Error loading material flow analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overall Yield</p>
                <p className="text-2xl font-bold">{analytics?.overallYield}%</p>
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">+{analytics?.trends.yieldTrend}%</span>
              </div>
            </div>
            <Progress value={analytics?.overallYield} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Waste Cost</p>
                <p className="text-2xl font-bold">₹{analytics?.totalWasteCost?.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <TrendingDown className="h-4 w-4" />
                <span className="text-sm">{analytics?.trends.wasteTrend}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Material Cost</p>
                <p className="text-2xl font-bold">₹{analytics?.totalMaterialCost?.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <TrendingDown className="h-4 w-4" />
                <span className="text-sm">{analytics?.trends.costTrend}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Efficiency Score</p>
                <p className="text-2xl font-bold">A+</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Process Efficiency Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Process Efficiency Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics?.processEfficiencies.map((process: any) => (
              <div key={process.process} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{process.process.replace('_', ' ')}</span>
                    <Badge variant={process.yield >= 90 ? "default" : "destructive"}>
                      {process.yield}% Yield
                    </Badge>
                  </div>
                  <Progress value={process.yield} className="h-2" />
                </div>
                <div className="ml-4 text-right">
                  <div className="text-sm text-muted-foreground">Waste: {process.waste}%</div>
                  <div className="text-sm text-muted-foreground">Cost: ₹{process.cost}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alerts & Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Alerts & Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics?.alerts.map((alert: any, index: number) => (
              <div key={index} className={`flex items-start gap-3 p-3 rounded-lg ${
                alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'
              } border`}>
                {alert.type === 'warning' ? 
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" /> :
                  <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                }
                <p className="text-sm">{alert.message}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
