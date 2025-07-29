
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter, 
  Plus,
  Eye,
  Edit,
  Trash2,
  Download,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";
import { PurchaseOrderCreation } from "@/components/procurement/PurchaseOrderCreation";
import { PurchaseOrderBulkUpload } from "@/components/procurement/PurchaseOrderBulkUpload";
import { PurchaseOrderDetailModal } from "@/components/procurement/PurchaseOrderDetailModal";
import { PurchaseOrderEditDialog } from "@/components/procurement/PurchaseOrderEditDialog";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { usePDFReportGeneration } from "@/hooks/usePDFReportGeneration";
import { usePurchaseOrderEdit } from "@/hooks/usePurchaseOrderEdit";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const PurchaseOrders = () => {
  const { purchaseOrders, loading, submitForApproval, updatePurchaseOrder, refreshData } = usePurchaseOrders();
  const { mutate: generatePDF, isPending: generatingPDF } = usePDFReportGeneration();
  const { canEdit } = usePurchaseOrderEdit();
  const { user, profile, isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [showPODetail, setShowPODetail] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const filteredOrders = purchaseOrders.filter(po => {
    const matchesSearch = po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         po.supplier?.supplier_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'SUBMITTED': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'ISSUED': return 'bg-blue-100 text-blue-800';
      case 'PARTIALLY_RECEIVED': return 'bg-orange-100 text-orange-800';
      case 'RECEIVED': return 'bg-purple-100 text-purple-800';
      case 'CLOSED': return 'bg-gray-100 text-gray-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'DRAFT': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'SUBMITTED': return <AlertCircle className="w-4 h-4 text-blue-500" />;
      default: return null;
    }
  };

  const handleSubmitForApproval = async (poId: string) => {
    try {
      await submitForApproval(poId);
      toast.success("Purchase order submitted for approval");
    } catch (error) {
      toast.error("Failed to submit purchase order");
    }
  };

  const handlePOCreated = () => {
    setShowCreatePO(false);
    refreshData();
    toast.success("Purchase order created successfully");
  };

  const handleEditPO = (po: any) => {
    setSelectedPO(po);
    setShowEditModal(true);
  };

  const handleEditSuccess = () => {
    refreshData();
  };

  const handleViewPO = (po: any) => {
    setSelectedPO(po);
    setShowPODetail(true);
  };

  const handleDownloadPO = (po: any) => {
    const reportData = {
      title: `Purchase Order - ${po.po_number}`,
      dateRange: {
        from: po.po_date,
        to: po.delivery_date || po.required_date
      },
      summary: {
        totalItems: po.items?.length || 0,
        totalValue: po.total_amount,
        supplier: po.supplier?.supplier_name || 'Unknown',
        status: po.status,
        priority: po.priority
      },
      data: po.items || []
    };

    generatePDF(reportData, {
      onSuccess: (response) => {
        toast.success(`PDF generated successfully: ${response.fileName}`);
      },
      onError: (error) => {
        console.error('PDF generation error:', error);
        toast.error('Failed to generate PDF');
      }
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-600">Manage and track your purchase orders</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showCreatePO} onOpenChange={setShowCreatePO}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Purchase Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Purchase Order</DialogTitle>
              </DialogHeader>
              <PurchaseOrderCreation onSuccess={handlePOCreated} />
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
            <Download className="w-4 h-4 mr-2" />
            Import from CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by PO number or supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="ISSUED">Issued</SelectItem>
                <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Purchase Orders ({filteredOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(po.status)}
                        <span className="font-medium">{po.po_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{po.supplier?.supplier_name}</div>
                        <div className="text-sm text-gray-500">{po.supplier?.supplier_code}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(po.po_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(po.status)}>
                        {po.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={po.priority === 'HIGH' ? 'destructive' : 'secondary'}>
                        {po.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">₹{po.total_amount.toLocaleString()}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewPO(po)}
                          title="View Details & Audit Trail"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {(po.status === 'DRAFT' || isAdmin()) && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditPO(po)}
                              disabled={!canEdit(po.status, profile?.role)}
                              title={canEdit(po.status, profile?.role) ? "Edit purchase order" : "Cannot edit this order"}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleSubmitForApproval(po.id)}
                              disabled={po.status !== 'DRAFT' && !isAdmin()}
                              title="Submit for Approval"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDownloadPO(po)}
                          disabled={generatingPDF}
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredOrders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No purchase orders found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Upload Dialog */}
      <PurchaseOrderBulkUpload 
        open={showBulkUpload} 
        onOpenChange={setShowBulkUpload} 
      />

      {/* Purchase Order Detail Modal */}
      <PurchaseOrderDetailModal
        open={showPODetail}
        onOpenChange={setShowPODetail}
        purchaseOrder={selectedPO}
      />

      {/* Purchase Order Edit Modal */}
      <PurchaseOrderEditDialog
        open={showEditModal}
        onOpenChange={setShowEditModal}
        purchaseOrder={selectedPO}
        onEditSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default PurchaseOrders;
