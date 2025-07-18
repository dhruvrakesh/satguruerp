
import { useState } from "react";
import { ItemMasterTable } from "@/components/item-master/ItemMasterTable";
import { BulkUploadDialog } from "@/components/item-master/BulkUploadDialog";
import { ItemMasterCleanup } from "@/components/item-master/ItemMasterCleanup";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, Database, Upload } from "lucide-react";

export default function ItemMaster() {
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  return (
    <ErrorBoundary>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header with quick links */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Item Master Management</h1>
            <p className="text-muted-foreground">Manage item master data, specifications, and data cleanup</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.open('/specification-master', '_blank')}>
              <FileText className="h-4 w-4 mr-2" />
              Specification Master
            </Button>
            <Button variant="outline" onClick={() => window.open('/stock-operations', '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Stock Operations
            </Button>
          </div>
        </div>

        {/* Quick Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Common data management tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="h-auto p-4 flex flex-col gap-2" onClick={() => setShowBulkUpload(true)}>
                <Upload className="w-6 h-6" />
                <span className="font-medium">Bulk Upload Items</span>
                <span className="text-sm text-muted-foreground">Upload new items from CSV</span>
              </Button>
              
              <Button variant="outline" className="h-auto p-4 flex flex-col gap-2" onClick={() => window.open('/stock-operations', '_blank')}>
                <Database className="w-6 h-6" />
                <span className="font-medium">Upload Opening Stock</span>
                <span className="text-sm text-muted-foreground">Set initial stock quantities</span>
              </Button>
              
              <Button variant="outline" className="h-auto p-4 flex flex-col gap-2" onClick={() => window.open('/specification-master', '_blank')}>
                <FileText className="w-6 h-6" />
                <span className="font-medium">Manage Specifications</span>
                <span className="text-sm text-muted-foreground">Upload and manage item specifications</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="items" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="items">Item Master</TabsTrigger>
            <TabsTrigger value="cleanup">Data Cleanup</TabsTrigger>
          </TabsList>
          
          <TabsContent value="items" className="space-y-6">
            <ItemMasterTable onBulkUpload={() => setShowBulkUpload(true)} />
          </TabsContent>
          
          <TabsContent value="cleanup" className="space-y-6">
            <ItemMasterCleanup />
          </TabsContent>
        </Tabs>
        
        <BulkUploadDialog 
          open={showBulkUpload} 
          onOpenChange={setShowBulkUpload} 
        />
      </div>
    </ErrorBoundary>
  );
}
