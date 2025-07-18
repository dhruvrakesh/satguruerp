import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';

interface DuplicateGroup {
  item_name: string;
  count: number;
  oldest_id: string;
  newest_id: string;
  oldest_date: string;
  newest_date: string;
}

export function ItemMasterCleanup() {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const { toast } = useToast();

  const findDuplicates = async () => {
    setIsLoading(true);
    try {
      // Direct query to find duplicates
      const { data: rawData, error: queryError } = await supabase
          .from('item_master')
          .select('item_name, id, created_at, updated_at')
        .order('item_name');

      if (queryError) throw queryError;

      // Group by item_name
      const groups = rawData?.reduce((acc: any, item: any) => {
        if (!acc[item.item_name]) {
          acc[item.item_name] = [];
        }
        acc[item.item_name].push(item);
        return acc;
      }, {});

      // Find duplicates
      const duplicateGroups: DuplicateGroup[] = Object.keys(groups || {})
        .filter(name => groups[name].length > 1)
        .map(name => {
          const items = groups[name];
          const sorted = items.sort((a: any, b: any) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          return {
            item_name: name,
            count: items.length,
            oldest_id: sorted[0].id,
            newest_id: sorted[sorted.length - 1].id,
            oldest_date: sorted[0].created_at,
            newest_date: sorted[sorted.length - 1].created_at
          };
        });

      setDuplicates(duplicateGroups);

      toast({
        title: "Duplicate Analysis Complete",
        description: `Found ${duplicateGroups.length} items with duplicates`
      });
    } catch (error: any) {
      console.error('Error finding duplicates:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const identifyItemToKeep = async (items: any[]) => {
    // Check which items have stock references
    const itemsWithStock = [];
    const itemsWithoutStock = [];

    for (const item of items) {
      const { data: stockData } = await supabase
        .from('stock')
        .select('current_qty')
        .eq('item_code', item.item_code)
        .single();

      const { data: satguruStockData } = await supabase
        .from('satguru_stock')
        .select('current_qty')
        .eq('item_code', item.item_code)
        .single();

      if (stockData || satguruStockData) {
        itemsWithStock.push({
          ...item,
          totalStock: (stockData?.current_qty || 0) + (satguruStockData?.current_qty || 0)
        });
      } else {
        itemsWithoutStock.push(item);
      }
    }

    // Priority logic: keep items with stock references
    if (itemsWithStock.length > 0) {
      // Among items with stock, keep the one with the most stock activity
      const itemToKeep = itemsWithStock.sort((a, b) => b.totalStock - a.totalStock)[0];
      const itemsToRemove = [...itemsWithStock.slice(1), ...itemsWithoutStock];
      return { itemToKeep, itemsToRemove, hasStockConflicts: itemsWithStock.length > 1 };
    } else {
      // If no items have stock, keep the most recently updated
      const sorted = items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      return { 
        itemToKeep: sorted[0], 
        itemsToRemove: sorted.slice(1), 
        hasStockConflicts: false 
      };
    }
  };

  const mergeStockData = async (keepItemCode: string, removeItemCode: string) => {
    console.log(`Merging stock data from ${removeItemCode} to ${keepItemCode}`);

    // Handle stock table
    const { data: keepStock } = await supabase
      .from('stock')
      .select('*')
      .eq('item_code', keepItemCode)
      .single();

    const { data: removeStock } = await supabase
      .from('stock')
      .select('*')
      .eq('item_code', removeItemCode)
      .single();

    if (removeStock) {
      if (keepStock) {
        // Merge quantities and delete duplicate
        await supabase
          .from('stock')
          .update({ 
            current_qty: keepStock.current_qty + removeStock.current_qty,
            last_updated: new Date().toISOString()
          })
          .eq('item_code', keepItemCode);
        
        await supabase
          .from('stock')
          .delete()
          .eq('item_code', removeItemCode);
      } else {
        // Update item_code
        await supabase
          .from('stock')
          .update({ item_code: keepItemCode })
          .eq('item_code', removeItemCode);
      }
    }

    // Handle satguru_stock table
    const { data: keepSatguruStock } = await supabase
      .from('satguru_stock')
      .select('*')
      .eq('item_code', keepItemCode)
      .single();

    const { data: removeSatguruStock } = await supabase
      .from('satguru_stock')
      .select('*')
      .eq('item_code', removeItemCode)
      .single();

    if (removeSatguruStock) {
      if (keepSatguruStock) {
        // Merge quantities and delete duplicate
        await supabase
          .from('satguru_stock')
          .update({ 
            current_qty: keepSatguruStock.current_qty + removeSatguruStock.current_qty,
            last_updated: new Date().toISOString()
          })
          .eq('item_code', keepItemCode);
        
        await supabase
          .from('satguru_stock')
          .delete()
          .eq('item_code', removeItemCode);
      } else {
        // Update item_code
        await supabase
          .from('satguru_stock')
          .update({ item_code: keepItemCode })
          .eq('item_code', removeItemCode);
      }
    }

    // Handle daily_stock_summary table with date-based merging
    const { data: removeRecords } = await supabase
      .from('daily_stock_summary')
      .select('*')
      .eq('item_code', removeItemCode);

    if (removeRecords && removeRecords.length > 0) {
      for (const record of removeRecords) {
        const { data: existingRecord } = await supabase
          .from('daily_stock_summary')
          .select('*')
          .eq('item_code', keepItemCode)
          .eq('summary_date', record.summary_date)
          .single();

        if (existingRecord) {
          // Merge quantities for same date
          await supabase
            .from('daily_stock_summary')
            .update({
              opening_qty: existingRecord.opening_qty + record.opening_qty,
              received_qty: existingRecord.received_qty + record.received_qty,
              issued_qty: existingRecord.issued_qty + record.issued_qty,
              closing_qty: existingRecord.closing_qty + record.closing_qty
            })
            .eq('item_code', keepItemCode)
            .eq('summary_date', record.summary_date);
        } else {
          // Update item_code for unique dates
          await supabase
            .from('daily_stock_summary')
            .update({ item_code: keepItemCode })
            .eq('id', record.id);
        }
      }

      // Clean up any remaining duplicate records
      await supabase
        .from('daily_stock_summary')
        .delete()
        .eq('item_code', removeItemCode);
    }
  };

  const updateLogTables = async (keepItemCode: string, removeItemCode: string) => {
    // Update grn_log (no unique constraints on item_code)
    await supabase
      .from('grn_log')
      .update({ item_code: keepItemCode })
      .eq('item_code', removeItemCode);
    
    // Update issue_log (no unique constraints on item_code)
    await supabase
      .from('issue_log')
      .update({ item_code: keepItemCode })
      .eq('item_code', removeItemCode);
  };

  const cleanupDuplicates = async () => {
    if (duplicates.length === 0) return;

    setIsCleaningUp(true);
    let cleaned = 0;
    let errors = 0;

    try {
      for (const group of duplicates) {
        try {
          console.log(`Processing duplicate group: ${group.item_name}`);
          
          // Get all items for this name
          const { data: items, error: fetchError } = await supabase
            .from('item_master')
            .select('*')
            .eq('item_name', group.item_name);

          if (fetchError) throw fetchError;

          if (items && items.length > 1) {
            // Identify which item to keep and which to remove
            const { itemToKeep, itemsToRemove, hasStockConflicts } = await identifyItemToKeep(items);
            
            console.log(`Keeping item: ${itemToKeep.item_code}, removing: ${itemsToRemove.map(i => i.item_code).join(', ')}`);
            
            // Process each item to remove
            for (const item of itemsToRemove) {
              try {
                // If this item has stock references and we're merging, handle stock data
                if (hasStockConflicts || await hasStockReferences(item.item_code)) {
                  await mergeStockData(itemToKeep.item_code, item.item_code);
                }
                
                // Update log tables (safe to do always)
                await updateLogTables(itemToKeep.item_code, item.item_code);
                
                // Now safe to delete the duplicate item
                const { error: deleteError } = await supabase
                  .from('item_master')
                  .delete()
                  .eq('id', item.id);

                if (deleteError) {
                  console.error(`Error deleting item ${item.id}:`, deleteError);
                  errors++;
                } else {
                  console.log(`Successfully deleted duplicate item ${item.item_code}`);
                  cleaned++;
                }
              } catch (itemError) {
                console.error(`Error processing item ${item.id}:`, itemError);
                errors++;
              }
            }
          }
        } catch (error) {
          console.error(`Error processing group ${group.item_name}:`, error);
          errors++;
        }
      }

      toast({
        title: "Cleanup Complete",
        description: `Removed ${cleaned} duplicate records. ${errors > 0 ? `${errors} errors occurred.` : ''}`
      });

      // Refresh the duplicates list
      await findDuplicates();
    } catch (error: any) {
      console.error('Cleanup error:', error);
      toast({
        title: "Cleanup Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const hasStockReferences = async (itemCode: string) => {
    const { data: stockData } = await supabase
      .from('stock')
      .select('item_code')
      .eq('item_code', itemCode)
      .single();

    const { data: satguruStockData } = await supabase
      .from('satguru_stock')
      .select('item_code')
      .eq('item_code', itemCode)
      .single();

    return !!(stockData || satguruStockData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Item Master Cleanup
        </CardTitle>
        <CardDescription>
          Find and remove duplicate item names while preserving stock references and data integrity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={findDuplicates} 
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? 'Scanning...' : 'Find Duplicates'}
          </Button>
          
          {duplicates.length > 0 && (
            <Button 
              onClick={cleanupDuplicates}
              disabled={isCleaningUp}
              variant="destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isCleaningUp ? 'Cleaning...' : `Remove ${duplicates.length} Duplicates`}
            </Button>
          )}
        </div>

        {duplicates.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Found {duplicates.length} items with duplicate names. 
              Cleanup will prioritize keeping items with existing stock references and merge all related data safely.
            </AlertDescription>
          </Alert>
        )}

        {duplicates.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {duplicates.slice(0, 10).map((group, index) => (
              <div key={index} className="text-sm p-2 bg-muted rounded">
                <strong>{group.item_name}</strong> - {group.count} duplicates
              </div>
            ))}
            {duplicates.length > 10 && (
              <div className="text-sm text-muted-foreground">
                ... and {duplicates.length - 10} more
              </div>
            )}
          </div>
        )}

        {duplicates.length === 0 && !isLoading && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              No duplicates found. Your item master data is clean!
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
