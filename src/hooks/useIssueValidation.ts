
import { useQuery } from "@tanstack/react-query";
import { useStockCalculation } from "./useStockCalculation";

export interface IssueValidationResult {
  itemCode: string;
  itemName?: string;
  qtyRequested: number;
  availableStock: number;
  status: 'sufficient' | 'insufficient' | 'critical' | 'not_found';
  suggestion?: string;
  stockDetails: {
    openingStock: number;
    totalGRNs: number;
    totalIssues: number;
    currentStock: number;
  };
}

export function useIssueValidation(
  items: Array<{ item_code: string; qty_issued: number }>,
  openingStockDate: string = '2024-01-01'
) {
  const itemCodes = items.map(i => i.item_code).filter(Boolean);
  const { data: stockData, isLoading, error } = useStockCalculation(itemCodes, openingStockDate);

  const validationResults: IssueValidationResult[] = items.map(({ item_code, qty_issued }) => {
    // Ensure we have valid numeric input
    const requestedQty = Number(qty_issued) || 0;
    
    if (requestedQty <= 0) {
      return {
        itemCode: item_code,
        qtyRequested: requestedQty,
        availableStock: 0,
        status: 'critical' as const,
        suggestion: `Invalid quantity requested: ${requestedQty}. Quantity must be greater than 0.`,
        stockDetails: {
          openingStock: 0,
          totalGRNs: 0,
          totalIssues: 0,
          currentStock: 0
        }
      };
    }
    
    const stockInfo = stockData?.find(s => s.itemCode === item_code);
    
    if (!stockInfo) {
      return {
        itemCode: item_code,
        qtyRequested: requestedQty,
        availableStock: 0,
        status: 'not_found' as const,
        suggestion: `Item code not found in master data. Please verify the item code.`,
        stockDetails: {
          openingStock: 0,
          totalGRNs: 0,
          totalIssues: 0,
          currentStock: 0
        }
      };
    }

    const { currentStock, itemName, openingStock, totalGRNs, totalIssues } = stockInfo;
    let status: IssueValidationResult['status'] = 'sufficient';
    let suggestion = '';

    // Use the same stock calculation logic as the updated backend function
    if (currentStock >= requestedQty) {
      status = 'sufficient';
      const remainingStock = currentStock - requestedQty;
      suggestion = `✓ Stock sufficient. Available: ${currentStock} KG, Requesting: ${requestedQty} KG, Remaining: ${remainingStock} KG`;
    } else if (currentStock > 0) {
      status = 'insufficient';
      const shortage = requestedQty - currentStock;
      suggestion = `⚠ Insufficient stock. Available: ${currentStock} KG, Requesting: ${requestedQty} KG, Short by: ${shortage} KG`;
    } else {
      status = 'critical';
      suggestion = `❌ No stock available. Current stock: ${currentStock} KG, Cannot issue ${requestedQty} KG`;
    }

    return {
      itemCode: item_code,
      itemName: itemName || '',
      qtyRequested: requestedQty,
      availableStock: currentStock,
      status,
      suggestion,
      stockDetails: {
        openingStock,
        totalGRNs,
        totalIssues,
        currentStock
      }
    };
  });

  return {
    data: validationResults,
    isLoading,
    error
  };
}
