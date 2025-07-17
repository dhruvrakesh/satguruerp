import { useState } from "react";
import { ItemMasterTable } from "@/components/item-master/ItemMasterTable";
import { BulkUploadDialog } from "@/components/item-master/BulkUploadDialog";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function ItemMaster() {
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  return (
    <ErrorBoundary>
      <div className="container mx-auto p-6">
        <ItemMasterTable onBulkUpload={() => setShowBulkUpload(true)} />
        
        <BulkUploadDialog 
          open={showBulkUpload} 
          onOpenChange={setShowBulkUpload} 
        />
      </div>
    </ErrorBoundary>
  );
}