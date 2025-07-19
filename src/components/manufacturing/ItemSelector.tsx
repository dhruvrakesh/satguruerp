
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Package, Palette, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useItemsForSelection } from "@/hooks/useItemMaster";
import { useArtworkItemsForSelection, ArtworkItem } from "@/hooks/useArtworkItems";

interface Item {
  item_code: string;
  item_name: string;
  uom: string;
  status: string;
  usage_type: string;
  customer_name?: string;
  no_of_colours?: string;
  dimensions?: string;
  file_hyperlink?: string;
}

interface ItemSelectorProps {
  onSelect: (item: Item) => void;
  selectedItem?: Item | null;
}

export function ItemSelector({ onSelect, selectedItem }: ItemSelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: rmItems = [], isLoading: rmLoading } = useItemsForSelection();
  const { data: fgItems = [], isLoading: fgLoading } = useArtworkItemsForSelection();

  const handleSelect = (item: Item | ArtworkItem) => {
    const standardizedItem: Item = {
      item_code: item.item_code,
      item_name: item.item_name,
      uom: item.uom,
      status: item.status,
      usage_type: item.usage_type,
      ...(('customer_name' in item) && {
        customer_name: item.customer_name,
        no_of_colours: item.no_of_colours,
        dimensions: item.dimensions,
        file_hyperlink: item.file_hyperlink
      })
    };
    onSelect(standardizedItem);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedItem ? (
            <div className="flex items-center gap-2 truncate">
              {selectedItem.usage_type === 'FG' ? (
                <Palette className="h-4 w-4 text-purple-600" />
              ) : (
                <Wrench className="h-4 w-4 text-blue-600" />
              )}
              <span className="truncate">
                {selectedItem.item_code} - {selectedItem.item_name}
              </span>
              {selectedItem.customer_name && (
                <Badge variant="outline" className="text-xs">
                  {selectedItem.customer_name}
                </Badge>
              )}
            </div>
          ) : (
            "Select item code..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[600px] p-0">
        <Tabs defaultValue="rm" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="rm" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Raw Materials & Supplies ({rmItems.length})
            </TabsTrigger>
            <TabsTrigger value="fg" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Finished Goods - Artworks ({fgItems.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="rm" className="mt-0">
            <Command>
              <CommandInput placeholder="Search raw materials..." />
              <CommandList>
                <CommandEmpty>
                  {rmLoading ? "Loading items..." : "No raw materials found."}
                </CommandEmpty>
                <CommandGroup>
                  {rmItems.map((item) => (
                    <CommandItem
                      key={item.item_code}
                      value={`${item.item_code} ${item.item_name}`}
                      onSelect={() => handleSelect(item)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedItem?.item_code === item.item_code
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{item.item_code}</span>
                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                            {item.usage_type}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {item.item_name}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </TabsContent>
          
          <TabsContent value="fg" className="mt-0">
            <Command>
              <CommandInput placeholder="Search finished goods..." />
              <CommandList>
                <CommandEmpty>
                  {fgLoading ? "Loading artworks..." : "No finished goods found."}
                </CommandEmpty>
                <CommandGroup>
                  {fgItems.map((item) => (
                    <CommandItem
                      key={item.item_code}
                      value={`${item.item_code} ${item.item_name} ${item.customer_name}`}
                      onSelect={() => handleSelect(item)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedItem?.item_code === item.item_code
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{item.item_code}</span>
                          <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                            FG
                          </Badge>
                          {item.customer_name && (
                            <Badge variant="outline" className="text-xs">
                              {item.customer_name}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {item.item_name}
                        </div>
                        {(item.dimensions || item.no_of_colours) && (
                          <div className="text-xs text-muted-foreground flex gap-2 mt-1">
                            {item.dimensions && <span>📐 {item.dimensions}</span>}
                            {item.no_of_colours && <span>🎨 {item.no_of_colours} colors</span>}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
