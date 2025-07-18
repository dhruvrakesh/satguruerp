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

  const cleanupDuplicates = async () => {
    if (duplicates.length === 0) return;

    setIsCleaningUp(true);
    let cleaned = 0;
    let errors = 0;

    try {
      for (const group of duplicates) {
        try {
          // Get all items for this name
          const { data: items, error: fetchError } = await supabase
            .from('item_master')
            .select('*')
            .eq('item_name', group.item_name)
            .order('updated_at', { ascending: false });

          if (fetchError) throw fetchError;

          if (items && items.length > 1) {
            // Keep the most recent item, merge data from others
            const keepItem = items[0];
            const itemsToRemove = items.slice(1);
            
            // For each item to remove, check if it has stock references
            for (const item of itemsToRemove) {
              try {
                // First, try to update any stock records to point to the kept item
                const { error: stockUpdateError } = await supabase
                  .from('satguru_stock')
                  .update({ item_code: keepItem.item_code })
                  .eq('item_code', item.item_code);

                if (stockUpdateError) {
                  console.warn(`Could not update stock references for ${item.item_code}:`, stockUpdateError);
                }

                // Try to update other related tables that might exist
                try {
                  // Update any daily stock summary records
                  await supabase
                    .from('daily_stock_summary')
                    .update({ item_code: keepItem.item_code })
                    .eq('item_code', item.item_code);
                } catch (updateError) {
                  console.warn(`Could not update related table references for ${item.item_code}:`, updateError);
                }

                // Now try to delete the duplicate item
                const { error: deleteError } = await supabase
                  .from('item_master')
                  .delete()
                  .eq('id', item.id);

                if (deleteError) {
                  console.error(`Error deleting item ${item.id}:`, deleteError);
                  errors++;
                } else {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Item Master Cleanup
        </CardTitle>
        <CardDescription>
          Find and remove duplicate item names to ensure data integrity
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
              Cleanup will keep the most recently updated record for each item name.
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
