
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface IntegrityCheckResult {
  totalItems: number;
  itemsWithStock: number;
  itemsWithoutStock: number;
  negativeStockItems: number;
  calculationErrors: any[];
}

export const useStockIntegrityCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();

  const runIntegrityCheck = async (): Promise<IntegrityCheckResult | null> => {
    setIsChecking(true);
    
    try {
      console.log('Running stock integrity check...');

      // Check total items
      const { count: totalItems } = await supabase
        .from('satguru_item_master')
        .select('*', { count: 'exact', head: true });

      // Check items with stock from summary view
      const { data: stockData } = await supabase
        .from('satguru_stock_summary_view')
        .select('item_code, current_stock');

      const itemsWithStock = stockData?.filter(item => item.current_stock > 0).length || 0;
      const itemsWithoutStock = (stockData?.length || 0) - itemsWithStock;
      const negativeStockItems = stockData?.filter(item => item.current_stock < 0).length || 0;

      // Check for calculation errors by comparing stock summary with raw transactions
      const { data: rawTransactions } = await supabase
        .from('satguru_grn_items')
        .select(`
          item_code,
          quantity,
          transaction_type
        `);

      const calculationErrors: any[] = [];
      
      // Simple validation - check if any stock calculations seem off
      if (rawTransactions && stockData) {
        const transactionSummary = rawTransactions.reduce((acc: any, txn) => {
          if (!acc[txn.item_code]) acc[txn.item_code] = 0;
          
          if (txn.transaction_type === 'GRN' || txn.transaction_type === 'OPENING_STOCK') {
            acc[txn.item_code] += txn.quantity;
          } else if (txn.transaction_type === 'ISSUE') {
            acc[txn.item_code] -= txn.quantity;
          }
          
          return acc;
        }, {});

        for (const stockItem of stockData) {
          const calculatedStock = transactionSummary[stockItem.item_code] || 0;
          const viewStock = stockItem.current_stock;
          
          if (Math.abs(calculatedStock - viewStock) > 0.01) {
            calculationErrors.push({
              item_code: stockItem.item_code,
              calculated: calculatedStock,
              view_shows: viewStock,
              difference: calculatedStock - viewStock
            });
          }
        }
      }

      const result: IntegrityCheckResult = {
        totalItems: totalItems || 0,
        itemsWithStock,
        itemsWithoutStock,
        negativeStockItems,
        calculationErrors
      };

      console.log('Integrity check completed:', result);

      if (calculationErrors.length > 0) {
        toast({
          title: "Stock Calculation Issues Found",
          description: `Found ${calculationErrors.length} items with calculation discrepancies`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Stock Integrity Check Complete",
          description: "No calculation errors found",
        });
      }

      return result;
      
    } catch (error) {
      console.error('Error running integrity check:', error);
      toast({
        title: "Integrity Check Failed",
        description: "Failed to complete stock integrity check",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  return {
    runIntegrityCheck,
    isChecking
  };
};
