import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ApprovalRequest {
  id: string;
  request_type: string;
  entity_id: string;
  request_data: any;
  requested_by: string;
  created_at: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approver_id?: string;
  decision_notes?: string;
  approval_level: number;
  request_amount: number;
}

export function ApprovalWorkflowPanel() {
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const queryClient = useQueryClient();

  // Fetch pending approvals
  const { data: pendingApprovals = [], isLoading } = useQuery({
    queryKey: ['valuation-approvals', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('valuation_approvals')
        .select(`
          *,
          requester:profiles!valuation_approvals_requested_by_fkey(full_name),
          approver:profiles!valuation_approvals_approver_id_fkey(full_name)
        `)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ApprovalRequest[];
    }
  });

  // Approval mutation
  const approvalMutation = useMutation({
    mutationFn: async ({ 
      requestId, 
      decision, 
      notes 
    }: { 
      requestId: string; 
      decision: 'APPROVED' | 'REJECTED'; 
      notes: string;
    }) => {
      const { data, error } = await supabase
        .from('valuation_approvals')
        .update({
          status: decision,
          approver_id: (await supabase.auth.getUser()).data.user?.id,
          decision_notes: notes,
          decision_date: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;

      // If approved, process the change
      if (decision === 'APPROVED' && data) {
        const approval = data as any;
        if (approval.request_type === 'PRICE_CHANGE' && approval.request_data) {
          await supabase
            .from('valuation_price_history')
            .insert({
              item_code: approval.request_data.item_code,
              old_price: approval.request_data.old_price,
              new_price: approval.request_data.new_price,
              change_reason: approval.request_data.reason || 'Approved price change',
              effective_date: approval.request_data.effective_date || new Date().toISOString().split('T')[0],
              approved_by: (await supabase.auth.getUser()).data.user?.id
            });
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valuation-approvals'] });
      setSelectedRequest(null);
      setApprovalNotes("");
      toast({
        title: "Approval Processed",
        description: "The request has been processed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to process approval request.",
        variant: "destructive",
      });
    }
  });

  const handleApproval = (decision: 'APPROVED' | 'REJECTED') => {
    if (!selectedRequest) return;
    
    approvalMutation.mutate({
      requestId: selectedRequest.id,
      decision,
      notes: approvalNotes
    });
  };

  const getPriorityColor = (amount: number) => {
    if (amount > 100000) return 'destructive';
    if (amount > 50000) return 'secondary';
    if (amount > 10000) return 'outline';
    return 'secondary';
  };

  const getPriorityLabel = (amount: number) => {
    if (amount > 100000) return 'CRITICAL';
    if (amount > 50000) return 'HIGH';
    if (amount > 10000) return 'MEDIUM';
    return 'LOW';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Approvals
          </CardTitle>
          <CardDescription>
            Review and approve price changes, bulk operations, and other valuation requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : pendingApprovals.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-muted-foreground">No pending approvals</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApprovals.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {request.request_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {request.entity_id}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {(request as any).requester?.full_name || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(request.request_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPriorityColor(request.request_amount) as any}>
                        {getPriorityLabel(request.request_amount)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(request.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedRequest(request as ApprovalRequest)}
                          >
                            Review
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Approval Request Details</DialogTitle>
                            <DialogDescription>
                              Review the details and provide approval decision
                            </DialogDescription>
                          </DialogHeader>
                          
                          {selectedRequest && (
                            <div className="space-y-4">
                              {/* Request Details */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Type</label>
                                  <p className="text-sm text-muted-foreground">
                                    {selectedRequest.request_type.replace('_', ' ')}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Priority</label>
                                  <Badge variant={getPriorityColor(selectedRequest.request_amount) as any}>
                                    {getPriorityLabel(selectedRequest.request_amount)}
                                  </Badge>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Amount</label>
                                  <p className="text-sm">
                                    {formatCurrency(selectedRequest.request_amount)}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Requested Date</label>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(selectedRequest.created_at), 'PPP')}
                                  </p>
                                </div>
                              </div>

                              {/* Change Details */}
                              <div>
                                <label className="text-sm font-medium">Request Details</label>
                                <div className="mt-2 p-3 bg-muted rounded-lg">
                                  <pre className="text-sm overflow-auto">
                                    {JSON.stringify(selectedRequest.request_data, null, 2)}
                                  </pre>
                                </div>
                              </div>

                              {/* Approval Notes */}
                              <div>
                                <label className="text-sm font-medium">Approval Notes</label>
                                <Textarea
                                  placeholder="Add your approval notes..."
                                  value={approvalNotes}
                                  onChange={(e) => setApprovalNotes(e.target.value)}
                                  className="mt-2"
                                />
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-2 pt-4">
                                <Button
                                  onClick={() => handleApproval('APPROVED')}
                                  disabled={approvalMutation.isPending}
                                  className="flex-1"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleApproval('REJECTED')}
                                  disabled={approvalMutation.isPending}
                                  className="flex-1"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-yellow-600">
              {pendingApprovals.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Pending Approvals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-red-600">
              {pendingApprovals.filter(a => a.request_amount > 100000).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Critical Priority
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {formatCurrency(
                pendingApprovals.reduce((sum, a) => sum + a.request_amount, 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Total Value Impact
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-orange-600">
              {pendingApprovals.filter(a => 
                new Date(a.created_at) < new Date(Date.now() - 24 * 60 * 60 * 1000)
              ).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Overdue (24h+)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}