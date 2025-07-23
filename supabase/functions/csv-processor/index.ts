import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessRequest {
  uploadId: string;
  uploadType: 'vendor_prices' | 'purchase_order' | 'supplier' | 'reorder_rules' | 'item_pricing';
  csvData: string;
  batchSize?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { uploadId, uploadType, csvData, batchSize = 100 }: ProcessRequest = await req.json();

    console.log(`Processing CSV upload: ${uploadId}, type: ${uploadType}`);

    // Update upload status to processing
    await supabase
      .from('procurement_csv_uploads')
      .update({ 
        status: 'processing',
        processing_start_time: new Date().toISOString()
      })
      .eq('id', uploadId);

    // Parse CSV data
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const dataRows = lines.slice(1);

    const results = {
      totalRows: dataRows.length,
      successCount: 0,
      errorCount: 0,
      errors: [] as Array<{ rowNumber: number; error: string; data: any }>
    };

    // Process based on upload type
    switch (uploadType) {
      case 'vendor_prices':
        await processVendorPrices(supabase, headers, dataRows, results, batchSize);
        break;
      case 'purchase_order':
        await processPurchaseOrders(supabase, headers, dataRows, results, batchSize);
        break;
      case 'supplier':
        await processSuppliers(supabase, headers, dataRows, results, batchSize);
        break;
      case 'reorder_rules':
        await processReorderRules(supabase, headers, dataRows, results, batchSize);
        break;
      case 'item_pricing':
        await processItemPricing(supabase, headers, dataRows, results, batchSize);
        break;
      default:
        throw new Error(`Unsupported upload type: ${uploadType}`);
    }

    // Update final results
    await supabase
      .from('procurement_csv_uploads')
      .update({
        status: results.errorCount === results.totalRows ? 'failed' : 'completed',
        total_rows: results.totalRows,
        successful_rows: results.successCount,
        failed_rows: results.errorCount,
        error_details: results.errors.length > 0 ? { errors: results.errors } : null,
        processing_end_time: new Date().toISOString()
      })
      .eq('id', uploadId);

    console.log(`Processing completed: ${results.successCount} success, ${results.errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('CSV processing error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function processVendorPrices(
  supabase: any, 
  headers: string[], 
  dataRows: string[], 
  results: any, 
  batchSize: number
) {
  // Get suppliers for validation
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, supplier_name, supplier_code');

  const supplierMap = new Map();
  suppliers?.forEach((supplier: any) => {
    if (supplier.supplier_name) {
      supplierMap.set(supplier.supplier_name.toLowerCase(), supplier.id);
    }
    if (supplier.supplier_code) {
      supplierMap.set(supplier.supplier_code.toLowerCase(), supplier.id);
    }
  });

  // Process in batches
  for (let i = 0; i < dataRows.length; i += batchSize) {
    const batch = dataRows.slice(i, i + batchSize);
    const validatedBatch = [];

    for (let j = 0; j < batch.length; j++) {
      const rowNumber = i + j + 1;
      try {
        const values = batch[j].split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        // Find supplier ID
        const supplierId = supplierMap.get(row.supplier_name?.toLowerCase()) || 
                          supplierMap.get(row.supplier_code?.toLowerCase());

        if (!supplierId) {
          results.errors.push({
            rowNumber,
            error: `Supplier not found: ${row.supplier_name || row.supplier_code}`,
            data: row
          });
          results.errorCount++;
          continue;
        }

        // Validate required fields
        if (!row.item_code?.trim()) {
          results.errors.push({
            rowNumber,
            error: 'Item code is required',
            data: row
          });
          results.errorCount++;
          continue;
        }

        if (!row.unit_price || isNaN(parseFloat(row.unit_price))) {
          results.errors.push({
            rowNumber,
            error: 'Valid unit price is required',
            data: row
          });
          results.errorCount++;
          continue;
        }

        const priceRecord = {
          supplier_id: supplierId,
          item_code: row.item_code.trim(),
          unit_price: parseFloat(row.unit_price),
          currency: row.currency || 'INR',
          effective_from: row.effective_from || new Date().toISOString().split('T')[0],
          effective_to: row.effective_to || null,
          minimum_order_quantity: row.minimum_order_quantity ? parseFloat(row.minimum_order_quantity) : 1,
          lead_time_days: row.lead_time_days ? parseInt(row.lead_time_days) : 7,
          discount_percentage: row.discount_percentage ? parseFloat(row.discount_percentage) : 0,
          payment_terms: row.payment_terms || null,
          validity_days: row.validity_days ? parseInt(row.validity_days) : 30
        };

        validatedBatch.push(priceRecord);
      } catch (error) {
        results.errors.push({
          rowNumber,
          error: `Processing error: ${error.message}`,
          data: {}
        });
        results.errorCount++;
      }
    }

    // Insert valid records
    if (validatedBatch.length > 0) {
      const { error: insertError } = await supabase
        .from('vendor_price_lists')
        .upsert(validatedBatch, {
          onConflict: 'supplier_id,item_code,effective_from'
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        validatedBatch.forEach((_, batchIndex) => {
          results.errors.push({
            rowNumber: i + batchIndex + 1,
            error: `Database error: ${insertError.message}`,
            data: validatedBatch[batchIndex]
          });
          results.errorCount++;
        });
      } else {
        results.successCount += validatedBatch.length;
      }
    }
  }
}

async function processPurchaseOrders(supabase: any, headers: string[], dataRows: string[], results: any, batchSize: number) {
  // Implementation for purchase order processing
  console.log('Processing purchase orders - implementation needed');
  results.errorCount = dataRows.length;
  results.errors.push({ rowNumber: 1, error: 'Purchase order processing not implemented in edge function', data: {} });
}

async function processSuppliers(supabase: any, headers: string[], dataRows: string[], results: any, batchSize: number) {
  // Implementation for supplier processing
  console.log('Processing suppliers - implementation needed');
  results.errorCount = dataRows.length;
  results.errors.push({ rowNumber: 1, error: 'Supplier processing not implemented in edge function', data: {} });
}

async function processReorderRules(supabase: any, headers: string[], dataRows: string[], results: any, batchSize: number) {
  // Implementation for reorder rules processing
  console.log('Processing reorder rules - implementation needed');
  results.errorCount = dataRows.length;
  results.errors.push({ rowNumber: 1, error: 'Reorder rules processing not implemented in edge function', data: {} });
}

async function processItemPricing(supabase: any, headers: string[], dataRows: string[], results: any, batchSize: number) {
  // Implementation for item pricing processing
  console.log('Processing item pricing - implementation needed');
  results.errorCount = dataRows.length;
  results.errors.push({ rowNumber: 1, error: 'Item pricing processing not implemented in edge function', data: {} });
}