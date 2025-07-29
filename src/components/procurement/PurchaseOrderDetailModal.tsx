import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, Building2, Phone, Mail, CreditCard, Package, FileText, Clock } from "lucide-react";
import { PurchaseOrder } from "@/hooks/usePurchaseOrders";

interface PurchaseOrderDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder | null;
}

export function PurchaseOrderDetailModal({ open, onOpenChange, purchaseOrder }: PurchaseOrderDetailModalProps) {
  if (!purchaseOrder) return null;

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'bg-green-100 text-green-800';
      case 'MEDIUM': return 'bg-blue-100 text-blue-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'URGENT': return 'bg-red-100 text-red-800';
      case 'EMERGENCY': return 'bg-red-200 text-red-900';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            Purchase Order Details: {purchaseOrder.po_number}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Header Section */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h3 className="text-xl font-semibold">{purchaseOrder.po_number}</h3>
                <Badge className={getStatusColor(purchaseOrder.status)}>
                  {purchaseOrder.status}
                </Badge>
                <Badge className={getPriorityColor(purchaseOrder.priority)}>
                  {purchaseOrder.priority}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Total Amount:</span>
                  <div className="text-lg font-semibold text-green-600">
                    {purchaseOrder.currency} {purchaseOrder.total_amount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="font-medium">PO Date:</span>
                  <div>{new Date(purchaseOrder.po_date).toLocaleDateString()}</div>
                </div>
                <div>
                  <span className="font-medium">Required Date:</span>
                  <div>{purchaseOrder.required_date ? new Date(purchaseOrder.required_date).toLocaleDateString() : 'Not specified'}</div>
                </div>
                <div>
                  <span className="font-medium">Delivery Date:</span>
                  <div>{purchaseOrder.delivery_date ? new Date(purchaseOrder.delivery_date).toLocaleDateString() : 'Not specified'}</div>
                </div>
              </div>
            </div>

            {/* Supplier Information */}
            {purchaseOrder.supplier && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Supplier Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="font-semibold text-lg">{purchaseOrder.supplier.supplier_name}</div>
                      <div className="text-gray-600">Code: {purchaseOrder.supplier.supplier_code}</div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">Contact Person:</span>
                        <span>{purchaseOrder.supplier.contact_person || 'Not specified'}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <span>{purchaseOrder.supplier.phone || 'Not specified'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span>{purchaseOrder.supplier.email || 'Not specified'}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {purchaseOrder.items?.length || 0}
                    </div>
                    <div className="text-sm text-blue-600">Total Items</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {purchaseOrder.currency} {purchaseOrder.total_amount.toLocaleString()}
                    </div>
                    <div className="text-sm text-green-600">Total Value</div>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {purchaseOrder.approval_status}
                    </div>
                    <div className="text-sm text-orange-600">Approval Status</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="items" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                {purchaseOrder.items && purchaseOrder.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>UOM</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead>Line Total</TableHead>
                          <TableHead>Received</TableHead>
                          <TableHead>Pending</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchaseOrder.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.item_code}</TableCell>
                            <TableCell>{item.item_name}</TableCell>
                            <TableCell>{item.quantity.toLocaleString()}</TableCell>
                            <TableCell>{item.uom}</TableCell>
                            <TableCell>{purchaseOrder.currency} {item.unit_price.toLocaleString()}</TableCell>
                            <TableCell className="font-medium">
                              {purchaseOrder.currency} {item.line_total.toLocaleString()}
                            </TableCell>
                            <TableCell>{item.received_quantity.toLocaleString()}</TableCell>
                            <TableCell>{item.pending_quantity.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No items found for this purchase order.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Purchase Order Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <div className="font-medium">Purchase Order Created</div>
                      <div className="text-sm text-gray-600">
                        {new Date(purchaseOrder.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  {purchaseOrder.status !== 'DRAFT' && (
                    <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <div className="flex-1">
                        <div className="font-medium">Status Updated to {purchaseOrder.status}</div>
                        <div className="text-sm text-gray-600">Current status</div>
                      </div>
                    </div>
                  )}

                  {purchaseOrder.required_date && (
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <div className="flex-1">
                        <div className="font-medium">Required By</div>
                        <div className="text-sm text-gray-600">
                          {new Date(purchaseOrder.required_date).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}

                  {purchaseOrder.delivery_date && (
                    <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      <div className="flex-1">
                        <div className="font-medium">Expected Delivery</div>
                        <div className="text-sm text-gray-600">
                          {new Date(purchaseOrder.delivery_date).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}