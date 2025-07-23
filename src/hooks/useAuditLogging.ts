import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface AuditLogEntry {
  action: string;
  entity_type: string;
  entity_id?: string;
  old_data?: any;
  new_data?: any;
  user_id?: string;
  metadata?: any;
}

export const useAuditLogging = () => {
  const logAuditEvent = async (entry: AuditLogEntry) => {
    try {
      const { error } = await supabase
        .from('pricing_audit_log')
        .insert({
          action: entry.action,
          entity_type: entry.entity_type,
          entity_id: entry.entity_id,
          old_data: entry.old_data,
          new_data: entry.new_data,
          metadata: entry.metadata,
          user_id: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) {
        console.error('Audit logging failed:', error);
        // Don't show error to user for audit failures
      }
    } catch (error) {
      console.error('Audit logging error:', error);
    }
  };

  const logPriceChange = async (itemCode: string, oldPrice: number, newPrice: number, reason: string) => {
    await logAuditEvent({
      action: 'PRICE_UPDATE',
      entity_type: 'ITEM_PRICING',
      entity_id: itemCode,
      old_data: { price: oldPrice },
      new_data: { price: newPrice },
      metadata: { reason, source: 'valuation_dashboard' }
    });
  };

  const logBulkPriceImport = async (importResults: any) => {
    await logAuditEvent({
      action: 'BULK_PRICE_IMPORT',
      entity_type: 'ITEM_PRICING',
      new_data: importResults,
      metadata: { source: 'bulk_import' }
    });
  };

  const logPriceExport = async (filters: any, recordCount: number) => {
    await logAuditEvent({
      action: 'PRICE_EXPORT',
      entity_type: 'ITEM_PRICING',
      metadata: { filters, recordCount, source: 'export' }
    });
  };

  return {
    logAuditEvent,
    logPriceChange,
    logBulkPriceImport,
    logPriceExport
  };
};