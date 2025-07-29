import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface EditablePOData {
  supplier_name?: string;
  delivery_date?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | "EMERGENCY";
  remarks?: string;
}

export const usePurchaseOrderEdit = () => {
  const [isLoading, setIsLoading] = useState(false);

  const canEdit = (status: string) => {
    return status === 'DRAFT';
  };

  const updatePurchaseOrder = async (poId: string, updates: EditablePOData) => {
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', poId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Purchase order updated successfully",
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating purchase order:', error);
      toast({
        title: "Error", 
        description: "Failed to update purchase order",
        variant: "destructive",
      });
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    updatePurchaseOrder,
    canEdit,
    isLoading
  };
};