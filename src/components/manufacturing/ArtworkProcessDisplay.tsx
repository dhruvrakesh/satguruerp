import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Palette, Layers, Package, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ArtworkProcessDisplayProps {
  uiorn: string;
  itemCode?: string;
  artworkData?: {
    item_code: string;
    customer_name: string;
    item_name: string;
    dimensions: string;
    no_of_colours: string;
    file_hyperlink: string;
    ups: number;
    circum: number;
  };
  processType: "lamination" | "coating" | "printing" | "slitting";
}

export function ArtworkProcessDisplay({ 
  uiorn, 
  itemCode, 
  artworkData, 
  processType 
}: ArtworkProcessDisplayProps) {
  if (!artworkData && !itemCode) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-muted-foreground">
          No artwork data available for this order
        </CardContent>
      </Card>
    );
  }

  const getProcessSpecificInfo = () => {
    if (!artworkData) return null;

    switch (processType) {
      case "lamination":
        return {
          title: "Lamination Specifications",
          icon: <Layers className="h-5 w-5" />,
          specs: [
            { label: "Substrate Width", value: artworkData.dimensions },
            { label: "Bond Area", value: `${artworkData.ups} units per sheet` },
            { label: "Roll Circumference", value: `${artworkData.circum}mm` },
          ]
        };
      case "coating":
        return {
          title: "Coating Requirements",
          icon: <Package className="h-5 w-5" />,
          specs: [
            { label: "Coverage Area", value: artworkData.dimensions },
            { label: "Color Layers", value: artworkData.no_of_colours },
            { label: "Units Per Sheet", value: artworkData.ups?.toString() || "N/A" },
          ]
        };
      case "printing":
        return {
          title: "Printing Setup",
          icon: <Palette className="h-5 w-5" />,
          specs: [
            { label: "Color Count", value: artworkData.no_of_colours },
            { label: "Print Dimensions", value: artworkData.dimensions },
            { label: "Cylinder Requirement", value: `${artworkData.circum}mm circum` },
          ]
        };
      case "slitting":
        return {
          title: "Slitting Program",
          icon: <Package className="h-5 w-5" />,
          specs: [
            { label: "Cut Dimensions", value: artworkData.dimensions },
            { label: "Units Per Sheet", value: artworkData.ups?.toString() || "N/A" },
            { label: "Roll Configuration", value: `${artworkData.circum}mm` },
          ]
        };
      default:
        return null;
    }
  };

  const processInfo = getProcessSpecificInfo();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {processInfo?.icon}
            {processInfo?.title || "Process Specifications"}
          </div>
          {artworkData?.file_hyperlink && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View Artwork
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>{artworkData.item_name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><strong>Customer:</strong> {artworkData.customer_name}</div>
                    <div><strong>Item Code:</strong> {artworkData.item_code}</div>
                    <div><strong>Dimensions:</strong> {artworkData.dimensions}</div>
                    <div><strong>Colors:</strong> {artworkData.no_of_colours}</div>
                  </div>
                  <div className="w-full">
                    <iframe
                      src={artworkData.file_hyperlink}
                      width="100%"
                      height="500"
                      className="border rounded"
                      title="Artwork Preview"
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {artworkData && (
          <>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <div className="font-medium">{artworkData.item_name}</div>
                <div className="text-sm text-muted-foreground">
                  {artworkData.customer_name} • {artworkData.item_code}
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{artworkData.dimensions}</Badge>
                <Badge variant="outline">{artworkData.no_of_colours}</Badge>
                {artworkData.file_hyperlink && (
                  <Badge variant="secondary">
                    <FileText className="h-3 w-3 mr-1" />
                    File
                  </Badge>
                )}
              </div>
            </div>

            {processInfo && (
              <div className="grid grid-cols-1 gap-3">
                {processInfo.specs.map((spec, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <span className="text-sm font-medium">{spec.label}:</span>
                    <span className="text-sm text-muted-foreground">{spec.value}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!artworkData && itemCode && (
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-sm text-yellow-800">
              Item Code: <strong>{itemCode}</strong>
            </div>
            <div className="text-xs text-yellow-600 mt-1">
              Artwork data not found for this item code
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}