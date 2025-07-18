import { useState } from "react";
import { Search, Package, FileText, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ArtworkItem {
  item_code: string;
  customer_name: string;
  item_name: string;
  dimensions: string;
  no_of_colours: string;
  file_hyperlink: string;
  ups: number;
  circum: number;
}

interface ArtworkItemSelectorProps {
  onSelect: (item: ArtworkItem) => void;
  selectedItem?: ArtworkItem | null;
}

export function ArtworkItemSelector({ onSelect, selectedItem }: ArtworkItemSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { data: artworkItems = [], isLoading } = useQuery({
    queryKey: ["artwork-items", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("_artworks_revised_staging")
        .select("item_code, customer_name, item_name, dimensions, no_of_colours, file_hyperlink, ups, circum")
        .order("customer_name");

      if (searchTerm) {
        query = query.or(`item_code.ilike.%${searchTerm}%,item_name.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data as ArtworkItem[];
    },
  });

  const ArtworkPreview = ({ item }: { item: ArtworkItem }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="p-1">
          <Eye className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item.item_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Customer:</strong> {item.customer_name}
            </div>
            <div>
              <strong>Dimensions:</strong> {item.dimensions}
            </div>
            <div>
              <strong>Colors:</strong> {item.no_of_colours}
            </div>
            <div>
              <strong>UPS:</strong> {item.ups}
            </div>
          </div>
          {item.file_hyperlink && (
            <div className="w-full">
              <iframe
                src={item.file_hyperlink}
                width="100%"
                height="400"
                className="border rounded"
                title="Artwork Preview"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by item code, product name, or customer..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {selectedItem && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-medium">{selectedItem.item_name}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedItem.customer_name} • {selectedItem.item_code}
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{selectedItem.dimensions}</Badge>
                  <Badge variant="outline">{selectedItem.no_of_colours}</Badge>
                  <Badge variant="outline">{selectedItem.ups} UPS</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <ArtworkPreview item={selectedItem} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpen(true)}
                >
                  Change
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedItem && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setIsOpen(true)}
        >
          <Package className="h-4 w-4 mr-2" />
          Select Item Code
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Artwork Item</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by item code, product name, or customer..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {isLoading ? (
              <div className="text-center py-8">Loading artwork items...</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                {artworkItems.map((item) => (
                  <Card
                    key={item.item_code}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      onSelect(item);
                      setIsOpen(false);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="font-medium">{item.item_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.customer_name} • {item.item_code}
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline">{item.dimensions}</Badge>
                            <Badge variant="outline">{item.no_of_colours}</Badge>
                            {item.ups && <Badge variant="outline">{item.ups} UPS</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <ArtworkPreview item={item} />
                          {item.file_hyperlink && (
                            <Badge variant="secondary">
                              <FileText className="h-3 w-3 mr-1" />
                              File
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}