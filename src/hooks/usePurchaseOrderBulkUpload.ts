import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PurchaseOrderBulkRow {
  supplier_name: string;
  po_date: string;
  item_code: string;
  quantity: number;
  unit_price: number;
  remarks?: string;
  expected_delivery_date?: string;
}

interface BulkUploadResult {
  successCount: number;
  errorCount: number;
  errors: Array<{
    rowNumber: number;
    reason: string;
    data: any;
  }>;
  createdPOs: string[];
  uploadId?: string;
}

export function usePurchaseOrderBulkUpload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();

  const processCSV = async (file: File): Promise<BulkUploadResult> => {
    setIsProcessing(true);
    setProgress(0);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      if (lines.length <= 1) {
        throw new Error("CSV file is empty or has no data rows");
      }

      const results: BulkUploadResult = {
        successCount: 0,
        errorCount: 0,
        errors: [],
        createdPOs: []
      };

      // Get existing suppliers and items
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, supplier_name, supplier_code');

      const { data: items } = await supabase
        .from('satguru_item_master')
        .select('item_code, item_name, uom');

      const supplierMap = new Map(suppliers?.map(s => [s.supplier_name.toLowerCase(), s]) || []);
      const itemMap = new Map(items?.map(i => [i.item_code, i]) || []);

      // Group rows by supplier and po_date to create consolidated POs
      const poGroups = new Map<string, {
        supplier: any;
        po_date: string;
        items: Array<PurchaseOrderBulkRow & { rowNumber: number }>;
      }>();

      // Parse and group data
      for (let i = 1; i < lines.length; i++) {
        setProgress((i / (lines.length - 1)) * 50);
        
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const rowData: any = {};
        
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        try {
          const supplierName = rowData.supplier_name || rowData.Supplier_Name;
          const poDate = rowData.po_date || rowData.PO_Date;
          const itemCode = rowData.item_code || rowData.Item_Code;
          const quantity = parseFloat(rowData.quantity || rowData.Quantity);
          const unitPrice = parseFloat(rowData.unit_price || rowData.Unit_Price);

          // Validation
          if (!supplierName) throw new Error("Supplier name is required");
          if (!poDate) throw new Error("PO date is required");
          if (!itemCode) throw new Error("Item code is required");
          if (isNaN(quantity) || quantity <= 0) throw new Error("Valid quantity is required");
          if (isNaN(unitPrice) || unitPrice <= 0) throw new Error("Valid unit price is required");

          // Validate supplier exists
          const supplier = supplierMap.get(supplierName.toLowerCase());
          if (!supplier) {
            throw new Error(`Supplier not found: ${supplierName}`);
          }

          // Validate item exists
          const item = itemMap.get(itemCode);
          if (!item) {
            throw new Error(`Item not found: ${itemCode}`);
          }

          const groupKey = `${supplier.id}_${poDate}`;
          if (!poGroups.has(groupKey)) {
            poGroups.set(groupKey, {
              supplier,
              po_date: poDate,
              items: []
            });
          }

          poGroups.get(groupKey)!.items.push({
            supplier_name: supplierName,
            po_date: poDate,
            item_code: itemCode,
            quantity,
            unit_price: unitPrice,
            remarks: rowData.remarks || rowData.Remarks,
            expected_delivery_date: rowData.expected_delivery_date || rowData.Expected_Delivery_Date,
            rowNumber: i + 1
          });

        } catch (error: any) {
          results.errorCount++;
          results.errors.push({
            rowNumber: i + 1,
            reason: error.message,
            data: headers.reduce((obj: any, header, index) => {
              obj[header] = values[index] || '';
              return obj;
            }, {})
          });
        }
      }

      // Create POs for each group
      let processedGroups = 0;
      for (const [groupKey, group] of poGroups) {
        setProgress(50 + (processedGroups / poGroups.size) * 50);
        
        try {
          // Generate PO number
          const poNumber = `PO-${Date.now()}-${group.supplier.supplier_code}`;
          
          // Calculate total amount
          const totalAmount = group.items.reduce((sum, item) => 
            sum + (item.quantity * item.unit_price), 0
          );

          // Create purchase order
          const { data: purchaseOrder, error: poError } = await supabase
            .from('purchase_orders')
            .insert({
              po_number: poNumber,
              supplier_id: group.supplier.id,
              po_date: group.po_date,
              total_amount: totalAmount,
              status: 'DRAFT',
              currency: 'INR',
              remarks: `Bulk upload - ${group.items.length} items`
            })
            .select()
            .single();

          if (poError) {
            throw new Error(`Failed to create PO: ${poError.message}`);
          }

          // Create PO items
          const poItems = group.items.map((item, index) => {
            const itemData = itemMap.get(item.item_code);
            return {
              po_id: purchaseOrder.id,
              item_code: item.item_code,
              item_name: itemData?.item_name || '',
              uom: itemData?.uom || 'PCS',
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.quantity * item.unit_price,
              line_number: index + 1,
              description: item.remarks || ''
            };
          });

          const { error: itemsError } = await supabase
            .from('purchase_order_items')
            .insert(poItems);

          if (itemsError) {
            // Rollback PO if items creation failed
            await supabase
              .from('purchase_orders')
              .delete()
              .eq('id', purchaseOrder.id);
            
            throw new Error(`Failed to create PO items: ${itemsError.message}`);
          }

          results.successCount += group.items.length;
          results.createdPOs.push(poNumber);

        } catch (error: any) {
          // Add errors for all items in this group
          group.items.forEach(item => {
            results.errorCount++;
            results.errors.push({
              rowNumber: item.rowNumber,
              reason: `PO Creation Failed: ${error.message}`,
              data: item
            });
          });
        }

        processedGroups++;
      }

      // Log upload start
      const { data: uploadLog } = await supabase
        .from('procurement_csv_uploads')
        .insert({
          upload_type: 'purchase_order',
          file_name: file.name,
          file_size_bytes: file.size,
          status: 'processing'
        })
        .select()
        .single();

      const uploadId = uploadLog?.id || '';

      // Update upload log
      await supabase
        .from('procurement_csv_uploads')
        .update({
          total_rows: lines.length - 1,
          successful_rows: results.successCount,
          failed_rows: results.errorCount,
          error_details: results.errors.length > 0 ? { errors: results.errors.map(e => ({ ...e, data: JSON.stringify(e.data) })) } : null,
          status: results.errorCount === (lines.length - 1) ? 'failed' : 'completed'
        })
        .eq('id', uploadId);

      setProgress(100);
      return { ...results, uploadId };

    } catch (error: any) {
      console.error('Fatal error during PO CSV processing:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: processCSV,
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      
      toast({
        title: "Purchase Orders Upload Completed",
        description: `${results.createdPOs.length} POs created with ${results.successCount} line items. ${results.errorCount > 0 ? `${results.errorCount} errors found.` : ''}`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred during upload",
        variant: "destructive"
      });
    }
  });

  return {
    uploadMutation,
    isProcessing,
    progress
  };
}