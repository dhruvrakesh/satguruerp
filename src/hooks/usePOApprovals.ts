import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface POApproval {
  id: string;
  po_id: string;
  approval_level: number;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED';
  approver_id?: string;
  approved_at?: string;
  comments?: string;
  created_at: string;
  purchase_order: {
    id: string;
    po_number: string;
    total_amount: number;
    delivery_date: string;
    status: string;
    approval_status: string;
    created_at: string;
    supplier: {
      supplier_name: string;
      supplier_code: string;
    } | null;
  } | null;
}

export const usePOApprovals = () => {
  const [approvals, setApprovals] = useState<POApproval[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const fetchUserRole = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.user.id)
        .single();
       
      setUserRole(profile?.role || null);
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  const fetchPendingApprovals = async () => {
    if (!userRole || userRole !== 'general_manager') return;
    
    setIsLoading(true);
    try {
      // Get approval records with PO details and supplier info
      const { data: approvalData, error: approvalError } = await supabase
        .from('purchase_order_approvals')
        .select(`
          *,
          purchase_order:purchase_orders!po_id(
            id,
            po_number,
            total_amount,
            delivery_date,
            status,
            approval_status,
            created_at,
            supplier:suppliers!supplier_id(
              supplier_name,
              supplier_code
            )
          )
        `)
        .eq('approval_status', 'PENDING')
        .order('created_at', { ascending: false });

      if (approvalError) throw approvalError;

      setApprovals((approvalData as any) || []);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      toast({
        title: "Error",
        description: "Failed to fetch pending approvals",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const processApproval = async (approvalId: string, action: 'APPROVED' | 'REJECTED', comments?: string) => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      
      // Update the approval record
      const { error: approvalError } = await supabase
        .from('purchase_order_approvals')
        .update({
          approval_status: action,
          approver_id: userId,
          approved_at: action === 'APPROVED' ? new Date().toISOString() : null,
          rejected_at: action === 'REJECTED' ? new Date().toISOString() : null,
          comments: comments || null
        })
        .eq('id', approvalId);

      if (approvalError) throw approvalError;

      // Update the PO status based on approval action
      const poStatus = action === 'APPROVED' ? 'APPROVED' : 'CANCELLED';
      const approval = approvals.find(a => a.id === approvalId);
      
      if (approval) {
        const { error: poError } = await supabase
          .from('purchase_orders')
          .update({
            status: poStatus,
            approval_status: action,
            approved_at: action === 'APPROVED' ? new Date().toISOString() : null,
            approved_by: action === 'APPROVED' ? userId : null
          })
          .eq('id', approval.po_id);

        if (poError) throw poError;
      }

      toast({
        title: "Success",
        description: `Purchase order ${action.toLowerCase()} successfully`,
      });

      fetchPendingApprovals();
    } catch (error) {
      console.error('Error processing approval:', error);
      toast({
        title: "Error",
        description: `Failed to ${action.toLowerCase()} purchase order`,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (userRole) {
      fetchPendingApprovals();
    }
  }, [userRole]);

  return {
    approvals,
    isLoading,
    userRole,
    processApproval,
    refreshApprovals: fetchPendingApprovals
  };
};