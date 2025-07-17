import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const recentOrders = [
  {
    id: "ORD-2024-001",
    customer: "Packaging Solutions Ltd",
    product: "Custom Label Sheets",
    quantity: "5,000 units",
    status: "In Production",
    statusColor: "bg-accent" as const,
    amount: "₹45,000",
    dueDate: "2024-01-28"
  },
  {
    id: "ORD-2024-002", 
    customer: "Fresh Foods Co",
    product: "Food Grade Packaging",
    quantity: "10,000 units",
    status: "Pending",
    statusColor: "bg-muted" as const,
    amount: "₹87,500",
    dueDate: "2024-01-30"
  },
  {
    id: "ORD-2024-003",
    customer: "Retail Chain Ltd",
    product: "Promotional Stickers",
    quantity: "25,000 units", 
    status: "Completed",
    statusColor: "bg-green-500" as const,
    amount: "₹32,000",
    dueDate: "2024-01-25"
  },
  {
    id: "ORD-2024-004",
    customer: "Electronics Corp",
    product: "Component Labels",
    quantity: "15,000 units",
    status: "Quality Check",
    statusColor: "bg-blue-500" as const,
    amount: "₹68,000",
    dueDate: "2024-01-29"
  }
];

export function RecentOrders() {
  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Recent Orders</CardTitle>
          <Button variant="outline" size="sm">
            View All
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-medium text-foreground">{order.id}</span>
                  <Badge className={`${order.statusColor} text-white`}>
                    {order.status}
                  </Badge>
                </div>
                <h4 className="font-medium text-foreground mb-1">{order.customer}</h4>
                <p className="text-sm text-muted-foreground">{order.product}</p>
                <p className="text-sm text-muted-foreground">{order.quantity}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">{order.amount}</p>
                <p className="text-sm text-muted-foreground">Due: {order.dueDate}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}