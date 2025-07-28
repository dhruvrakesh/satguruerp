import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Star, Phone, Mail, MapPin, CreditCard, Package, TrendingUp } from "lucide-react";
import { useVendorMaterialCompatibility } from "@/hooks/useVendorMaterialCompatibility";

interface VendorDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: any | null;
}

export function VendorDetailDialog({ open, onOpenChange, vendor }: VendorDetailDialogProps) {
  const { data: compatibility } = useVendorMaterialCompatibility(vendor?.id);

  if (!vendor) return null;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Package className="w-6 h-6" />
            {vendor.supplier_name}
            <Badge className={getCategoryColor(vendor.category)}>
              {vendor.category}
            </Badge>
            <Badge className={getTypeColor(vendor.supplier_type)}>
              {vendor.supplier_type}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={vendor.is_active ? "default" : "secondary"}>
                      {vendor.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <TrendingUp className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Lead Time</p>
                    <p className="text-xl font-bold">{vendor.lead_time_days} days</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Performance</p>
                    <p className="text-xl font-bold">{vendor.performance_rating}%</p>
                  </div>
                  <Star className="w-8 h-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Compatible Items</p>
                    <p className="text-xl font-bold">{compatibility?.totalCompatibleItems || 0}</p>
                  </div>
                  <Package className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Contact Person</h4>
                  <p className="font-medium">{vendor.contact_person || "Not specified"}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Vendor Code</h4>
                  <p className="font-mono">{vendor.supplier_code}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vendor.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{vendor.phone}</span>
                  </div>
                )}
                {vendor.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{vendor.email}</span>
                  </div>
                )}
              </div>

              {vendor.address && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Address</h4>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                    <div>
                      <p>{typeof vendor.address === 'string' ? vendor.address : `${vendor.address?.street || ''}`}</p>
                      {typeof vendor.address === 'object' && (
                        <p className="text-sm text-muted-foreground">
                          {vendor.address?.city}, {vendor.address?.state} {vendor.address?.postal_code}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Business Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Business Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Payment Terms</h4>
                  <p>{vendor.payment_terms || "Not specified"}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Credit Limit</h4>
                  <p>{vendor.credit_limit ? `₹${vendor.credit_limit.toLocaleString()}` : "Not specified"}</p>
                </div>
              </div>

              {vendor.tax_details && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Tax Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {vendor.tax_details.gst_number && (
                      <p className="text-sm"><span className="font-medium">GST:</span> {vendor.tax_details.gst_number}</p>
                    )}
                    {vendor.tax_details.pan_number && (
                      <p className="text-sm"><span className="font-medium">PAN:</span> {vendor.tax_details.pan_number}</p>
                    )}
                  </div>
                </div>
              )}

              {vendor.bank_details && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Bank Details</h4>
                  <div className="text-sm space-y-1">
                    {vendor.bank_details.bank_name && (
                      <p><span className="font-medium">Bank:</span> {vendor.bank_details.bank_name}</p>
                    )}
                    {vendor.bank_details.account_number && (
                      <p><span className="font-medium">Account:</span> {vendor.bank_details.account_number}</p>
                    )}
                    {vendor.bank_details.ifsc_code && (
                      <p><span className="font-medium">IFSC:</span> {vendor.bank_details.ifsc_code}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance & Materials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Performance Rating
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {renderStarRating(vendor.performance_rating)}
                    <span className="font-medium">{vendor.performance_rating}%</span>
                  </div>
                  <Progress value={vendor.performance_rating} className="w-full" />
                </div>

                {vendor.certifications && vendor.certifications.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Certifications</h4>
                    <div className="flex flex-wrap gap-1">
                      {vendor.certifications.map((cert: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Material Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Material Categories
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {vendor.material_categories.map((category: string, idx: number) => (
                    <Badge key={idx} variant="secondary">
                      {category}
                    </Badge>
                  ))}
                </div>

                {compatibility && compatibility.totalCompatibleItems > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Compatible Items</h4>
                    <p className="text-sm text-muted-foreground">
                      This vendor can supply {compatibility.totalCompatibleItems} items from your inventory
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {vendor.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{vendor.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}