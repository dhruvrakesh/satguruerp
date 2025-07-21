
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { ExportProgress } from "@/hooks/useExportProgress";

interface ExportProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: ExportProgress;
  onCancel?: () => void;
  exportType: string;
}

export function ExportProgressModal({
  open,
  onOpenChange,
  progress,
  onCancel,
  exportType
}: ExportProgressModalProps) {
  const formatNumber = (num: number) => num.toLocaleString();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Exporting {exportType}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{Math.round(progress.progress)}%</span>
            </div>
            <Progress value={progress.progress} className="w-full" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium">Records Processed</div>
              <div className="text-muted-foreground">
                {formatNumber(progress.recordsProcessed)} / {formatNumber(progress.totalRecords)}
              </div>
            </div>
            <div>
              <div className="font-medium">Chunks</div>
              <div className="text-muted-foreground">
                {progress.currentChunk} / {progress.totalChunks}
              </div>
            </div>
          </div>

          {progress.isExporting && (
            <div className="text-center text-sm text-muted-foreground">
              Processing large dataset in chunks for optimal performance...
            </div>
          )}

          {onCancel && progress.isExporting && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={onCancel} size="sm">
                <X className="w-4 h-4 mr-2" />
                Cancel Export
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
