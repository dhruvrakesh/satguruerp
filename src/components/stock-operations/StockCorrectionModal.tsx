
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  CheckCircle, 
  Package, 
  Edit3,
  Save,
  X 
} from "lucide-react";
import { BulkValidationResult, CorrectedRecord } from "@/hooks/useBulkIssueValidation";

interface StockCorrectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insufficientStockItems: BulkValidationResult[];
  onApplyCorrections: (corrections: CorrectedRecord[]) => void;
  onRevalidate: () => void;
  existingCorrections: CorrectedRecord[];
}

export function StockCorrectionModal({
  open,
  onOpenChange,
  insufficientStockItems,
  onApplyCorrections,
  onRevalidate,
  existingCorrections
}: StockCorrectionModalProps) {
  const [corrections, setCorrections] = useState<Map<number, number>>(new Map());
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    // Initialize with existing corrections
    const correctionMap = new Map<number, number>();
    existingCorrections.forEach(correction => {
      correctionMap.set(correction.rowIndex, correction.corrected_qty);
    });
    setCorrections(correctionMap);
  }, [existingCorrections]);

  const handleQuantityChange = (rowIndex: number, newQuantity: string) => {
    const qty = parseFloat(newQuantity);
    if (!isNaN(qty) && qty >= 0) {
      setCorrections(prev => {
        const newMap = new Map(prev);
        newMap.set(rowIndex, qty);
        return newMap;
      });
    }
  };

  const handleApplyCorrections = async () => {
    setIsApplying(true);
    try {
      const correctionArray: CorrectedRecord[] = [];
      
      corrections.forEach((correctedQty, rowIndex) => {
        const item = insufficientStockItems.find(i => i.row_num === rowIndex + 1);
        if (item) {
          correctionArray.push({
            rowIndex,
            item_code: item.item_code,
            original_qty: item.requested_qty,
            corrected_qty: correctedQty,
            available_qty: item.available_qty
          });
        }
      });

      onApplyCorrections(correctionArray);
      
      // Trigger revalidation
      await onRevalidate();
      
      onOpenChange(false);
    } finally {
      setIsApplying(false);
    }
  };

  const getCorrectedQuantity = (rowIndex: number): number => {
    return corrections.get(rowIndex) || 0;
  };

  const getStatusAfterCorrection = (item: BulkValidationResult, correctedQty: number) => {
    if (correctedQty <= item.available_qty) {
      return { status: 'sufficient', color: 'text-green-600 bg-green-50' };
    } else if (correctedQty <= item.available_qty * 1.2) {
      return { status: 'close', color: 'text-yellow-600 bg-yellow-50' };
    } else {
      return { status: 'still_insufficient', color: 'text-red-600 bg-red-50' };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock Correction - Fix Insufficient Quantities
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{insufficientStockItems.length} items</strong> have insufficient stock. 
              Adjust quantities below to match available stock levels.
            </AlertDescription>
          </Alert>

          <ScrollArea className="h-96">
            <div className="space-y-3">
              {insufficientStockItems.map((item, index) => {
                const rowIndex = item.row_num - 1;
                const correctedQty = getCorrectedQuantity(rowIndex);
                const status = getStatusAfterCorrection(item, correctedQty);
                
                return (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">Row {item.row_num}</Badge>
                        <span className="font-medium">{item.item_code}</span>
                        <span className="text-sm text-muted-foreground">
                          {item.item_name}
                        </span>
                      </div>
                      <Badge className="text-red-600 bg-red-50">
                        Insufficient Stock
                      </Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-3">
                      <div className="text-center">
                        <Label className="text-xs text-muted-foreground">Available</Label>
                        <div className="text-lg font-semibold text-green-600">
                          {item.available_qty}
                        </div>
                      </div>
                      <div className="text-center">
                        <Label className="text-xs text-muted-foreground">Requested</Label>
                        <div className="text-lg font-semibold text-red-600">
                          {item.requested_qty}
                        </div>
                      </div>
                      <div className="text-center">
                        <Label className="text-xs text-muted-foreground">Shortage</Label>
                        <div className="text-lg font-semibold text-orange-600">
                          {item.requested_qty - item.available_qty}
                        </div>
                      </div>
                      <div className="text-center">
                        <Label className="text-xs text-muted-foreground">Status After Fix</Label>
                        <Badge className={status.color}>
                          {status.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label htmlFor={`qty-${rowIndex}`} className="text-sm font-medium">
                        Corrected Quantity:
                      </Label>
                      <Input
                        id={`qty-${rowIndex}`}
                        type="number"
                        value={correctedQty}
                        onChange={(e) => handleQuantityChange(rowIndex, e.target.value)}
                        className="w-32"
                        min="0"
                        max={item.available_qty}
                        step="0.01"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuantityChange(rowIndex, item.available_qty.toString())}
                      >
                        Use Available ({item.available_qty})
                      </Button>
                    </div>

                    {correctedQty > item.available_qty && (
                      <Alert className="mt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          Corrected quantity ({correctedQty}) still exceeds available stock ({item.available_qty})
                        </AlertDescription>
                      </Alert>
                    )}
                  </Card>
                );
              })}
            </div>
          </ScrollArea>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {corrections.size} corrections applied
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isApplying}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleApplyCorrections}
                disabled={isApplying || corrections.size === 0}
              >
                <Save className="w-4 h-4 mr-2" />
                {isApplying ? 'Applying...' : `Apply ${corrections.size} Corrections`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
