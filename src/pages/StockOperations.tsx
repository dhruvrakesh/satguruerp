
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown, Plus, TrendingUp, TrendingDown, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GRNForm } from "@/components/stock-operations/GRNForm";
import { GRNTable } from "@/components/stock-operations/GRNTable";
import { IssueForm } from "@/components/stock-operations/IssueForm";
import { IssueTable } from "@/components/stock-operations/IssueTable";
import { TransactionHistory } from "@/components/stock-operations/TransactionHistory";
import { BulkUploadGRN } from "@/components/stock-operations/BulkUploadGRN";
import { BulkUploadIssues } from "@/components/stock-operations/BulkUploadIssues";
import { BulkUploadOpeningStock } from "@/components/stock-operations/BulkUploadOpeningStock";
import { StockMovementReport } from "@/components/stock-operations/StockMovementReport";

export default function StockOperations() {
  const [grnDialogOpen, setGrnDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [bulkGRNOpen, setBulkGRNOpen] = useState(false);
  const [bulkIssuesOpen, setBulkIssuesOpen] = useState(false);
  const [bulkOpeningStockOpen, setBulkOpeningStockOpen] = useState(false);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Stock Operations</h1>
          <p className="text-muted-foreground">Manage goods receipt notes (GRN), stock issues, and opening stock</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={grnDialogOpen} onOpenChange={setGrnDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                New GRN
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New GRN</DialogTitle>
              </DialogHeader>
              <GRNForm onSuccess={() => setGrnDialogOpen(false)} />
            </DialogContent>
          </Dialog>

          <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <TrendingDown className="w-4 h-4" />
                Issue Stock
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Stock Issue</DialogTitle>
              </DialogHeader>
              <IssueForm onSuccess={() => setIssueDialogOpen(false)} />
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Bulk Upload
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setBulkOpeningStockOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Opening Stock
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBulkGRNOpen(true)}>
                <TrendingUp className="w-4 h-4 mr-2" />
                Upload GRNs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBulkIssuesOpen(true)}>
                <TrendingDown className="w-4 h-4 mr-2" />
                Upload Issues
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {bulkOpeningStockOpen && (
            <Dialog open={bulkOpeningStockOpen} onOpenChange={setBulkOpeningStockOpen}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Bulk Upload Opening Stock</DialogTitle>
                </DialogHeader>
                <BulkUploadOpeningStock />
              </DialogContent>
            </Dialog>
          )}
          
          <BulkUploadGRN
            open={bulkGRNOpen}
            onOpenChange={setBulkGRNOpen}
          />
          
          <BulkUploadIssues
            open={bulkIssuesOpen}
            onOpenChange={setBulkIssuesOpen}
          />
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
                Goods Receipt Notes
              </CardTitle>
              <CardDescription>
                Manage incoming stock and goods receipt notes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GRNTable />
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
                Track outgoing stock and material issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IssueTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5" />
                Transaction History
              </CardTitle>
              <CardDescription>
                Complete audit trail of all stock movements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionHistory />
            </CardContent>
          </Card>

          <StockMovementReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
