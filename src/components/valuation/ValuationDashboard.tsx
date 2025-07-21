
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemPricingMaster } from "./ItemPricingMaster";
import { CostCategoryManager } from "./CostCategoryManager";
import { StockValuationChart } from "../analytics/StockValuationChart";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Package } from "lucide-react";

export function ValuationDashboard() {
  // Mock summary data - replace with actual hooks
  const valuationSummary = {
    totalValue: 2450000,
    itemsWithPricing: 1250,
    totalItems: 1500,
    lastUpdated: "2024-01-15",
    averagePrice: 1960,
    priceVariance: 12.5,
    pendingApprovals: 25
  };

  const pricingCoverage = ((valuationSummary.itemsWithPricing / valuationSummary.totalItems) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Stock Valuation Management</h1>
        <p className="text-muted-foreground">Comprehensive pricing and cost management system</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(valuationSummary.totalValue / 1000000).toFixed(2)}M</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>+{valuationSummary.priceVariance}% from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pricing Coverage</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pricingCoverage}%</div>
            <p className="text-xs text-muted-foreground">
              {valuationSummary.itemsWithPricing} of {valuationSummary.totalItems} items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Price</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{valuationSummary.averagePrice}</div>
            <p className="text-xs text-muted-foreground">
              Per unit across all items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Badge variant="destructive" className="h-4 w-4 rounded-full p-0 text-xs">
              {valuationSummary.pendingApprovals}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{valuationSummary.pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">
              Price changes awaiting approval
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="pricing" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pricing">Item Pricing</TabsTrigger>
          <TabsTrigger value="categories">Cost Categories</TabsTrigger>
          <TabsTrigger value="valuation">Valuation Analysis</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="space-y-6">
          <ItemPricingMaster />
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <CostCategoryManager />
        </TabsContent>

        <TabsContent value="valuation" className="space-y-6">
          <StockValuationChart 
            filters={{ valuationMethod: 'WEIGHTED_AVG' }}
            onFiltersChange={() => {}}
          />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Valuation Reports</CardTitle>
              <CardDescription>
                Generate comprehensive valuation and pricing reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Price Variance Report</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Analyze price changes and variance trends across all items
                    </p>
                    <div className="text-center py-8 text-muted-foreground">
                      Price variance analysis coming soon
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Cost Category Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Breakdown of costs by category and allocation methods
                    </p>
                    <div className="text-center py-8 text-muted-foreground">
                      Cost category analysis coming soon
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
