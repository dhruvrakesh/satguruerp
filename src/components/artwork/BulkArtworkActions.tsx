
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Edit, Trash2, X } from "lucide-react";

interface BulkArtworkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDownload: () => void;
  onBulkEdit: () => void;
}

export function BulkArtworkActions({ 
  selectedCount, 
  onClearSelection, 
  onBulkDownload, 
  onBulkEdit 
}: BulkArtworkActionsProps) {
  return (
    <Card className="p-4 bg-blue-50 border-blue-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium text-blue-900">
            {selectedCount} artwork{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onBulkDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download PDFs
            </Button>
            <Button size="sm" variant="outline" onClick={onBulkEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Bulk Edit
            </Button>
            <Button size="sm" variant="outline">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
