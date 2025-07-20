
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
    const stockInfo = stockData?.find(s => s.itemCode === item_code);
    
    if (!stockInfo) {
      return {
        itemCode: item_code,
        qtyRequested: qty_issued,
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

    if (currentStock >= qty_issued) {
      status = 'sufficient';
      suggestion = `Stock available. Current: ${currentStock}, Requested: ${qty_issued}`;
    } else if (currentStock > 0) {
      status = 'insufficient';
      suggestion = `Insufficient stock. Available: ${currentStock}, Requested: ${qty_issued}. Consider reducing quantity.`;
    } else {
      status = 'critical';
      suggestion = `No stock available. Current stock: ${currentStock}. Cannot process this issue.`;
    }

    return {
      itemCode: item_code,
      itemName,
      qtyRequested: qty_issued,
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
