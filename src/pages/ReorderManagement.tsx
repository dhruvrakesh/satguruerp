
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter, 
  Plus,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  TrendingDown,
  Package,
  Clock
} from "lucide-react";
import { useReorderManagement } from "@/hooks/useReorderManagement";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const ReorderManagement = () => {
  const { 
    reorderRules, 
    reorderSuggestions, 
    loading, 
    calculateReorderSuggestions,
    approveSuggestion,
    rejectSuggestion,
    bulkApproveRules
  } = useReorderManagement();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);

  const filteredSuggestions = reorderSuggestions.filter(suggestion => {
    const matchesSearch = suggestion.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         suggestion.item_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUrgency = urgencyFilter === "all" || suggestion.urgency_level === urgencyFilter;
    const matchesStatus = statusFilter === "all" || suggestion.status === statusFilter;
    return matchesSearch && matchesUrgency && matchesStatus;
  });

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'CRITICAL': return 'bg-red-100 text-red-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'ORDERED': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCalculateReorders = async () => {
    try {
      await calculateReorderSuggestions();
      toast.success("Reorder suggestions calculated successfully");
    } catch (error) {
      toast.error("Failed to calculate reorder suggestions");
    }
  };

  const handleApproveSuggestion = async (suggestionId: string) => {
    try {
      await approveSuggestion(suggestionId);
      toast.success("Suggestion approved");
    } catch (error) {
      toast.error("Failed to approve suggestion");
    }
  };

  const handleRejectSuggestion = async (suggestionId: string) => {
    try {
      await rejectSuggestion(suggestionId);
      toast.success("Suggestion rejected");
    } catch (error) {
      toast.error("Failed to reject suggestion");
    }
  };

  const handleBulkApprove = async () => {
    if (selectedSuggestions.length === 0) {
      toast.error("Please select suggestions to approve");
      return;
    }
    
    try {
      await bulkApproveRules(selectedSuggestions);
      setSelectedSuggestions([]);
      toast.success(`${selectedSuggestions.length} suggestions approved`);
    } catch (error) {
      toast.error("Failed to approve suggestions");
    }
  };

  const criticalCount = reorderSuggestions.filter(s => s.urgency_level === 'CRITICAL').length;
  const pendingCount = reorderSuggestions.filter(s => s.status === 'PENDING').length;
  const approvedCount = reorderSuggestions.filter(s => s.status === 'APPROVED').length;
  const totalRules = reorderRules.length;

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
          <h1 className="text-2xl font-bold text-gray-900">Reorder Management</h1>
          <p className="text-gray-600">Manage reorder rules and process suggestions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCalculateReorders} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Calculate Reorders
          </Button>
          {selectedSuggestions.length > 0 && (
            <Button onClick={handleBulkApprove}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Bulk Approve ({selectedSuggestions.length})
            </Button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Critical Items</p>
                <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Orders</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved Orders</p>
                <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Rules</p>
                <p className="text-2xl font-bold">{totalRules}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="suggestions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="suggestions">Reorder Suggestions</TabsTrigger>
          <TabsTrigger value="rules">Reorder Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filter Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search by item code or name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Urgency</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="ORDERED">Ordered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Suggestions Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reorder Suggestions ({filteredSuggestions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSuggestions(filteredSuggestions.map(s => s.item_code));
                            } else {
                              setSelectedSuggestions([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Item Details</TableHead>
                      <TableHead>Stock Level</TableHead>
                      <TableHead>Urgency</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Estimated Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuggestions.map((suggestion) => (
                      <TableRow key={suggestion.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedSuggestions.includes(suggestion.item_code)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSuggestions([...selectedSuggestions, suggestion.item_code]);
                              } else {
                                setSelectedSuggestions(selectedSuggestions.filter(s => s !== suggestion.item_code));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{suggestion.item_code}</div>
                            <div className="text-sm text-gray-500">{suggestion.item_name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm">
                              <span className="font-medium">Current: </span>
                              <span className={suggestion.current_stock <= suggestion.reorder_level ? 'text-red-600' : 'text-green-600'}>
                                {suggestion.current_stock}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">Reorder Level: </span>
                              {suggestion.reorder_level}
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">Suggested: </span>
                              <span className="text-blue-600">{suggestion.suggested_quantity}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getUrgencyColor(suggestion.urgency_level)}>
                            {suggestion.urgency_level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{suggestion.supplier_name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {suggestion.estimated_cost ? `₹${suggestion.estimated_cost.toLocaleString()}` : 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(suggestion.status)}>
                            {suggestion.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {suggestion.status === 'PENDING' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleApproveSuggestion(suggestion.id)}
                                >
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRejectSuggestion(suggestion.id)}
                                >
                                  <XCircle className="w-4 h-4 text-red-500" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredSuggestions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No reorder suggestions found matching your criteria.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reorder Rules ({reorderRules.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Reorder Level</TableHead>
                      <TableHead>Reorder Quantity</TableHead>
                      <TableHead>Safety Stock</TableHead>
                      <TableHead>Lead Time</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Auto Reorder</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reorderRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.item_code}</TableCell>
                        <TableCell>{rule.item_name}</TableCell>
                        <TableCell>
                          <span className={rule.current_stock && rule.current_stock <= rule.reorder_level ? 'text-red-600 font-medium' : 'text-green-600'}>
                            {rule.current_stock || 0}
                          </span>
                        </TableCell>
                        <TableCell>{rule.reorder_level}</TableCell>
                        <TableCell>{rule.reorder_quantity}</TableCell>
                        <TableCell>{rule.safety_stock}</TableCell>
                        <TableCell>{rule.lead_time_days} days</TableCell>
                        <TableCell>{rule.supplier_name}</TableCell>
                        <TableCell>
                          <Badge variant={rule.auto_reorder_enabled ? 'default' : 'secondary'}>
                            {rule.auto_reorder_enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReorderManagement;
