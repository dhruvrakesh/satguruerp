
import { AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface StockValidationAlertProps {
  itemCode: string;
  currentStock: number;
  requestedQuantity: number;
  uom: string;
  stockStatus: string;
  reorderPoint?: number;
  avgConsumption?: number;
}

export function StockValidationAlert({
  itemCode,
  currentStock,
  requestedQuantity,
  uom,
  stockStatus,
  reorderPoint = 0,
  avgConsumption = 0
}: StockValidationAlertProps) {
  const getAlertType = () => {
    if (stockStatus === 'out_of_stock') return 'destructive';
    if (stockStatus === 'low_stock') return 'warning';
    if (currentStock > reorderPoint * 3) return 'info'; // Overstock warning
    return 'default';
  };

  const getIcon = () => {
    if (stockStatus === 'out_of_stock') return <AlertCircle className="h-4 w-4" />;
    if (stockStatus === 'low_stock') return <AlertTriangle className="h-4 w-4" />;
    if (currentStock > reorderPoint * 3) return <AlertCircle className="h-4 w-4 text-blue-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getMessage = () => {
    if (stockStatus === 'out_of_stock') {
      return `Item ${itemCode} is out of stock. Current stock: ${currentStock} ${uom}`;
    }
    if (stockStatus === 'low_stock') {
      return `Item ${itemCode} is running low. Current stock: ${currentStock} ${uom}, Reorder point: ${reorderPoint} ${uom}`;
    }
    if (currentStock > reorderPoint * 3) {
      return `Item ${itemCode} appears to be overstocked. Current stock: ${currentStock} ${uom}, Average monthly consumption: ${avgConsumption.toFixed(2)} ${uom}`;
    }
    return `Stock level is normal for ${itemCode}. Current stock: ${currentStock} ${uom}`;
  };

  const getRecommendation = () => {
    if (stockStatus === 'out_of_stock') {
      return "Consider expedited delivery or alternative suppliers.";
    }
    if (stockStatus === 'low_stock') {
      return `Consider ordering ${Math.max(reorderPoint - currentStock, requestedQuantity)} ${uom} to maintain adequate stock levels.`;
    }
    if (currentStock > reorderPoint * 3) {
      return "Consider reducing order quantity to optimize inventory costs.";
    }
    return "Stock levels are within normal range.";
  };

  return (
    <Alert variant={getAlertType() as any} className="mt-2">
      <div className="flex items-start gap-2">
        {getIcon()}
        <div className="flex-1">
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">{getMessage()}</p>
              <p className="text-sm text-muted-foreground">{getRecommendation()}</p>
              {avgConsumption > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    Avg Monthly Consumption: {avgConsumption.toFixed(2)} {uom}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Reorder Point: {reorderPoint} {uom}
                  </Badge>
                </div>
              )}
            </div>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}
