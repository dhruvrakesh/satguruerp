
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Workflow, Filter, Search, TrendingUp, Clock, Package, AlertTriangle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EnhancedOrderCreationDialog } from "@/components/manufacturing/EnhancedOrderCreationDialog";
import { InteractiveWorkflowKanban } from "@/components/manufacturing/InteractiveWorkflowKanban";
import { ProcessHistoryViewer } from "@/components/manufacturing/ProcessHistoryViewer";
import { OrderDetailModal } from "@/components/manufacturing/OrderDetailModal";
import { useManufacturingOrders, useWorkflowBottlenecks } from "@/hooks/useManufacturingOrders";

export default function ManufacturingWorkflow() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);
  const [isOrderCreationOpen, setIsOrderCreationOpen] = useState(false);
  
  const { data: orders = [] } = useManufacturingOrders({
    search: searchTerm,
    status: statusFilter,
  });
  
  const { data: bottlenecks = [] } = useWorkflowBottlenecks();

  // Calculate dashboard metrics
  const activeOrders = orders.filter(order => order.status === "IN_PROGRESS").length;
  const pendingOrders = orders.filter(order => order.status === "PENDING").length;
  const completedToday = orders.filter(order => {
    const today = new Date().toDateString();
    return order.status === "COMPLETED" && 
           order.updated_at && new Date(order.updated_at).toDateString() === today;
  }).length;
  const urgentOrders = orders.filter(order => order.priority_level === "urgent").length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manufacturing Workflow</h1>
          <p className="text-muted-foreground">Real-time production tracking and order management</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsOrderCreationOpen(true)}>
            Create New Order
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedOrder(orders[0]); // Demo: select first order
              setIsOrderDetailOpen(true);
            }}
            disabled={orders.length === 0}
          >
            <History className="h-4 w-4 mr-2" />
            View History
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search orders, UIONs..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          Filter
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeOrders}</div>
            <p className="text-xs text-muted-foreground">
              Currently in production
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders}</div>
            <p className="text-xs text-muted-foreground">
              Waiting to start
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedToday}</div>
            <p className="text-xs text-muted-foreground">
              Orders completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent Orders</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{urgentOrders}</div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bottlenecks Alert */}
      {bottlenecks.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Workflow Bottlenecks Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {bottlenecks.slice(0, 3).map((bottleneck, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{bottleneck.stage}</span>
                  <div className="flex items-center gap-2">
                    <span>{bottleneck.pending_orders} pending</span>
                    <Badge variant="outline" className="text-orange-700">
                      {bottleneck.avg_processing_time}h avg
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="kanban" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="kanban">Interactive Workflow</TabsTrigger>
          <TabsTrigger value="history">Process History</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <Card>
            <CardHeader>
              <CardTitle>Interactive Workflow Dashboard</CardTitle>
              <CardDescription>
                Drag and drop orders between stages - Real-time production tracking with {orders.length} active orders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InteractiveWorkflowKanban />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <ProcessHistoryViewer />
        </TabsContent>
      </Tabs>

      <EnhancedOrderCreationDialog
        open={isOrderCreationOpen}
        onOpenChange={setIsOrderCreationOpen}
      />

      <OrderDetailModal
        order={selectedOrder}
        isOpen={isOrderDetailOpen}
        onClose={() => {
          setIsOrderDetailOpen(false);
          setSelectedOrder(null);
        }}
      />
    </div>
  );
}
