import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  id: string;
  action: string;
  field_changed?: string;
  old_value?: any;
  new_value?: any;
  changed_by?: string;
  changed_at: string;
  reason?: string;
  metadata?: any;
}

export const usePurchaseOrderAudit = (purchaseOrderId?: string) => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAuditLogs = async () => {
    if (!purchaseOrderId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_order_audit_log')
        .select(`
          *,
          user:profiles!changed_by(
            full_name,
            email
          )
        `)
        .eq('purchase_order_id', purchaseOrderId)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [purchaseOrderId]);

  const formatAuditMessage = (entry: AuditLogEntry) => {
    switch (entry.action) {
      case 'CREATED':
        return 'Purchase order created';
      case 'STATUS_CHANGED':
        return `Status changed from "${entry.old_value}" to "${entry.new_value}"`;
      case 'APPROVAL_STATUS_CHANGED':
        return `Approval status changed from "${entry.old_value}" to "${entry.new_value}"`;
      case 'AMOUNT_CHANGED':
        return `Total amount changed from ₹${entry.old_value} to ₹${entry.new_value}`;
      default:
        return entry.action.replace(/_/g, ' ').toLowerCase();
    }
  };

  return {
    auditLogs,
    isLoading,
    refreshAuditLogs: fetchAuditLogs,
    formatAuditMessage
  };
};