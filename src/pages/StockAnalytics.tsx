import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, PieChart, LineChart, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ABCAnalysisChart } from "@/components/analytics/ABCAnalysisChart";
import { InventoryTurnoverChart } from "@/components/analytics/InventoryTurnoverChart";
import { CategoryAnalysisChart } from "@/components/dashboard/CategoryAnalysisChart";
import { StockValuationChart } from "@/components/analytics/StockValuationChart";
import { AdvancedFilters } from "@/components/analytics/AdvancedFilters";
import { StockValuationFilters } from "@/hooks/useStockValuation";
import { useStockMovementExport } from "@/hooks/useDataExport";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export default function StockAnalytics() {
  const [filters, setFilters] = useState<StockValuationFilters>({
    valuationMethod: 'WEIGHTED_AVG'
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const exportMutation = useStockMovementExport();

  const handleExport = async () => {
    try {
      await exportMutation.mutateAsync({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        supplier: filters.supplier,
      });
      toast({
        title: "Export successful",
        description: "Stock analytics report has been downloaded",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to generate report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    toast({
      title: "Data refreshed",
      description: "Analytics data has been updated",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Stock Analytics</h1>
          <p className="text-muted-foreground">Comprehensive inventory insights and reports</p>
        </div>
        <div className="flex gap-2">
          <AdvancedFilters
            filters={filters}
            onFiltersChange={setFilters}
            onApplyFilters={() => setRefreshKey(prev => prev + 1)}
          />
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExport}
            disabled={exportMutation.isPending}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            {exportMutation.isPending ? "Exporting..." : "Export Report"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="valuation">Valuation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <InventoryTurnoverChart />
            <ABCAnalysisChart />
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="w-5 h-5" />
                Stock Movement Trends
              </CardTitle>
              <CardDescription>
                Historical analysis of stock movements and patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Stock movement trend charts will be displayed here
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <CategoryAnalysisChart />
        </TabsContent>

        <TabsContent value="valuation" className="space-y-6">
          <StockValuationChart
            key={refreshKey}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}