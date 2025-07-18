import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useManufacturingDashboard, useUpdateOrderStatus } from "@/hooks/useManufacturingOrders";
import { Clock, User, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const stages = [
  { id: "artwork_upload", name: "Artwork Upload", color: "bg-blue-100 text-blue-800" },
  { id: "gravure_printing", name: "Gravure Printing", color: "bg-purple-100 text-purple-800" },
  { id: "lamination", name: "Lamination", color: "bg-green-100 text-green-800" },
  { id: "adhesive_coating", name: "Adhesive Coating", color: "bg-yellow-100 text-yellow-800" },
  { id: "slitting", name: "Slitting", color: "bg-orange-100 text-orange-800" },
  { id: "packaging", name: "Packaging", color: "bg-red-100 text-red-800" },
];

export function WorkflowKanban() {
  const { data: orders = [], refetch } = useManufacturingDashboard();
  const updateStatus = useUpdateOrderStatus();
  const { toast } = useToast();

  const handleStatusUpdate = async (uiorn: string, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({
        uiorn,
        status: newStatus,
      });
      
      toast({
        title: "Status Updated",
        description: `Order ${uiorn} status updated to ${newStatus}`,
      });
      
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    }
  };

  const getOrdersByStage = (stageId: string) => {
    // For now, distribute orders based on status since we don't have current_stage
    const statusStageMap = {
      "artwork_upload": ["PENDING"],
      "gravure_printing": ["STARTED"],
      "lamination": ["IN_PROGRESS"],
      "adhesive_coating": [],
      "slitting": [],
      "packaging": ["COMPLETED"]
    };
    return orders.filter(order => (statusStageMap as any)[stageId]?.includes(order.status));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "in_progress": return <Clock className="w-4 h-4 text-blue-600" />;
      case "on_hold": return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageOrders = getOrdersByStage(stage.id);
        
        return (
          <div key={stage.id} className="flex-shrink-0 w-80">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
                  <Badge variant="secondary" className={stage.color}>
                    {stageOrders.length}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Orders in {stage.name.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {stageOrders.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No orders in this stage
                  </div>
                ) : (
                  stageOrders.map((order) => (
                    <Card key={order.uiorn} className="p-3 hover:shadow-md transition-shadow">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{order.uiorn}</span>
                            <div 
                              className={`w-2 h-2 rounded-full ${getPriorityColor(order.priority_level || "medium")}`}
                              title={`${order.priority_level || "medium"} priority`}
                            />
                          </div>
                          {getStatusIcon(order.status || "PENDING")}
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {order.customer_name}
                          </div>
                          <div className="mt-1 text-xs">
                            Qty: {order.order_quantity}
                          </div>
                        </div>

                        <div className="flex gap-1">
                          {order.status === "PENDING" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs"
                              onClick={() => handleStatusUpdate(order.uiorn, "STARTED")}
                              disabled={updateStatus.isPending}
                            >
                              Start
                            </Button>
                          )}
                          
                          {order.status === "STARTED" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs"
                                onClick={() => handleStatusUpdate(order.uiorn, "ON_HOLD")}
                                disabled={updateStatus.isPending}
                              >
                                Hold
                              </Button>
                              <Button
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => handleStatusUpdate(order.uiorn, "IN_PROGRESS")}
                                disabled={updateStatus.isPending}
                              >
                                Progress
                              </Button>
                            </>
                          )}
                          
                          {order.status === "IN_PROGRESS" && (
                            <Button
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => handleStatusUpdate(order.uiorn, "COMPLETED")}
                              disabled={updateStatus.isPending}
                            >
                              Complete
                            </Button>
                          )}
                          
                          {order.status === "ON_HOLD" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs"
                              onClick={() => handleStatusUpdate(order.uiorn, "IN_PROGRESS")}
                              disabled={updateStatus.isPending}
                            >
                              Resume
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}