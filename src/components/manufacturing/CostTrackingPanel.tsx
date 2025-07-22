
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  TrendingUp, 
  Package,
  Clock,
  AlertCircle,
  PieChart,
  BarChart3
} from "lucide-react";

interface CostTrackingPanelProps {
  uiorn: string;
}

export function CostTrackingPanel({ uiorn }: CostTrackingPanelProps) {
  // Mock cost data
  const costBreakdown = {
    material_cost: 2850.00,
    labor_cost: 450.00,
    overhead_cost: 320.00,
    total_cost: 3620.00,
    budgeted_cost: 3800.00,
    variance_percentage: -4.7
  };

  const materialConsumption = [
    {
      material: 'BOPP Film - 25 micron',
      planned_kg: 120.0,
      actual_kg: 118.5,
      waste_kg: 8.2,
      cost_per_kg: 85.50,
      total_cost: 2183.25,
      yield_percentage: 93.5
    },
    {
      material: 'Gravure Ink - Cyan',
      planned_kg: 2.5,
      actual_kg: 2.3,
      waste_kg: 0.3,
      cost_per_kg: 125.00,
      total_cost: 325.00,
      yield_percentage: 88.0
    },
    {
      material: 'Adhesive - PU Based',
      planned_kg: 1.8,
      actual_kg: 1.9,
      waste_kg: 0.2,
      cost_per_kg: 180.00,
      total_cost: 378.00,
      yield_percentage: 90.5
    },
    {
      material: 'Solvent - Ethyl Acetate',
      planned_kg: 0.8,
      actual_kg: 0.9,
      waste_kg: 0.1,
      cost_per_kg: 95.00,
      total_cost: 95.00,
      yield_percentage: 88.9
    }
  ];

  const laborCosts = [
    { stage: 'Artwork Upload', hours: 1.5, rate: 25.00, cost: 37.50 },
    { stage: 'Gravure Printing', hours: 8.0, rate: 35.00, cost: 280.00 },
    { stage: 'Lamination', hours: 3.5, rate: 30.00, cost: 105.00 },
    { stage: 'Slitting', hours: 1.0, rate: 28.00, cost: 28.00 }
  ];

  const overheadAllocation = [
    { category: 'Machine Depreciation', amount: 150.00, percentage: 46.9 },
    { category: 'Utilities', amount: 85.00, percentage: 26.6 },
    { category: 'Maintenance', amount: 50.00, percentage: 15.6 },
    { category: 'Quality Control', amount: 35.00, percentage: 10.9 }
  ];

  const getVarianceColor = (variance: number) => {
    if (variance < -10) return 'text-green-600 bg-green-50';
    if (variance < 0) return 'text-green-600 bg-green-50';
    if (variance < 10) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="space-y-6">
      {/* Cost Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Tracking - {uiorn}
          </CardTitle>
          <CardDescription>
            Real-time cost tracking and variance analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                ₹{costBreakdown.material_cost.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Material Cost</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                ₹{costBreakdown.labor_cost.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Labor Cost</div>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                ₹{costBreakdown.overhead_cost.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Overhead Cost</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                ₹{costBreakdown.total_cost.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Cost</div>
            </div>
          </div>
          
          <div className="mt-6 p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Budget Variance</span>
              <Badge className={getVarianceColor(costBreakdown.variance_percentage)}>
                {costBreakdown.variance_percentage > 0 ? '+' : ''}{costBreakdown.variance_percentage}%
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Budgeted: ₹{costBreakdown.budgeted_cost.toLocaleString()} | 
              Actual: ₹{costBreakdown.total_cost.toLocaleString()} | 
              Savings: ₹{(costBreakdown.budgeted_cost - costBreakdown.total_cost).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Cost Breakdown */}
      <Tabs defaultValue="materials" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="materials">Material Costs</TabsTrigger>
          <TabsTrigger value="labor">Labor Costs</TabsTrigger>
          <TabsTrigger value="overhead">Overhead</TabsTrigger>
          <TabsTrigger value="analysis">Cost Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Material Consumption & Costs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {materialConsumption.map((material, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium">{material.material}</div>
                        <div className="text-sm text-muted-foreground">
                          ₹{material.cost_per_kg}/kg
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">₹{material.total_cost.toLocaleString()}</div>
                        <Badge variant={material.yield_percentage > 90 ? "default" : "secondary"}>
                          {material.yield_percentage}% Yield
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Planned</div>
                        <div className="font-medium">{material.planned_kg} kg</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Actual</div>
                        <div className="font-medium">{material.actual_kg} kg</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Waste</div>
                        <div className="font-medium">{material.waste_kg} kg</div>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <Progress value={material.yield_percentage} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Labor Cost Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {laborCosts.map((labor, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{labor.stage}</div>
                      <div className="text-sm text-muted-foreground">
                        {labor.hours} hours @ ₹{labor.rate}/hour
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">₹{labor.cost.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg font-medium">
                  <span>Total Labor Cost</span>
                  <span>₹{laborCosts.reduce((sum, labor) => sum + labor.cost, 0).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overhead" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Overhead Allocation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {overheadAllocation.map((overhead, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{overhead.category}</span>
                      <div className="text-right">
                        <span className="font-medium">₹{overhead.amount.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({overhead.percentage}%)
                        </span>
                      </div>
                    </div>
                    <Progress value={overhead.percentage} className="h-2" />
                  </div>
                ))}
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg font-medium mt-4">
                  <span>Total Overhead</span>
                  <span>₹{overheadAllocation.reduce((sum, oh) => sum + oh.amount, 0).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Cost Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Material Efficiency</span>
                    <div className="text-right">
                      <div className="font-medium">91.2%</div>
                      <div className="text-xs text-green-600">+2.3% vs target</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Labor Productivity</span>
                    <div className="text-right">
                      <div className="font-medium">105%</div>
                      <div className="text-xs text-green-600">+5% vs standard</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Overhead Utilization</span>
                    <div className="text-right">
                      <div className="font-medium">85%</div>
                      <div className="text-xs text-orange-600">-3% vs budget</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Profitability Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Selling Price</span>
                    <span className="font-medium">₹4,500</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Total Cost</span>
                    <span className="font-medium">₹3,620</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Gross Margin</span>
                    <span className="font-medium text-green-600">₹880 (19.6%)</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Target Margin</span>
                    <span>15%</span>
                  </div>
                  
                  <Badge className="w-full justify-center bg-green-50 text-green-700">
                    Exceeding Target by 4.6%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
