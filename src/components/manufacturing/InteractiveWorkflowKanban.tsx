
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useManufacturingDashboard, useUpdateOrderStatus } from "@/hooks/useManufacturingOrders";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  AlertCircle,
  CheckCircle,
  Pause,
  Play,
  MoreVertical,
  Package,
  Settings,
  Truck,
  Upload,
  Printer,
  Layers,
  Droplets,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Order {
  id: string;
  uiorn: string;
  customer_name: string;
  product_description: string;
  order_quantity: number;
  priority_level: string;
  status: string;
  delivery_date?: string;
  created_at: string;
}

// Updated stages to match database enum values and flexible packaging workflow
const stages = [
  {
    id: "PENDING",
    name: "Pending",
    icon: Clock,
    color: "bg-slate-100 border-slate-300",
    headerColor: "bg-slate-50",
  },
  {
    id: "STARTED", // Changed from ARTWORK_UPLOAD to STARTED
    name: "Started",
    icon: Upload,
    color: "bg-purple-100 border-purple-300",
    headerColor: "bg-purple-50",
  },
  {
    id: "IN_PROGRESS", // This matches the enum
    name: "In Progress",
    icon: Printer,
    color: "bg-blue-100 border-blue-300",
    headerColor: "bg-blue-50",
  },
  {
    id: "COMPLETED",
    name: "Completed",
    icon: CheckCircle,
    color: "bg-emerald-100 border-emerald-300", 
    headerColor: "bg-emerald-50",
  },
  {
    id: "ON_HOLD",
    name: "On Hold",
    icon: Pause,
    color: "bg-red-100 border-red-300",
    headerColor: "bg-red-50",
  },
];

export function InteractiveWorkflowKanban() {
  const { data: orders = [], isLoading } = useManufacturingDashboard();
  const updateStatus = useUpdateOrderStatus();
  const { toast } = useToast();
  const [draggedOrder, setDraggedOrder] = useState<string | null>(null);

  const handleStatusUpdate = async (uiorn: string, newStatus: string) => {
    try {
      // Use the correct status values that match the database enum
      const { error } = await supabase
        .from('order_punching')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('uiorn', uiorn);
      
      if (error) throw error;
      
      toast({
        title: "Status Updated",
        description: `Order ${uiorn} moved to ${getStageLabel(newStatus)}`,
      });
    } catch (error) {
      console.error('Status update error:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update order status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStageLabel = (status: string) => {
    return stages.find(s => s.id === status)?.name || status;
  };

  const getOrdersByStage = (stageId: string): Order[] => {
    return orders.filter((order: Order) => {
      return order.status === stageId;
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case "URGENT":
        return "destructive";
      case "HIGH":
        return "default";
      case "NORMAL":
        return "outline";
      case "LOW":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    const stage = stages.find(s => s.id === status);
    if (stage) {
      return <stage.icon className="h-4 w-4" />;
    }
    return <AlertCircle className="h-4 w-4 text-gray-500" />;
  };

  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    setDraggedOrder(orderId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    if (draggedOrder) {
      const order = orders.find((o: Order) => o.id === draggedOrder);
      if (order && order.status !== targetStage) {
        handleStatusUpdate(order.uiorn, targetStage);
      }
      setDraggedOrder(null);
    }
  };

  // Flexible packaging workflow progression
  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case "PENDING": return "STARTED";
      case "STARTED": return "IN_PROGRESS";
      case "IN_PROGRESS": return "COMPLETED";
      case "ON_HOLD": return "IN_PROGRESS";
      default: return currentStatus;
    }
  };

  const getPreviousStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case "STARTED": return "PENDING";
      case "IN_PROGRESS": return "STARTED";
      case "COMPLETED": return "IN_PROGRESS";
      default: return currentStatus;
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stages.map((stage) => (
          <Card key={stage.id} className="h-96">
            <CardHeader className={stage.headerColor}>
              <CardTitle className="flex items-center gap-2">
                <stage.icon className="h-5 w-5" />
                {stage.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {stages.map((stage) => {
        const stageOrders = getOrdersByStage(stage.id);
        
        return (
          <Card
            key={stage.id}
            className={`min-h-[600px] ${stage.color}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            <CardHeader className={stage.headerColor}>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <stage.icon className="h-5 w-5" />
                  {stage.name}
                </div>
                <Badge variant="secondary" className="text-xs">
                  {stageOrders.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {stageOrders.map((order: Order) => (
                <Card
                  key={order.id}
                  className="cursor-move hover:shadow-md transition-shadow bg-white border-2 hover:border-primary/20"
                  draggable
                  onDragStart={(e) => handleDragStart(e, order.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(order.status)}
                        <span className="font-medium text-sm">
                          {order.uiorn}
                        </span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {stage.id !== "PENDING" && (
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.uiorn, getPreviousStatus(order.status))}
                            >
                              Move Back
                            </DropdownMenuItem>
                          )}
                          {stage.id !== "COMPLETED" && (
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.uiorn, getNextStatus(order.status))}
                            >
                              Move Forward
                            </DropdownMenuItem>
                          )}
                          {stage.id !== "ON_HOLD" && (
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.uiorn, "ON_HOLD")}
                            >
                              Put On Hold
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <h4 className="font-medium text-sm mb-1 line-clamp-2">
                      {order.customer_name}
                    </h4>

                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {order.product_description}
                    </p>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {order.order_quantity} units
                      </span>
                      <Badge 
                        variant={getPriorityColor(order.priority_level)}
                        className="text-xs"
                      >
                        {order.priority_level || 'NORMAL'}
                      </Badge>
                    </div>

                    {order.delivery_date && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Due: {new Date(order.delivery_date).toLocaleDateString()}
                      </div>
                    )}

                    <div className="flex gap-1 mt-2">
                      {order.status !== "COMPLETED" && order.status !== "ON_HOLD" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          onClick={() => handleStatusUpdate(order.uiorn, getNextStatus(order.status))}
                        >
                          Next Stage
                        </Button>
                      )}
                      
                      {order.status === "ON_HOLD" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          onClick={() => handleStatusUpdate(order.uiorn, "IN_PROGRESS")}
                        >
                          Resume
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {stageOrders.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <stage.icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No orders in this stage</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
