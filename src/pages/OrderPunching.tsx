import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Plus, Search, Filter, Calendar, Package, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EnhancedOrderCreationDialog } from "@/components/manufacturing/EnhancedOrderCreationDialog";
import { useManufacturingOrders } from "@/hooks/useManufacturingOrders";
import { format } from "date-fns";

export default function OrderPunching() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  const { data: orders = [] } = useManufacturingOrders({
    search: searchTerm,
    status: statusFilter,
  });

  // Filter orders relevant to order punching stage
  const pendingOrders = orders.filter(order => order.status === "PENDING");
  const recentOrders = orders.slice(0, 10); // Last 10 orders
  const todayOrders = orders.filter(order => {
    const today = new Date().toDateString();
    return order.order_date && new Date(order.order_date).toDateString() === today;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'IN_PROGRESS': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'COMPLETED': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            Order Punching
          </h1>
          <p className="text-muted-foreground">Order creation, specifications, and initial processing</p>
        </div>
        <div className="flex gap-2">
          <EnhancedOrderCreationDialog />
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search orders, customers..." 
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

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders.length}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Orders</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayOrders.length}</div>
            <p className="text-xs text-muted-foreground">
              Created today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-muted-foreground">
              All orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent Orders</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter(o => o.priority_level === 'urgent').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Need attention
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="orders">All Orders</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingOrders.length})</TabsTrigger>
          <TabsTrigger value="specifications">Specifications</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Order Management</CardTitle>
              <CardDescription>
                Manage customer orders and specifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="font-semibold">{order.uiorn}</h3>
                        <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                      </div>
                      <div>
                        <p className="text-sm">{order.product_description}</p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {order.order_quantity} {order.unit_of_measure}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {order.priority_level && (
                        <div className={`w-3 h-3 rounded-full ${getPriorityColor(order.priority_level)}`} />
                      )}
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {order.order_date && format(new Date(order.order_date), 'MMM dd')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Orders</CardTitle>
              <CardDescription>
                Orders ready for processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending orders found
                  </div>
                ) : (
                  pendingOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                      <div className="flex items-center gap-4">
                        <User className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <h3 className="font-semibold">{order.uiorn}</h3>
                          <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                        </div>
                        <div>
                          <p className="text-sm">{order.product_description}</p>
                          <p className="text-xs text-muted-foreground">
                            Delivery: {order.delivery_date && format(new Date(order.delivery_date), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button size="sm" variant="outline">
                          Start Processing
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="specifications">
          <Card>
            <CardHeader>
              <CardTitle>Order Specifications</CardTitle>
              <CardDescription>
                Define product specifications and requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Specification management interface</p>
                <p className="text-sm">Define substrate types, dimensions, colors, and special requirements</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}