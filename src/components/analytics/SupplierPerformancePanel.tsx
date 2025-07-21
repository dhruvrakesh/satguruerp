
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Users, Clock, CheckCircle, AlertTriangle, Phone, Filter, Download } from "lucide-react";
import { useSupplierAnalytics } from "@/hooks/useSupplierAnalytics";
import { useState } from "react";

interface SupplierPerformancePanelProps {
  onContactSupplier?: (supplier: string) => void;
}

export function SupplierPerformancePanel({ onContactSupplier }: SupplierPerformancePanelProps) {
  const [performanceFilter, setPerformanceFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("90");
  
  const { 
    supplierPerformance, 
    supplierSummary 
  } = useSupplierAnalytics({
    performance: performanceFilter === "all" ? undefined : performanceFilter,
    category: categoryFilter === "all" ? undefined : categoryFilter,
    days: parseInt(periodFilter)
  });

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 75) return 'bg-yellow-500';
    if (score >= 60) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getPerformanceText = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Average';
    return 'Poor';
  };

  const suppliers = supplierPerformance.data || [];
  const filteredSuppliers = suppliers.filter(supplier => {
    const performanceMatch = performanceFilter === "all" || 
      getPerformanceText(supplier.overallScore).toLowerCase() === performanceFilter;
    const categoryMatch = categoryFilter === "all" || supplier.category === categoryFilter;
    return performanceMatch && categoryMatch;
  });

  // Prepare chart data
  const performanceData = suppliers.slice(0, 10).map(supplier => ({
    name: supplier.supplierName.substring(0, 15),
    onTimeDelivery: supplier.onTimeDeliveryRate,
    qualityScore: supplier.qualityScore,
    overallScore: supplier.overallScore
  }));

  if (supplierPerformance.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Supplier Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Analyzing supplier performance...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Performance Analysis Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Time Period</label>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="60">Last 60 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="180">Last 180 days</SelectItem>
                  <SelectItem value="365">Last 1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Performance</label>
              <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by performance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Performance Levels</SelectItem>
                  <SelectItem value="excellent">Excellent (90%+)</SelectItem>
                  <SelectItem value="good">Good (75-89%)</SelectItem>
                  <SelectItem value="average">Average (60-74%)</SelectItem>
                  <SelectItem value="poor">Poor (<60%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="raw_materials">Raw Materials</SelectItem>
                  <SelectItem value="packaging">Packaging</SelectItem>
                  <SelectItem value="chemicals">Chemicals</SelectItem>
                  <SelectItem value="machinery">Machinery</SelectItem>
                  <SelectItem value="services">Services</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" className="w-full gap-2">
                <Download className="w-4 h-4" />
                Export Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Total Suppliers</p>
                <p className="text-2xl font-bold">{supplierSummary.data?.totalSuppliers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Avg On-Time Delivery</p>
                <p className="text-2xl font-bold text-green-500">
                  {(supplierSummary.data?.avgOnTimeDelivery || 0).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Avg Lead Time</p>
                <p className="text-2xl font-bold text-orange-500">
                  {(supplierSummary.data?.avgLeadTime || 0).toFixed(1)} days
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Quality Issues</p>
                <p className="text-2xl font-bold text-red-500">
                  {supplierSummary.data?.qualityIssues || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Performance Comparison</CardTitle>
          <CardDescription>On-time delivery, quality score, and overall performance</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
              />
              <YAxis />
              <Tooltip />
              <Bar dataKey="onTimeDelivery" fill="hsl(var(--primary))" name="On-Time Delivery %" />
              <Bar dataKey="qualityScore" fill="hsl(var(--secondary))" name="Quality Score %" />
              <Bar dataKey="overallScore" fill="hsl(var(--accent))" name="Overall Score %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Suppliers List */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Performance Details</CardTitle>
          <CardDescription>
            Detailed performance metrics for all suppliers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredSuppliers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No suppliers found with current filters
                </div>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <div
                    key={supplier.supplierId}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{supplier.supplierName}</p>
                        <Badge className={`${getPerformanceColor(supplier.overallScore)} text-white`}>
                          {getPerformanceText(supplier.overallScore)}
                        </Badge>
                        <Badge variant="outline">
                          {supplier.overallScore.toFixed(1)}%
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Category: {supplier.category}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>On-Time: {supplier.onTimeDeliveryRate.toFixed(1)}%</span>
                        <span>Quality: {supplier.qualityScore.toFixed(1)}%</span>
                        <span>Lead Time: {supplier.avgLeadTime.toFixed(1)} days</span>
                        <span>Orders: {supplier.totalOrders}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onContactSupplier?.(supplier.supplierName)}
                        className="gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        Contact
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {/* View details */}}
                        className="gap-1"
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
