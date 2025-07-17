import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";

interface StockAlert {
  item_code: string;
  item_name: string;
  current_qty: number;
  reorder_level: number;
  stock_status: string;
  category_name: string;
}

export function StockAlertsPanel() {
  const { data: alerts, isLoading, error } = useQuery({
    queryKey: ["stock-alerts"],
    queryFn: async (): Promise<StockAlert[]> => {
      const { data, error } = await supabase
        .from("satguru_stock_summary_view")
        .select("*")
        .or("stock_status.eq.LOW,stock_status.eq.ZERO")
        .order("current_qty", { ascending: true })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const getDaysOfCover = (currentQty: number, dailyConsumption: number = 1) => {
    if (dailyConsumption <= 0) return Infinity;
    return Math.floor(currentQty / dailyConsumption);
  };

  const getCoverBadgeColor = (days: number) => {
    if (days === 0) return "bg-red-600";
    if (days <= 7) return "bg-red-500";
    if (days <= 30) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getCoverText = (days: number) => {
    if (days === 0) return "Out of Stock";
    if (days === Infinity) return "N/A";
    return `${days} days`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Stock Alerts & Warnings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !alerts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Stock Alerts & Warnings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40">
          <p className="text-muted-foreground">Unable to load alerts</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Stock Alerts & Warnings
            {alerts.length > 0 && (
              <Badge className="bg-red-500 text-white ml-2">
                {alerts.length}
              </Badge>
            )}
          </CardTitle>
          <Button variant="outline" size="sm">
            View All
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground">No stock alerts at this time</p>
            <p className="text-sm text-muted-foreground mt-1">All items are adequately stocked</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const daysOfCover = getDaysOfCover(alert.current_qty, 1);
              return (
                <div 
                  key={alert.item_code} 
                  className="flex items-center justify-between p-3 border border-red-200/50 bg-red-50/30 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium text-foreground">{alert.item_code}</span>
                      <Badge className={`${alert.stock_status === 'ZERO' ? 'bg-red-600' : 'bg-yellow-500'} text-white`}>
                        {alert.stock_status}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground">{alert.item_name || alert.item_code}</p>
                    <p className="text-xs text-muted-foreground">
                      Category: {alert.category_name || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {alert.current_qty} units
                      </span>
                    </div>
                    <Badge className={`${getCoverBadgeColor(daysOfCover)} text-white text-xs`}>
                      {getCoverText(daysOfCover)}
                    </Badge>
                    {alert.reorder_level && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Reorder at: {alert.reorder_level}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}