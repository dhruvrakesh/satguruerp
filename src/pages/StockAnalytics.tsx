import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, PieChart, LineChart, Download, RefreshCw, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ABCAnalysisChart } from "@/components/analytics/ABCAnalysisChart";
import { InventoryTurnoverChart } from "@/components/analytics/InventoryTurnoverChart";
import { CategoryAnalysisChart } from "@/components/dashboard/CategoryAnalysisChart";
import { StockValuationChart } from "@/components/analytics/StockValuationChart";
import { DeadStockAnalysisChart } from "@/components/analytics/DeadStockAnalysisChart";
import { LowStockAlertsPanel } from "@/components/analytics/LowStockAlertsPanel";
import { SupplierPerformancePanel } from "@/components/analytics/SupplierPerformancePanel";
import { MovementClassificationPanel } from "@/components/analytics/MovementClassificationPanel";
import { DataValidationPanel } from "@/components/analytics/DataValidationPanel";
import { AdvancedFilters } from "@/components/analytics/AdvancedFilters";
import { StockValuationFilters } from "@/hooks/useStockValuation";
import { useStockMovementExport } from "@/hooks/useDataExport";
import { usePDFReportGeneration } from "@/hooks/usePDFReportGeneration";
import { useStockValuation } from "@/hooks/useStockValuation";
import { useDeadStockAnalysis } from "@/hooks/useDeadStockAnalysis";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export default function StockAnalytics() {
  const [filters, setFilters] = useState<StockValuationFilters>({
    valuationMethod: 'WEIGHTED_AVG'
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const exportMutation = useStockMovementExport();
  const pdfMutation = usePDFReportGeneration();
  const { stockValuation, valuationSummary } = useStockValuation(filters);
  const { deadStockAnalysis, deadStockSummary } = useDeadStockAnalysis({
    minDaysNoMovement: 90,
    category: filters.category
  });

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

  const handlePDFExport = async () => {
    try {
      const reportData = {
        title: "Stock Analytics Report",
        dateRange: {
          from: filters.dateFrom,
          to: filters.dateTo
        },
        summary: {
          totalItems: valuationSummary.data?.totalItems || 0,
          totalValue: valuationSummary.data?.totalValue || 0,
          highValueItems: valuationSummary.data?.highValueItems || 0,
          deadStockItems: deadStockSummary.data?.totalDeadStockItems || 0,
          deadStockValue: deadStockSummary.data?.totalDeadStockValue || 0
        },
        data: stockValuation.data || [],
        chartElements: ['#stock-valuation-charts', '#abc-analysis-chart', '#dead-stock-analysis-charts']
      };

      await pdfMutation.mutateAsync(reportData);
      toast({
        title: "PDF Export successful",
        description: "Stock analytics PDF report has been downloaded",
      });
    } catch (error) {
      toast({
        title: "PDF Export failed",
        description: "Failed to generate PDF report. Please try again.",
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
            {exportMutation.isPending ? "Exporting..." : "Export Excel"}
          </Button>
          <Button 
            variant="outline" 
            onClick={handlePDFExport}
            disabled={pdfMutation.isPending}
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            {pdfMutation.isPending ? "Generating..." : "Export PDF"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">Low Stock Alerts</TabsTrigger>
          <TabsTrigger value="validation">Data Validation</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="movement">Movement</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="valuation">Valuation</TabsTrigger>
          <TabsTrigger value="dead-stock">Dead Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <InventoryTurnoverChart />
            <ABCAnalysisChart />
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <LowStockAlertsPanel
            onReorderClick={(itemCode, suggestedQty) => {
              toast({
                title: "Reorder initiated",
                description: `Create purchase order for ${itemCode} - Qty: ${suggestedQty}`,
              });
            }}
          />
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-6">
          <SupplierPerformancePanel
            onContactSupplier={(supplier) => {
              toast({
                title: "Supplier contact",
                description: `Contacting supplier: ${supplier}`,
              });
            }}
          />
        </TabsContent>

        <TabsContent value="validation" className="space-y-6">
          <DataValidationPanel
            onFixIssue={(issueId, action) => {
              toast({
                title: "Issue resolution",
                description: `${action} initiated for issue: ${issueId}`,
              });
            }}
            onRunValidation={() => {
              toast({
                title: "Validation started",
                description: "Running comprehensive data validation checks...",
              });
            }}
          />
        </TabsContent>

        <TabsContent value="movement" className="space-y-6">
          <MovementClassificationPanel
            onOptimizeStock={(itemCode, action) => {
              toast({
                title: "Stock optimization",
                description: `${action} stock for ${itemCode}`,
              });
            }}
          />
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

        <TabsContent value="dead-stock" className="space-y-6">
          <DeadStockAnalysisChart
            key={refreshKey}
            filters={{
              minDaysNoMovement: 90,
              category: filters.category,
              minValue: filters.minValue,
              maxValue: filters.maxValue
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}