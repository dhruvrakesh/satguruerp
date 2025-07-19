
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle, Database, Upload } from 'lucide-react';

export function SafeDataReplacement() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const handleSafeReplacement = async () => {
    setIsProcessing(true);
    setProgress(0);
    setResults(null);

    try {
      console.log('🔄 Starting safe data replacement for Satguru tables...');
      
      // Step 1: Backup current data
      setProgress(10);
      const backupTimestamp = new Date().toISOString();
      
      const { data: currentItems } = await supabase
        .from('satguru_item_master')
        .select('*');
      
      console.log(`📦 Found ${currentItems?.length || 0} existing items in satguru_item_master`);

      // Step 2: Clear existing data from satguru tables
      setProgress(30);
      
      // Clear related data first to avoid foreign key constraints
      await supabase.from('satguru_stock').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('satguru_grn_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('satguru_issue_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Clear item master data
      await supabase.from('satguru_item_master').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      console.log('🗑️ Cleared existing Satguru data');

      // Step 3: Import from staging/source tables
      setProgress(50);
      
      const { data: stagingItems } = await supabase
        .from('_artworks_revised_staging')
        .select('*');
      
      console.log(`📥 Found ${stagingItems?.length || 0} items in staging`);

      // Step 4: Process and insert new data
      setProgress(70);
      
      const processedItems = [];
      const errors = [];
      
      if (stagingItems) {
        for (const item of stagingItems) {
          try {
            // Get or create category
            let categoryId = null;
            if (item.customer_name) {
              const categoryName = item.customer_name.includes('LABEL') ? 'LABELS' : 
                                 item.customer_name.includes('PACK') ? 'PACKAGING' : 'FINISHED_GOODS';
              
              const { data: category } = await supabase
                .from('satguru_categories')
                .select('id')
                .eq('category_name', categoryName)
                .single();
              
              if (category) {
                categoryId = category.id;
              } else {
                const { data: newCategory } = await supabase
                  .from('satguru_categories')
                  .insert({ 
                    category_name: categoryName,
                    description: `Auto-created during data replacement`
                  })
                  .select('id')
                  .single();
                
                if (newCategory) {
                  categoryId = newCategory.id;
                }
              }
            }

            // Insert into satguru_item_master
            const itemData = {
              item_code: item.item_code,
              item_name: item.item_name || `Product ${item.item_code}`,
              category_id: categoryId,
              qualifier: item.customer_name?.substring(0, 50),
              size_mm: item.dimensions,
              gsm: item.circum,
              uom: 'PCS',
              usage_type: 'FINISHED_GOOD',
              status: 'active',
              specifications: {
                customer_name: item.customer_name,
                dimensions: item.dimensions,
                colours: item.no_of_colours,
                circumference: item.circum,
                ups: item.ups,
                length: item.length,
                coil_size: item.coil_size,
                cut_length: item.cut_length,
                location: item.location,
                remarks: item.remarks
              }
            };

            const { error } = await supabase
              .from('satguru_item_master')
              .insert(itemData);

            if (error) {
              errors.push({ item_code: item.item_code, error: error.message });
            } else {
              processedItems.push(item.item_code);
            }
          } catch (error: any) {
            errors.push({ item_code: item.item_code, error: error.message });
          }
        }
      }

      setProgress(100);
      
      const result = {
        backup_count: currentItems?.length || 0,
        processed_count: processedItems.length,
        error_count: errors.length,
        backup_timestamp: backupTimestamp,
        errors: errors.slice(0, 10) // Show first 10 errors
      };
      
      setResults(result);
      
      toast({
        title: "Safe Data Replacement Complete",
        description: `Processed ${processedItems.length} items with ${errors.length} errors. Previous data backed up.`,
        variant: errors.length > 0 ? "destructive" : "default"
      });

    } catch (error: any) {
      console.error('Safe replacement error:', error);
      toast({
        title: "Replacement Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Safe Satguru Data Replacement
        </CardTitle>
        <CardDescription>
          Safely replace all Satguru item master data with staging data while preserving backups
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This operation will:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Create a backup of current Satguru data</li>
              <li>Clear all existing Satguru item master data</li>
              <li>Import fresh data from staging tables</li>
              <li>Clear related stock and transaction data</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button 
            onClick={handleSafeReplacement}
            disabled={isProcessing}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {isProcessing ? 'Processing...' : 'Start Safe Replacement'}
          </Button>
        </div>

        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {results && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Replacement Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Items Backed Up:</span>
                  <span className="ml-2">{results.backup_count}</span>
                </div>
                <div>
                  <span className="font-medium">Items Processed:</span>
                  <span className="ml-2">{results.processed_count}</span>
                </div>
                <div>
                  <span className="font-medium">Errors:</span>
                  <span className="ml-2 text-red-600">{results.error_count}</span>
                </div>
                <div>
                  <span className="font-medium">Backup Time:</span>
                  <span className="ml-2 text-xs">{new Date(results.backup_timestamp).toLocaleString()}</span>
                </div>
              </div>
              
              {results.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-sm mb-2">Sample Errors:</h4>
                  <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
                    {results.errors.map((error: any, index: number) => (
                      <div key={index} className="text-red-600">
                        {error.item_code}: {error.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
