import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrderProcessHistory } from "@/hooks/useProcessHistory";
import { Activity, Package, Calendar, User, Hash, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface OrderDetailModalProps {
  order: {
    uiorn: string;
    customer_name: string;
    product_description: string;
    order_quantity: number;
    priority_level?: string;
    status: string;
    delivery_date?: string;
    created_at: string;
    special_instructions?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderDetailModal({ order, isOpen, onClose }: OrderDetailModalProps) {
  const { data: processHistory = [], isLoading } = useOrderProcessHistory(order?.uiorn || "");

  if (!order) return null;

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

  const getStageColor = (stage: string) => {
    switch (stage?.toUpperCase()) {
      case "PRINTING":
        return "bg-blue-100 text-blue-800";
      case "LAMINATION":
        return "bg-green-100 text-green-800";
      case "SLITTING":
        return "bg-orange-100 text-orange-800";
      case "COATING":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatValue = (value: number | null, txtValue: string | null, metric: string) => {
    if (txtValue) return txtValue;
    if (value !== null) {
      if (metric.includes("temperature")) return `${value}°C`;
      if (metric.includes("speed")) return `${value} mpm`;
      if (metric.includes("viscosity")) return `${value} sec`;
      return value.toString();
    }
    return "-";
  };

  const groupedHistory = processHistory.reduce((groups, entry) => {
    const stage = entry.stage || "UNKNOWN";
    if (!groups[stage]) groups[stage] = [];
    groups[stage].push(entry);
    return groups;
  }, {} as Record<string, typeof processHistory>);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Details - {order.uiorn}
          </DialogTitle>
          <DialogDescription>
            Complete order information and process history
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="process-history">
              Process History ({processHistory.length})
            </TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Order Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">UIORN:</span>
                    <Badge variant="outline">{order.uiorn}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Customer:</span>
                    <span className="text-sm">{order.customer_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Quantity:</span>
                    <span className="text-sm">{order.order_quantity} meters</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Priority:</span>
                    <Badge variant={getPriorityColor(order.priority_level || "normal")}>
                      {order.priority_level || "Normal"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge>{order.status}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Dates & Delivery
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Created:</span>
                    <span className="text-sm">
                      {format(new Date(order.created_at), "MMM dd, yyyy HH:mm")}
                    </span>
                  </div>
                  {order.delivery_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Delivery:</span>
                      <span className="text-sm">
                        {format(new Date(order.delivery_date), "MMM dd, yyyy")}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Product Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{order.product_description}</p>
                {order.special_instructions && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Special Instructions</h4>
                    <p className="text-sm text-muted-foreground">
                      {order.special_instructions}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="process-history" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                <p>Loading process history...</p>
              </div>
            ) : processHistory.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No process history available</p>
              </div>
            ) : (
              Object.entries(groupedHistory).map(([stage, entries]) => (
                <Card key={stage}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge className={getStageColor(stage)}>
                        {stage.replace("_", " ")}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        ({entries.length} entries)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Metric</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Captured At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-sm">
                              {entry.metric?.replace("_", " ")}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {formatValue(entry.value, entry.txt_value, entry.metric || "")}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {entry.captured_at
                                ? format(new Date(entry.captured_at), "MMM dd, HH:mm:ss")
                                : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Order Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Order Created</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), "MMM dd, yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                  
                  {processHistory
                    .sort((a, b) => new Date(a.captured_at || "").getTime() - new Date(b.captured_at || "").getTime())
                    .map((entry, index) => (
                      <div key={entry.id} className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {entry.stage?.replace("_", " ")} - {entry.metric?.replace("_", " ")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {entry.captured_at
                              ? format(new Date(entry.captured_at), "MMM dd, yyyy HH:mm:ss")
                              : "Unknown time"} - 
                            Value: {formatValue(entry.value, entry.txt_value, entry.metric || "")}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}