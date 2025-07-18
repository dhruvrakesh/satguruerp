
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
  oldest_item_code: string;
  oldest_created_at: string;
  items_to_remove: Array<{
    id: string;
    item_code: string;
    created_at: string;
    has_stock: boolean;
  }>;
}

export function ItemMasterCleanup() {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const { toast } = useToast();

  const findDuplicates = async () => {
    setIsLoading(true);
    try {
      // Get all items with their creation dates
      const { data: allItems, error: queryError } = await supabase
        .from('item_master')
        .select('item_name, id, item_code, created_at')
        .order('item_name');

      if (queryError) throw queryError;

      // Group by item_name and identify duplicates
      const groups = allItems?.reduce((acc: any, item: any) => {
        if (!acc[item.item_name]) {
          acc[item.item_name] = [];
        }
        acc[item.item_name].push(item);
        return acc;
      }, {});

      const duplicateGroups: DuplicateGroup[] = [];

      for (const [itemName, items] of Object.entries(groups || {})) {
        const itemList = items as any[];
        if (itemList.length > 1) {
          // Sort by created_at to find the oldest
          const sortedItems = itemList.sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          const oldestItem = sortedItems[0];
          const itemsToRemove = sortedItems.slice(1);

          // Check which items to remove have stock references
          const itemsToRemoveWithStockCheck = [];
          for (const item of itemsToRemove) {
            const { data: stockData } = await supabase
              .from('stock')
              .select('item_code')
              .eq('item_code', item.item_code)
              .maybeSingle();

            const { data: satguruStockData } = await supabase
              .from('satguru_stock')
              .select('item_code')
              .eq('item_code', item.item_code)
              .maybeSingle();

            itemsToRemoveWithStockCheck.push({
              ...item,
              has_stock: !!(stockData || satguruStockData)
            });
          }

          duplicateGroups.push({
            item_name: itemName,
            count: itemList.length,
            oldest_item_code: oldestItem.item_code,
            oldest_created_at: oldestItem.created_at,
            items_to_remove: itemsToRemoveWithStockCheck
          });
        }
      }

      setDuplicates(duplicateGroups);

      const totalToRemove = duplicateGroups.reduce((sum, group) => sum + group.items_to_remove.length, 0);
      const withStock = duplicateGroups.reduce((sum, group) => 
        sum + group.items_to_remove.filter(item => item.has_stock).length, 0
      );

      toast({
        title: "Duplicate Analysis Complete",
        description: `Found ${duplicateGroups.length} duplicate groups with ${totalToRemove} items to remove (${withStock} have stock references)`
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

  const transferStockData = async (fromItemCode: string, toItemCode: string) => {
    console.log(`Transferring stock data from ${fromItemCode} to ${toItemCode}`);

    // Handle main stock table
    const { data: fromStock } = await supabase
      .from('stock')
      .select('*')
      .eq('item_code', fromItemCode)
      .maybeSingle();

    const { data: toStock } = await supabase
      .from('stock')
      .select('*')
      .eq('item_code', toItemCode)
      .maybeSingle();

    if (fromStock) {
      if (toStock) {
        // Merge quantities
        await supabase
          .from('stock')
          .update({ 
            current_qty: toStock.current_qty + fromStock.current_qty,
            last_updated: new Date().toISOString()
          })
          .eq('item_code', toItemCode);
        
        await supabase
          .from('stock')
          .delete()
          .eq('item_code', fromItemCode);
      } else {
        // Transfer the record
        await supabase
          .from('stock')
          .update({ item_code: toItemCode })
          .eq('item_code', fromItemCode);
      }
    }

    // Handle satguru_stock table
    const { data: fromSatguruStock } = await supabase
      .from('satguru_stock')
      .select('*')
      .eq('item_code', fromItemCode)
      .maybeSingle();

    const { data: toSatguruStock } = await supabase
      .from('satguru_stock')
      .select('*')
      .eq('item_code', toItemCode)
      .maybeSingle();

    if (fromSatguruStock) {
      if (toSatguruStock) {
        // Merge quantities
        await supabase
          .from('satguru_stock')
          .update({ 
            current_qty: toSatguruStock.current_qty + fromSatguruStock.current_qty,
            last_updated: new Date().toISOString()
          })
          .eq('item_code', toItemCode);
        
        await supabase
          .from('satguru_stock')
          .delete()
          .eq('item_code', fromItemCode);
      } else {
        // Transfer the record
        await supabase
          .from('satguru_stock')
          .update({ item_code: toItemCode })
          .eq('item_code', fromItemCode);
      }
    }

    // Handle daily_stock_summary with date-based merging
    const { data: fromSummaryRecords } = await supabase
      .from('daily_stock_summary')
      .select('*')
      .eq('item_code', fromItemCode);

    if (fromSummaryRecords && fromSummaryRecords.length > 0) {
      for (const record of fromSummaryRecords) {
        const { data: existingRecord } = await supabase
          .from('daily_stock_summary')
          .select('*')
          .eq('item_code', toItemCode)
          .eq('summary_date', record.summary_date)
          .maybeSingle();

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
            .eq('item_code', toItemCode)
            .eq('summary_date', record.summary_date);
        } else {
          // Update item_code for unique dates
          await supabase
            .from('daily_stock_summary')
            .update({ item_code: toItemCode })
            .eq('id', record.id);
        }
      }

      // Clean up remaining records
      await supabase
        .from('daily_stock_summary')
        .delete()
        .eq('item_code', fromItemCode);
    }

    // Update log tables (safe to do always)
    await supabase
      .from('grn_log')
      .update({ item_code: toItemCode })
      .eq('item_code', fromItemCode);
    
    await supabase
      .from('issue_log')
      .update({ item_code: toItemCode })
      .eq('item_code', fromItemCode);
  };

  const cleanupDuplicates = async () => {
    if (duplicates.length === 0) return;

    setIsCleaningUp(true);
    let cleaned = 0;
    let transferred = 0;
    let errors = 0;

    try {
      for (const group of duplicates) {
        try {
          console.log(`Processing duplicate group: ${group.item_name}`);
          console.log(`Keeping oldest item_code: ${group.oldest_item_code}`);
          
          for (const itemToRemove of group.items_to_remove) {
            try {
              console.log(`Processing item to remove: ${itemToRemove.item_code} (has_stock: ${itemToRemove.has_stock})`);
              
              // If item has stock references, transfer data first
              if (itemToRemove.has_stock) {
                await transferStockData(itemToRemove.item_code, group.oldest_item_code);
                transferred++;
                console.log(`Successfully transferred stock data from ${itemToRemove.item_code} to ${group.oldest_item_code}`);
              }
              
              // Now safe to delete the duplicate item
              const { error: deleteError } = await supabase
                .from('item_master')
                .delete()
                .eq('id', itemToRemove.id);

              if (deleteError) {
                console.error(`Error deleting item ${itemToRemove.id}:`, deleteError);
                errors++;
              } else {
                console.log(`Successfully deleted duplicate item ${itemToRemove.item_code}`);
                cleaned++;
              }
            } catch (itemError) {
              console.error(`Error processing item ${itemToRemove.id}:`, itemError);
              errors++;
            }
          }
        } catch (error) {
          console.error(`Error processing group ${group.item_name}:`, error);
          errors++;
        }
      }

      toast({
        title: "Cleanup Complete",
        description: `Removed ${cleaned} duplicate records. Transferred stock data for ${transferred} items. ${errors > 0 ? `${errors} errors occurred.` : ''}`
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Item Master Cleanup - Duplicate Names
        </CardTitle>
        <CardDescription>
          Find duplicate item names and keep the oldest item_code while safely transferring all related data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={findDuplicates} 
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? 'Scanning...' : 'Find Duplicate Names'}
          </Button>
          
          {duplicates.length > 0 && (
            <Button 
              onClick={cleanupDuplicates}
              disabled={isCleaningUp}
              variant="destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isCleaningUp ? 'Cleaning...' : `Clean ${duplicates.reduce((sum, group) => sum + group.items_to_remove.length, 0)} Duplicates`}
            </Button>
          )}
        </div>

        {duplicates.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Found {duplicates.length} duplicate item name groups with {duplicates.reduce((sum, group) => sum + group.items_to_remove.length, 0)} items to remove.
              Strategy: Keep oldest item_code for each name, transfer stock data safely, then delete duplicates.
            </AlertDescription>
          </Alert>
        )}

        {duplicates.length > 0 && (
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {duplicates.slice(0, 15).map((group, index) => (
              <div key={index} className="text-sm p-3 bg-muted rounded border">
                <div className="font-medium text-foreground mb-1">{group.item_name}</div>
                <div className="text-muted-foreground mb-2">
                  Keep: <span className="font-mono text-green-600">{group.oldest_item_code}</span> (oldest)
                </div>
                <div className="text-xs">
                  Remove: {group.items_to_remove.map((item, i) => (
                    <span key={i} className={`font-mono ${item.has_stock ? 'text-orange-600' : 'text-gray-600'}`}>
                      {item.item_code}{item.has_stock ? '*' : ''}{i < group.items_to_remove.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
                {group.items_to_remove.some(item => item.has_stock) && (
                  <div className="text-xs text-orange-600 mt-1">* Has stock data - will be transferred</div>
                )}
              </div>
            ))}
            {duplicates.length > 15 && (
              <div className="text-sm text-muted-foreground">
                ... and {duplicates.length - 15} more groups
              </div>
            )}
          </div>
        )}

        {duplicates.length === 0 && !isLoading && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              No duplicate item names found. Your item master data is clean!
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
