import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileImage, Download, CheckCircle } from "lucide-react";
import { useArtworkImport } from "@/hooks/useArtworkImport";

export function ArtworkImportDialog() {
  const [open, setOpen] = useState(false);
  const { importArtworkItems, isImporting } = useArtworkImport();

  const handleImport = async () => {
    await importArtworkItems.mutateAsync();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileImage className="h-4 w-4" />
          Import Artwork Items
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Finished Goods from Artwork Database</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileImage className="h-5 w-5" />
                Artwork Integration
              </CardTitle>
              <CardDescription>
                Import 359 finished goods from your artwork staging database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Source Data</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Artwork Items:</span>
                      <Badge variant="secondary">359 items</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Format:</span>
                      <Badge variant="outline">8-digit codes</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Type:</span>
                      <Badge variant="default">Finished Goods</Badge>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium">Import Features</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Auto-categorization
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Specification mapping
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Duplicate detection
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded-lg">
                <div className="text-sm font-medium mb-1">What will be imported:</div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Item codes, names, and customer information</li>
                  <li>• Dimensions, colors, and technical specifications</li>
                  <li>• Manufacturing parameters (UPS, circumference, length)</li>
                  <li>• Location and remarks data</li>
                </ul>
              </div>
            </CardContent>
          </Card>
          
          <div className="flex gap-3">
            <Button 
              onClick={handleImport} 
              disabled={isImporting}
              className="flex-1 gap-2"
            >
              <Download className="h-4 w-4" />
              {isImporting ? "Importing..." : "Import 359 Finished Goods"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}