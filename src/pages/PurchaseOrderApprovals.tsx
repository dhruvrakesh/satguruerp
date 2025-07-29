import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Calendar, DollarSign, Building, AlertCircle } from "lucide-react";
import { usePOApprovals } from "@/hooks/usePOApprovals";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Separator } from "@/components/ui/separator";

const PurchaseOrderApprovals = () => {
  const { approvals, isLoading, userRole, processApproval } = usePOApprovals();
  const [selectedApproval, setSelectedApproval] = useState<string | null>(null);
  const [action, setAction] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [comments, setComments] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleApprovalAction = (approvalId: string, approvalAction: 'APPROVED' | 'REJECTED') => {
    setSelectedApproval(approvalId);
    setAction(approvalAction);
    setShowConfirmDialog(true);
  };

  const confirmApproval = async () => {
    if (selectedApproval && action) {
      await processApproval(selectedApproval, action, comments);
      setShowConfirmDialog(false);
      setSelectedApproval(null);
      setAction(null);
      setComments("");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (userRole !== 'general_manager' && userRole !== 'admin') {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
              <p className="text-muted-foreground">
                You don't have permission to view purchase order approvals.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Purchase Order Approvals</h1>
          <p className="text-muted-foreground">Review and approve pending purchase orders</p>
        </div>
        <Badge variant="outline" className="text-lg px-3 py-1">
          {approvals.length} Pending
        </Badge>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading pending approvals...</p>
        </div>
      ) : approvals.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Pending Approvals</h3>
              <p className="text-muted-foreground">
                All purchase orders have been processed.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {approvals.map((approval) => (
            <Card key={approval.id} className="overflow-hidden">
              <CardHeader className="bg-muted/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">
                    PO #{approval.purchase_order.po_number}
                  </CardTitle>
                  <Badge className={getStatusColor(approval.approval_status)}>
                    {approval.approval_status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Building className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Supplier</p>
                        <p className="text-muted-foreground">
                          {approval.purchase_order?.supplier?.supplier_name || 'Unknown Supplier'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Total Amount</p>
                        <p className="text-2xl font-bold text-primary">
                          ₹{approval.purchase_order.total_amount?.toLocaleString() || '0'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Delivery Date</p>
                        <p className="text-muted-foreground">
                          {new Date(approval.purchase_order.delivery_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="font-medium mb-2">Approval Details</p>
                      <div className="bg-muted p-3 rounded-lg space-y-2">
                        <p className="text-sm">
                          <span className="font-medium">Level:</span> {approval.approval_level}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Role Required:</span> General Manager
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Created:</span>{' '}
                          {new Date(approval.purchase_order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleApprovalAction(approval.id, 'APPROVED')}
                        className="flex-1"
                        variant="default"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleApprovalAction(approval.id, 'REJECTED')}
                        className="flex-1"
                        variant="destructive"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title={`${action === 'APPROVED' ? 'Approve' : 'Reject'} Purchase Order`}
        description={`Are you sure you want to ${action?.toLowerCase()} this purchase order? This action cannot be undone.`}
        confirmText={action === 'APPROVED' ? 'Approve' : 'Reject'}
        variant={action === 'REJECTED' ? 'destructive' : 'default'}
        onConfirm={confirmApproval}
      />
      
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Comments</h3>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={`Add comments about this ${action?.toLowerCase()}...`}
              className="mb-4"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderApprovals;