
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemPricingMaster } from "./ItemPricingMaster";
import { CostCategoryManager } from "./CostCategoryManager";

type ValuationMethod = "WEIGHTED_AVG" | "FIFO" | "LIFO";

interface StockValuationFilters {
  valuationMethod: ValuationMethod;
  dateRange?: {
    from: Date;
    to: Date;
  };
  categoryFilter?: string;
}

export function ValuationDashboard() {
  const [filters, setFilters] = useState<StockValuationFilters>({
    valuationMethod: "WEIGHTED_AVG"
  });

  const handleFiltersChange = (newFilters: StockValuationFilters) => {
    setFilters(newFilters);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock Valuation & Pricing</h1>
          <p className="text-muted-foreground">
            Manage item pricing, cost categories, and stock valuation methods
          </p>
        </div>
      </div>

      <Tabs defaultValue="pricing" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pricing">Item Pricing Master</TabsTrigger>
          <TabsTrigger value="categories">Cost Categories</TabsTrigger>
          <TabsTrigger value="valuation">Stock Valuation</TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="space-y-6">
          <ItemPricingMaster />
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <CostCategoryManager />
        </TabsContent>

        <TabsContent value="valuation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Stock Valuation Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Valuation Method</label>
                  <select 
                    value={filters.valuationMethod}
                    onChange={(e) => handleFiltersChange({
                      ...filters,
                      valuationMethod: e.target.value as ValuationMethod
                    })}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-md"
                  >
                    <option value="WEIGHTED_AVG">Weighted Average</option>
                    <option value="FIFO">First In, First Out (FIFO)</option>
                    <option value="LIFO">Last In, First Out (LIFO)</option>
                  </select>
                </div>
                
                <div className="text-center text-muted-foreground py-8">
                  Stock valuation calculations will be implemented here based on the selected method.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
