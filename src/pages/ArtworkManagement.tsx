
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, FileText, Search, Filter, Download, Eye, ExternalLink, Database, Settings, ChevronLeft, ChevronRight, Edit, Upload, Users, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CylinderData } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ArtworkEditDialog } from "@/components/artwork/ArtworkEditDialog";
import { ArtworkUploadDialog } from "@/components/artwork/ArtworkUploadDialog";
import { BulkArtworkActions } from "@/components/artwork/BulkArtworkActions";

interface ArtworkItem {
  item_code: string;
  item_name: string;
  customer_name: string;
  dimensions: string;
  no_of_colours: string;
  file_hyperlink: string;
  file_id: string;
  ups?: number;
  circum?: number;
  location?: string;
  cyl_qty?: string;
  total_runs?: string;
  last_run?: string;
  mielage_m?: string;
  remarks?: string;
}

interface CustomerCount {
  customer_name: string;
  count: number;
}

export default function ArtworkManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("all");
  const [pdfFilter, setPdfFilter] = useState("all");
  const [selectedArtwork, setSelectedArtwork] = useState<ArtworkItem | null>(null);
  const [selectedArtworks, setSelectedArtworks] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [editingArtwork, setEditingArtwork] = useState<ArtworkItem | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // Fetch artwork statistics and customer data (full dataset)
  const { data: artworkStats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["artwork-stats", searchTerm, customerFilter, colorFilter, pdfFilter],
    queryFn: async () => {
      let query = supabase
        .from("master_data_artworks_se")
        .select("item_code, customer_name, file_hyperlink, no_of_colours");

      if (searchTerm) {
        query = query.or(`item_code.ilike.%${searchTerm}%,item_name.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`);
      }

      if (customerFilter && customerFilter !== "all") {
        query = query.eq("customer_name", customerFilter);
      }

      if (colorFilter && colorFilter !== "all") {
        query = query.eq("no_of_colours", colorFilter);
      }

      if (pdfFilter && pdfFilter !== "all") {
        if (pdfFilter === "with_pdf") {
          query = query.not("file_hyperlink", "is", null);
        } else if (pdfFilter === "without_pdf") {
          query = query.is("file_hyperlink", null);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const totalArtworks = data.length;
      const withLinks = data.filter(item => 
        item.file_hyperlink && 
        item.file_hyperlink.trim() !== '' && 
        validateGoogleDriveLink(item.file_hyperlink)
      ).length;

      // Calculate customer counts and sort by artwork count (descending)
      const customerCounts = data.reduce((acc: Record<string, number>, item) => {
        if (item.customer_name) {
          acc[item.customer_name] = (acc[item.customer_name] || 0) + 1;
        }
        return acc;
      }, {});

      const sortedCustomers: CustomerCount[] = Object.entries(customerCounts)
        .map(([customer_name, count]) => ({ customer_name, count }))
        .sort((a, b) => b.count - a.count);

      const uniqueCustomers = sortedCustomers.map(c => c.customer_name);

      return {
        totalArtworks,
        withLinks,
        customers: uniqueCustomers.length,
        data: data,
        customerCounts: sortedCustomers,
        uniqueCustomers
      };
    },
  });

  // Fetch paginated artwork data
  const { data: artworkData = [], isLoading } = useQuery({
    queryKey: ["artwork-management", searchTerm, customerFilter, colorFilter, pdfFilter, currentPage, pageSize],
    queryFn: async () => {
      let query = supabase
        .from("master_data_artworks_se")
        .select("*")
        .order("item_code", { ascending: true });

      if (searchTerm) {
        query = query.or(`item_code.ilike.%${searchTerm}%,item_name.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`);
      }

      if (customerFilter && customerFilter !== "all") {
        query = query.eq("customer_name", customerFilter);
      }

      if (colorFilter && colorFilter !== "all") {
        query = query.eq("no_of_colours", colorFilter);
      }

      if (pdfFilter && pdfFilter !== "all") {
        if (pdfFilter === "with_pdf") {
          query = query.not("file_hyperlink", "is", null);
        } else if (pdfFilter === "without_pdf") {
          query = query.is("file_hyperlink", null);
        }
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error } = await query.range(from, to);
      if (error) throw error;
      return data as ArtworkItem[];
    },
  });

  // Fetch cylinder data
  const { data: cylinderData = [] } = useQuery({
    queryKey: ["cylinder-data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_data_artworks_dkpkl_cylinder_name")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data.map((item: any) => ({
        id: item.id || crypto.randomUUID(),
        cylinder_code: item.cylinder_code || '',
        cylinder_name: item.cylinder_name || item.cylinder_code || '',
        colour: item.colour || '',
        cylinder_size: item.cylinder_size || 0,
        type: item.type || 'GRAVURE',
        manufacturer: item.manufacturer || '',
        location: item.location || '',
        mileage_m: item.mileage_m || 0,
        last_run: item.last_run || '',
        remarks: item.remarks || '',
        item_code: item.item_code || '',
        customer_name: item.customer_name || '',
        created_at: item.created_at || ''
      })) as CylinderData[];
    },
  });

  // Get unique colors for filters
  const uniqueColors = artworkStats?.data ? [...new Set(artworkStats.data.map(item => item.no_of_colours).filter(Boolean))] : [];

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, customerFilter, colorFilter, pdfFilter]);

  // Get cylinders for selected artwork
  const getArtworkCylinders = (itemCode: string) => {
    return cylinderData.filter(cyl => cyl.item_code === itemCode);
  };

  const validateGoogleDriveLink = (link: string) => {
    if (!link) return false;
    return link.includes('drive.google.com') || link.includes('docs.google.com');
  };

  const convertGoogleDriveUrl = (url: string) => {
    if (!url) return '';
    
    // Extract file ID from various Google Drive URL formats
    const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (fileIdMatch) {
      return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
    }
    
    const idMatch = url.match(/id=([a-zA-Z0-9-_]+)/);
    if (idMatch) {
      return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
    }
    
    return url;
  };

  const handleBulkDownloadPDFs = () => {
    selectedArtworks.forEach(itemCode => {
      const artwork = artworkData.find(a => a.item_code === itemCode);
      if (artwork?.file_hyperlink && validateGoogleDriveLink(artwork.file_hyperlink)) {
        window.open(artwork.file_hyperlink, '_blank');
      }
    });
  };

  const stats = {
    totalArtworks: artworkStats?.totalArtworks || 0,
    withLinks: artworkStats?.withLinks || 0,
    customers: artworkStats?.customers || 0,
    cylindersTotal: cylinderData.length
  };

  const totalPages = Math.ceil((stats.totalArtworks || 0) / pageSize);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Palette className="w-8 h-8 text-primary" />
            Artwork Management
          </h1>
          <p className="text-muted-foreground">Comprehensive artwork catalog with Google Drive integration and cylinder tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Artwork
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Catalog
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Bulk Operations
          </Button>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Artworks</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isStatsLoading ? "..." : stats.totalArtworks}
            </div>
            <p className="text-xs text-muted-foreground">
              Catalog items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Drive Links</CardTitle>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isStatsLoading ? "..." : stats.withLinks}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalArtworks > 0 ? ((stats.withLinks / stats.totalArtworks) * 100).toFixed(1) : 0}% coverage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isStatsLoading ? "..." : stats.customers}
            </div>
            <p className="text-xs text-muted-foreground">
              Unique customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cylinders Tracked</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cylindersTotal}</div>
            <p className="text-xs text-muted-foreground">
              Production cylinders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>Find artworks by item code, name, customer, or specifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap items-center">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search item code, name, or customer..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filter by Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {artworkStats?.customerCounts?.slice(0, 20).map((customer) => (
                  <SelectItem key={customer.customer_name} value={customer.customer_name}>
                    {customer.customer_name} ({customer.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={colorFilter} onValueChange={setColorFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Colors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Colors</SelectItem>
                {uniqueColors.map((color) => (
                  <SelectItem key={color} value={color}>
                    {color}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={pdfFilter} onValueChange={setPdfFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="PDF Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All PDFs</SelectItem>
                <SelectItem value="with_pdf">With PDF</SelectItem>
                <SelectItem value="without_pdf">Without PDF</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
                <SelectItem value="200">200 per page</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => {
              setSearchTerm(""); 
              setCustomerFilter("all"); 
              setColorFilter("all");
              setPdfFilter("all");
            }}>
              <Filter className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedArtworks.length > 0 && (
        <BulkArtworkActions
          selectedCount={selectedArtworks.length}
          onClearSelection={() => setSelectedArtworks([])}
          onBulkDownload={handleBulkDownloadPDFs}
          onBulkEdit={() => {/* TODO: Implement bulk edit */}}
        />
      )}

      <Tabs defaultValue="artworks" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="artworks">Artwork Catalog</TabsTrigger>
          <TabsTrigger value="cylinders">Cylinder Tracking</TabsTrigger>
          <TabsTrigger value="analytics">Usage Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="artworks">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Artwork Catalog</CardTitle>
                  <CardDescription>
                    {isLoading ? 'Loading...' : `Showing ${artworkData.length} of ${stats.totalArtworks} artworks (Page ${currentPage} of ${totalPages})`}
                  </CardDescription>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoading ? (
                  <div className="text-center p-8 text-muted-foreground">
                    Loading artwork catalog...
                  </div>
                ) : artworkData.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">
                    No artworks found matching your criteria
                  </div>
                ) : (
                  artworkData.map((artwork) => (
                    <Card key={artwork.item_code} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedArtworks.includes(artwork.item_code)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedArtworks([...selectedArtworks, artwork.item_code]);
                              } else {
                                setSelectedArtworks(selectedArtworks.filter(id => id !== artwork.item_code));
                              }
                            }}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg">{artwork.item_name}</h3>
                              <Badge variant="outline">{artwork.item_code}</Badge>
                              <Badge variant="secondary">{artwork.no_of_colours}</Badge>
                              {validateGoogleDriveLink(artwork.file_hyperlink) && (
                                <Badge variant="default" className="bg-green-600">
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  PDF Available
                                </Badge>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Customer</p>
                                <p className="font-medium">{artwork.customer_name || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Dimensions</p>
                                <p className="font-medium">{artwork.dimensions || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">UPS</p>
                                <p className="font-medium">{artwork.ups || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Cylinders</p>
                                <p className="font-medium">{getArtworkCylinders(artwork.item_code).length}</p>
                              </div>
                            </div>

                            {artwork.location && (
                              <div className="mt-2">
                                <p className="text-sm text-muted-foreground">
                                  <strong>Location:</strong> {artwork.location}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setEditingArtwork(artwork)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedArtwork(artwork)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>{artwork.item_name}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                  <div><strong>Item Code:</strong> {artwork.item_code}</div>
                                  <div><strong>Customer:</strong> {artwork.customer_name}</div>
                                  <div><strong>Colors:</strong> {artwork.no_of_colours}</div>
                                  <div><strong>Dimensions:</strong> {artwork.dimensions}</div>
                                  <div><strong>UPS:</strong> {artwork.ups}</div>
                                  <div><strong>Circumference:</strong> {artwork.circum}mm</div>
                                </div>

                                {artwork.file_hyperlink && validateGoogleDriveLink(artwork.file_hyperlink) && (
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <h4 className="font-medium">Artwork Preview</h4>
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => window.open(artwork.file_hyperlink, '_blank')}
                                      >
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Open in Drive
                                      </Button>
                                    </div>
                                    <div className="w-full h-[500px] border rounded">
                                      <iframe
                                        src={convertGoogleDriveUrl(artwork.file_hyperlink)}
                                        width="100%"
                                        height="100%"
                                        className="border rounded"
                                        title="Artwork Preview"
                                      />
                                    </div>
                                  </div>
                                )}

                                {getArtworkCylinders(artwork.item_code).length > 0 && (
                                  <div className="space-y-2">
                                    <h4 className="font-medium">Associated Cylinders</h4>
                                    <div className="grid gap-2">
                                      {getArtworkCylinders(artwork.item_code).map((cylinder) => (
                                        <div key={cylinder.id} className="p-3 border rounded flex justify-between">
                                          <div>
                                            <p className="font-medium">{cylinder.cylinder_name}</p>
                                            <p className="text-sm text-muted-foreground">Size: {cylinder.cylinder_size}</p>
                                          </div>
                                          <Badge variant="outline">Active</Badge>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {artwork.remarks && (
                                  <div>
                                    <h4 className="font-medium mb-2">Remarks</h4>
                                    <p className="text-sm bg-muted p-3 rounded">{artwork.remarks}</p>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>

                          {validateGoogleDriveLink(artwork.file_hyperlink) && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => window.open(artwork.file_hyperlink, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(prev => Math.max(1, prev - 1));
                          }}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(pageNum);
                              }}
                              isActive={currentPage === pageNum}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}

                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(prev => Math.min(totalPages, prev + 1));
                          }}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cylinders">
          <Card>
            <CardHeader>
              <CardTitle>Cylinder Tracking</CardTitle>
              <CardDescription>Production cylinders and their specifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cylinderData.map((cylinder) => (
                  <Card key={cylinder.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{cylinder.cylinder_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {cylinder.customer_name} • {cylinder.item_code}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{cylinder.cylinder_size}</p>
                        <Badge variant="outline">Active</Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Coverage Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Artworks with PDF Links:</span>
                    <span className="font-medium">{stats.withLinks}/{stats.totalArtworks}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${stats.totalArtworks > 0 ? (stats.withLinks / stats.totalArtworks) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" />
                  Top Customers by Artwork Count
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {artworkStats?.customerCounts?.slice(0, 6).map((customer, index) => (
                    <div key={customer.customer_name} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-muted rounded-full w-6 h-6 flex items-center justify-center font-medium">
                          {index + 1}
                        </span>
                        <span className="truncate font-medium">{customer.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">{customer.count}</span>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ArtworkEditDialog
        artwork={editingArtwork}
        open={!!editingArtwork}
        onClose={() => setEditingArtwork(null)}
        onSave={() => {
          setEditingArtwork(null);
          // Refetch data
        }}
      />

      <ArtworkUploadDialog
        open={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onUpload={() => {
          setShowUploadDialog(false);
          // Refetch data
        }}
      />
    </div>
  );
}
