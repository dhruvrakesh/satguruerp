import { useState } from "react";
import { ItemMasterTable } from "@/components/item-master/ItemMasterTable";
import { BulkUploadDialog } from "@/components/item-master/BulkUploadDialog";

export default function ItemMaster() {
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  return (
    <div className="container mx-auto p-6">
      <ItemMasterTable onBulkUpload={() => setShowBulkUpload(true)} />
      
      <BulkUploadDialog 
        open={showBulkUpload} 
        onOpenChange={setShowBulkUpload} 
      />
    </div>
  );
}