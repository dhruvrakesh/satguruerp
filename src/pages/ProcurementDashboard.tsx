
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  Plus,
  Clock,
  CheckCircle,
  XCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useReorderManagement } from "@/hooks/useReorderManagement";
import { useSupplierAnalytics } from "@/hooks/useSupplierAnalytics";

const ProcurementDashboard = () => {
  const { purchaseOrders, suppliers, loading: poLoading } = usePurchaseOrders();
  const { reorderSuggestions, loading: reorderLoading } = useReorderManagement();
  const { supplierSummary } = useSupplierAnalytics();

  // Calculate metrics
  const totalPOs = purchaseOrders.length;
  const pendingPOs = purchaseOrders.filter(po => po.status === 'DRAFT' || po.status === 'SUBMITTED').length;
  const approvedPOs = purchaseOrders.filter(po => po.status === 'APPROVED').length;
  const totalSuppliers = suppliers.length;
  const criticalReorders = reorderSuggestions.filter(r => r.urgency_level === 'CRITICAL').length;
  const totalReorders = reorderSuggestions.filter(r => r.status === 'PENDING').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'SUBMITTED': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'ISSUED': return 'bg-blue-100 text-blue-800';
      case 'RECEIVED': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (poLoading || reorderLoading) {
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
          <h1 className="text-2xl font-bold text-gray-900">Procurement Dashboard</h1>
          <p className="text-gray-600">Monitor and manage your procurement operations</p>
        </div>
        <div className="flex gap-2">
          <Link to="/purchase-orders">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Purchase Order
            </Button>
          </Link>
          <Link to="/vendors">
            <Button variant="outline">
              <Users className="w-4 h-4 mr-2" />
              Manage Vendors
            </Button>
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Purchase Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPOs}</div>
            <p className="text-xs text-muted-foreground">
              {pendingPOs} pending approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSuppliers}</div>
            <p className="text-xs text-muted-foreground">
              {supplierSummary.data?.avgOnTimeDelivery.toFixed(1) || '0'}% avg delivery rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reorder Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReorders}</div>
            <p className="text-xs text-muted-foreground">
              {criticalReorders} critical items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Orders</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedPOs}</div>
            <p className="text-xs text-muted-foreground">
              Ready for processing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Purchase Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Purchase Orders</CardTitle>
            <CardDescription>Latest procurement activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {purchaseOrders.slice(0, 5).map((po) => (
                <div key={po.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{po.po_number}</span>
                      <Badge className={getStatusColor(po.status)}>
                        {po.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{po.supplier?.supplier_name}</p>
                    <p className="text-xs text-gray-500">
                      ₹{po.total_amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {new Date(po.po_date).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {po.status === 'APPROVED' && <CheckCircle className="w-3 h-3 text-green-500" />}
                      {po.status === 'DRAFT' && <Clock className="w-3 h-3 text-yellow-500" />}
                      {po.status === 'CANCELLED' && <XCircle className="w-3 h-3 text-red-500" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {purchaseOrders.length > 5 && (
              <div className="mt-4 text-center">
                <Link to="/purchase-orders">
                  <Button variant="outline" size="sm">
                    View All Purchase Orders
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reorder Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reorder Suggestions</CardTitle>
            <CardDescription>Items requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reorderSuggestions.slice(0, 5).map((suggestion) => (
                <div key={suggestion.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{suggestion.item_code}</span>
                      <Badge variant={suggestion.urgency_level === 'CRITICAL' ? 'destructive' : 'secondary'}>
                        {suggestion.urgency_level}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{suggestion.item_name}</p>
                    <p className="text-xs text-gray-500">
                      Current: {suggestion.current_stock} | Suggested: {suggestion.suggested_quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {suggestion.supplier_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {suggestion.estimated_cost && `₹${suggestion.estimated_cost.toLocaleString()}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {reorderSuggestions.length > 5 && (
              <div className="mt-4 text-center">
                <Link to="/reorder-management">
                  <Button variant="outline" size="sm">
                    View All Reorder Suggestions
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
          <CardDescription>Common procurement tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/purchase-orders">
              <Button className="w-full h-20 flex flex-col items-center justify-center gap-2">
                <ShoppingCart className="w-6 h-6" />
                <span>Create Purchase Order</span>
              </Button>
            </Link>
            <Link to="/vendors">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2">
                <Users className="w-6 h-6" />
                <span>Manage Vendors</span>
              </Button>
            </Link>
            <Link to="/reorder-management">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center gap-2">
                <AlertTriangle className="w-6 h-6" />
                <span>Process Reorders</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcurementDashboard;
