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
    if (!userRole || (userRole !== 'general_manager' && userRole !== 'admin')) return;
    
    setIsLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Use the fixed database function call
      const { data: approvalData, error: approvalError } = await supabase
        .rpc('get_user_pending_approvals', { p_user_id: user.user.id });

      if (approvalError) throw approvalError;

      // Transform the data to match expected format
      const formattedApprovals = (approvalData || []).map((item: any) => ({
        id: item.id,
        po_id: item.po_id,
        approval_level: item.approval_level,
        approval_status: item.approval_status,
        approver_id: item.approver_id,
        approved_at: item.approved_at,
        comments: item.comments,
        created_at: item.created_at,
        purchase_order: {
          id: item.po_id,
          po_number: item.po_number,
          total_amount: item.total_amount,
          delivery_date: item.delivery_date,
          status: item.po_status,
          approval_status: item.po_approval_status,
          created_at: item.po_created_at,
          supplier: {
            supplier_name: item.supplier_name,
            supplier_code: item.supplier_code
          }
        }
      }));

      setApprovals(formattedApprovals);
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