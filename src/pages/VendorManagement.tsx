
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
  Phone,
  Mail,
  MapPin,
  Star,
  TrendingUp,
  Package
} from "lucide-react";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { VendorCreationForm } from "@/components/procurement/VendorCreationForm";

const VendorManagement = () => {
  const { suppliers, loading } = usePurchaseOrders();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showCreateVendor, setShowCreateVendor] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.supplier_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || supplier.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'PREMIUM': return 'bg-purple-100 text-purple-800';
      case 'STANDARD': return 'bg-blue-100 text-blue-800';
      case 'BACKUP': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'MANUFACTURER': return 'bg-green-100 text-green-800';
      case 'DISTRIBUTOR': return 'bg-orange-100 text-orange-800';
      case 'VENDOR': return 'bg-blue-100 text-blue-800';
      case 'AGENT': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderStarRating = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating / 20);
    
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`w-4 h-4 ${i < fullStars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
        />
      );
    }
    return stars;
  };

  const handleVendorCreated = () => {
    setShowCreateVendor(false);
    // The form will handle query invalidation
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
          <h1 className="text-2xl font-bold text-gray-900">Vendor Management</h1>
          <p className="text-gray-600">Manage your supplier relationships and performance</p>
        </div>
        <Dialog open={showCreateVendor} onOpenChange={setShowCreateVendor}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add New Vendor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Vendor</DialogTitle>
            </DialogHeader>
            <VendorCreationForm 
              onSuccess={handleVendorCreated}
              onCancel={() => setShowCreateVendor(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Vendor Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Vendors</p>
                <p className="text-2xl font-bold">{suppliers.length}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Premium Vendors</p>
                <p className="text-2xl font-bold">
                  {suppliers.filter(s => s.category === 'PREMIUM').length}
                </p>
              </div>
              <Star className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Vendors</p>
                <p className="text-2xl font-bold">
                  {suppliers.filter(s => s.is_active).length}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Lead Time</p>
                <p className="text-2xl font-bold">
                  {Math.round(suppliers.reduce((sum, s) => sum + s.lead_time_days, 0) / suppliers.length || 0)} days
                </p>
              </div>
              <MapPin className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Vendors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by vendor name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="PREMIUM">Premium</SelectItem>
                <SelectItem value="STANDARD">Standard</SelectItem>
                <SelectItem value="BACKUP">Backup</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vendors Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vendors ({filteredSuppliers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor Details</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Lead Time</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Material Categories</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{supplier.supplier_name}</div>
                        <div className="text-sm text-gray-500">{supplier.supplier_code}</div>
                        <div className="flex items-center gap-1 mt-1">
                          {supplier.is_active ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getCategoryColor(supplier.category)}>
                        {supplier.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getTypeColor(supplier.supplier_type)}>
                        {supplier.supplier_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {supplier.contact_person && (
                          <div className="text-sm">{supplier.contact_person}</div>
                        )}
                        {supplier.phone && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Phone className="w-3 h-3" />
                            {supplier.phone}
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Mail className="w-3 h-3" />
                            {supplier.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{supplier.lead_time_days} days</span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          {renderStarRating(supplier.performance_rating)}
                        </div>
                        <Progress value={supplier.performance_rating} className="w-16 h-2" />
                        <span className="text-xs text-gray-500">{supplier.performance_rating}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {supplier.material_categories.slice(0, 2).map((category, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {category}
                          </Badge>
                        ))}
                        {supplier.material_categories.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{supplier.material_categories.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredSuppliers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No vendors found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorManagement;
