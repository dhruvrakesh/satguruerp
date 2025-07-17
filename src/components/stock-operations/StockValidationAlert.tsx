import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, TrendingDown } from "lucide-react";
import { useStockValidation } from "@/hooks/useStockValidation";

interface StockValidationAlertProps {
  itemCode?: string;
  requestedQuantity?: number;
  className?: string;
}

export function StockValidationAlert({ 
  itemCode, 
  requestedQuantity = 0, 
  className = "" 
}: StockValidationAlertProps) {
  const [showAlert, setShowAlert] = useState(false);
  const { data: stockData, isLoading } = useStockValidation(itemCode);

  useEffect(() => {
    if (stockData && requestedQuantity > 0) {
      setShowAlert(true);
    } else {
      setShowAlert(false);
    }
  }, [stockData, requestedQuantity]);

  if (!showAlert || isLoading || !stockData) {
    return null;
  }

  const { available, isAvailable, itemName } = stockData;
  const remainingAfterIssue = available - requestedQuantity;

  const getAlertVariant = () => {
    if (!isAvailable) return "destructive";
    if (remainingAfterIssue < 10) return "warning";
    return "default";
  };

  const getIcon = () => {
    if (!isAvailable) return <AlertTriangle className="h-4 w-4" />;
    if (remainingAfterIssue < 10) return <TrendingDown className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const getStockStatus = () => {
    if (!isAvailable) return "Insufficient Stock";
    if (remainingAfterIssue < 10) return "Low Stock Warning";
    return "Stock Available";
  };

  const getStatusColor = () => {
    if (!isAvailable) return "destructive";
    if (remainingAfterIssue < 10) return "secondary";
    return "default";
  };

  return (
    <Alert variant={getAlertVariant() as any} className={className}>
      {getIcon()}
      <AlertDescription>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{itemName}</span>
            <Badge variant={getStatusColor() as any}>
              {getStockStatus()}
            </Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Available:</span>
              <div className="font-medium">{available} units</div>
            </div>
            <div>
              <span className="text-muted-foreground">Requested:</span>
              <div className="font-medium">{requestedQuantity} units</div>
            </div>
            <div>
              <span className="text-muted-foreground">Remaining:</span>
              <div className={`font-medium ${remainingAfterIssue < 0 ? 'text-red-600' : remainingAfterIssue < 10 ? 'text-orange-600' : 'text-green-600'}`}>
                {remainingAfterIssue} units
              </div>
            </div>
          </div>

          {!isAvailable && (
            <div className="text-sm text-red-600 font-medium">
              Cannot proceed: Insufficient stock available
            </div>
          )}

          {isAvailable && remainingAfterIssue < 10 && remainingAfterIssue >= 0 && (
            <div className="text-sm text-orange-600">
              Warning: Stock will be critically low after this issue
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}