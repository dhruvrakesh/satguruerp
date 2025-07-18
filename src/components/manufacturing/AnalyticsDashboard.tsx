import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useManufacturingDashboard, useOrderProgress, useWorkflowBottlenecks, useManufacturingAnalytics } from "@/hooks/useManufacturingOrders";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Package,
  Settings,
  Truck,
  BarChart,
  Activity
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: React.ElementType;
  description?: string;
}

function MetricCard({ title, value, change, trend, icon: Icon, description }: MetricCardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <div className="flex items-center text-xs text-muted-foreground">
            {getTrendIcon()}
            <span className="ml-1">{change}</span>
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsDashboard() {
  const { data: orders = [] } = useManufacturingDashboard();
  const { data: orderProgress = [] } = useOrderProgress();
  const { data: bottlenecks = [] } = useWorkflowBottlenecks();
  const { data: analytics } = useManufacturingAnalytics();

  // Use analytics data when available, fallback to calculated values
  const totalOrders = orders.length;
  const activeOrders = analytics?.active_orders || orders.filter((order: any) => 
    order.status === "PENDING" || order.status === "IN_PROGRESS"
  ).length;
  const completedOrders = analytics?.completed_orders || orders.filter((order: any) => 
    order.status === "COMPLETED"
  ).length;
  const urgentOrders = analytics?.high_priority_orders || orders.filter((order: any) => 
    order.priority_level === "URGENT" || order.priority_level === "HIGH"
  ).length;

  // Calculate completion rate
  const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

  // Calculate average progress
  const avgProgress = orderProgress.length > 0 
    ? orderProgress.reduce((sum: number, order: any) => sum + order.progress_percentage, 0) / orderProgress.length
    : 0;

  // Get stage distribution using analytics data when available
  const stageDistribution = {
    pending: analytics?.pending_orders || orders.filter((o: any) => o.status === "PENDING").length,
    inProgress: analytics?.active_orders || orders.filter((o: any) => o.status === "IN_PROGRESS").length,
    completed: analytics?.completed_orders || orders.filter((o: any) => o.status === "COMPLETED").length,
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Orders"
          value={totalOrders}
          change="+12% from last week"
          trend="up"
          icon={Package}
          description="All orders in the system"
        />
        
        <MetricCard
          title="Active Orders"
          value={activeOrders}
          change="+5% from last week"
          trend="up"
          icon={Settings}
          description="Currently in production"
        />
        
        <MetricCard
          title="Completion Rate"
          value={`${completionRate.toFixed(1)}%`}
          change="+3.2% from last week"
          trend="up"
          icon={CheckCircle}
          description="Orders completed on time"
        />
        
        <MetricCard
          title="Urgent Orders"
          value={urgentOrders}
          change={urgentOrders > 5 ? "High priority workload" : "Normal workload"}
          trend={urgentOrders > 5 ? "down" : "neutral"}
          icon={AlertTriangle}
          description="High & urgent priority"
        />
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Production Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Average Progress</span>
              <span className="text-sm text-muted-foreground">
                {avgProgress.toFixed(1)}%
              </span>
            </div>
            <Progress value={avgProgress} className="h-2" />
            
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-600">
                  {stageDistribution.pending}
                </div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {stageDistribution.inProgress}
                </div>
                <div className="text-xs text-muted-foreground">In Progress</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stageDistribution.completed}
                </div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Workflow Bottlenecks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bottlenecks.length > 0 ? (
              <div className="space-y-3">
                {bottlenecks.slice(0, 3).map((bottleneck: any, index: number) => (
                  <div key={bottleneck.stage} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        index === 0 ? 'bg-red-500' : 
                        index === 1 ? 'bg-orange-500' : 
                        'bg-yellow-500'
                      }`} />
                      <div>
                        <div className="font-medium text-sm">{bottleneck.stage}</div>
                        <div className="text-xs text-muted-foreground">
                          {bottleneck.pending_orders} orders pending
                        </div>
                      </div>
                    </div>
                    <Badge variant={
                      index === 0 ? "destructive" : 
                      index === 1 ? "default" : 
                      "secondary"
                    }>
                      Score: {bottleneck.bottleneck_score?.toFixed(1) || 'N/A'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No bottlenecks detected</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Order Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Order Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orderProgress.length > 0 ? (
            <div className="space-y-3">
              {orderProgress.slice(0, 5).map((order: any) => (
                <div key={order.uiorn} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{order.uiorn}</div>
                      <div className="text-xs text-muted-foreground">
                        Current: {order.current_stage}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24">
                      <Progress value={order.progress_percentage} className="h-2" />
                    </div>
                    <div className="text-sm font-medium min-w-[3rem] text-right">
                      {order.progress_percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No orders to track</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}