import { useState } from "react";
import { ItemMasterTable } from "@/components/item-master/ItemMasterTable";
import { BulkUploadDialog } from "@/components/item-master/BulkUploadDialog";
import { ItemMasterCleanup } from "@/components/item-master/ItemMasterCleanup";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ItemMaster() {
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  return (
    <ErrorBoundary>
      <div className="container mx-auto p-6">
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