import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function StockOperations() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Stock Operations</h1>
          <p className="text-muted-foreground">Manage goods receipt notes (GRN) and stock issues</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            New GRN
          </Button>
          <Button className="gap-2">
            <TrendingDown className="w-4 h-4" />
            Issue Stock
          </Button>
        </div>
      </div>

      <Tabs defaultValue="grn" className="space-y-6">
        <TabsList>
          <TabsTrigger value="grn">Goods Receipt Notes</TabsTrigger>
          <TabsTrigger value="issues">Stock Issues</TabsTrigger>
          <TabsTrigger value="transactions">All Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="grn" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Recent GRNs
              </CardTitle>
              <CardDescription>
                Latest goods receipt notes and incoming stock
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                GRN management functionality will be implemented here
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                Stock Issues
              </CardTitle>
              <CardDescription>
                Outgoing stock and material issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Stock issue management functionality will be implemented here
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5" />
                All Transactions
              </CardTitle>
              <CardDescription>
                Complete transaction history and audit trail
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Transaction history will be implemented here
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}