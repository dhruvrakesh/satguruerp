
import { useState, useEffect } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useItemMaster } from "@/hooks/useItemMaster";
import { cn } from "@/lib/utils";

interface ItemCodeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}

export function ItemCodeSelector({ value, onChange, placeholder = "Search and select item...", error }: ItemCodeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInitialItems, setShowInitialItems] = useState(false);

  // Fetch items with larger page size for dropdown
  const { data: itemsData, isLoading } = useItemMaster({
    filters: { search: searchQuery || (showInitialItems ? "" : undefined) },
    pageSize: searchQuery ? 50 : 20 // Show more results when searching
  });

  // Get the selected item details
  const selectedItem = itemsData?.data?.find(item => item.item_code === value);

  // Handle opening the dropdown
  const handleOpen = () => {
    setOpen(true);
    setShowInitialItems(true);
    if (!searchQuery) {
      setSearchQuery(""); // This will trigger loading of initial items
    }
  };

  // Handle selection
  const handleSelect = (itemCode: string) => {
    onChange(itemCode);
    setOpen(false);
    setSearchQuery("");
    setShowInitialItems(false);
  };

  // Handle clear selection
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchQuery("");
  };

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setShowInitialItems(false);
    }
  }, [open]);

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between text-left font-normal",
              !value && "text-muted-foreground",
              error && "border-destructive"
            )}
            onClick={handleOpen}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Search className="h-4 w-4 shrink-0 opacity-50" />
              <span className="truncate">
                {selectedItem ? (
                  <span className="flex flex-col">
                    <span className="font-medium">{selectedItem.item_code}</span>
                    <span className="text-xs text-muted-foreground">{selectedItem.item_name}</span>
                  </span>
                ) : (
                  placeholder
                )}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {value && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleClear}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search items..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="h-9"
            />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>
                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="ml-2 text-sm">Searching...</span>
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm">
                    No items found.
                    {searchQuery && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Try searching with item code or name
                      </div>
                    )}
                  </div>
                )}
              </CommandEmpty>
              <CommandGroup>
                {itemsData?.data?.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.item_code}
                    onSelect={() => handleSelect(item.item_code)}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.item_code}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {item.uom}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground truncate">
                        {item.item_name}
                      </span>
                      {item.status && (
                        <span className="text-xs text-muted-foreground">
                          Status: {item.status}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
