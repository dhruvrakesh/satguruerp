
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Check, ChevronsUpDown, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useItemsForSelection } from "@/hooks/useItemMaster";

interface Item {
  item_code: string;
  item_name: string;
  uom: string;
  status: string;
  usage_type: string;
}

interface ItemSelectorProps {
  onSelect: (item: Item) => void;
  selectedItem?: Item | null;
}

export function ItemSelector({ onSelect, selectedItem }: ItemSelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: items = [], isLoading } = useItemsForSelection();

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
              <Package className="h-4 w-4" />
              <span className="truncate">
                {selectedItem.item_code} - {selectedItem.item_name}
              </span>
            </div>
          ) : (
            "Select item code..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0">
        <Command>
          <CommandInput placeholder="Search items..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading items..." : "No items found."}
            </CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.item_code}
                  value={`${item.item_code} ${item.item_name}`}
                  onSelect={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
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
                      <Badge variant="secondary" className="text-xs">
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
      </PopoverContent>
    </Popover>
  );
}
