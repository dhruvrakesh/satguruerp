
import { useState, useEffect } from "react";
import { Search, Package, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ItemCodeSelectorProps {
  value: string;
  onChange: (itemCode: string, itemData: ItemData) => void;
  placeholder?: string;
  vendorId?: string;
  error?: string;
}

interface ItemData {
  item_code: string;
  item_name: string;
  uom: string;
  category_name?: string;
  current_stock?: number;
  last_purchase?: {
    price: number;
    date: string;
    vendor: string;
  };
}

interface PurchaseHistoryItem {
  item_code: string;
  item_name: string;
  uom: string;
  category_name: string;
  current_stock: number;
  last_purchase_price: number;
  last_purchase_date: string;
  last_vendor_name: string;
  stock_status: string;
}

export function ItemCodeSelector({ 
  value, 
  onChange, 
  placeholder = "Search and select item...", 
  vendorId,
  error 
}: ItemCodeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch items with purchase history
  const { data: itemsData, isLoading } = useQuery({
    queryKey: ['procurement-items', searchQuery, vendorId],
    queryFn: async () => {
      let query = supabase
        .from('satguru_item_master')
        .select(`
          item_code,
          item_name,
          uom,
          category_id,
          status,
          categories:category_id(category_name)
        `)
        .eq('status', 'active')
        .order('item_name');

      if (searchQuery && searchQuery.trim() !== '') {
        query = query.or(`item_code.ilike.%${searchQuery}%,item_name.ilike.%${searchQuery}%`);
      }

      const { data: items, error } = await query.limit(50);
      
      if (error) throw error;

      // Get purchase history for each item
      const itemsWithHistory = await Promise.all(
        (items || []).map(async (item) => {
          // Get current stock
          const { data: stockData } = await supabase
            .from('satguru_stock_summary_view')
            .select('current_qty, stock_status')
            .eq('item_code', item.item_code)
            .maybeSingle();

          // Get last purchase info
          const { data: lastPurchase } = await supabase
            .from('satguru_grn_log')
            .select(`
              unit_price,
              date,
              supplier_name,
              suppliers:supplier_id(supplier_name)
            `)
            .eq('item_code', item.item_code)
            .not('unit_price', 'is', null)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            item_code: item.item_code,
            item_name: item.item_name,
            uom: item.uom,
            category_name: item.categories?.category_name || 'Unknown',
            current_stock: stockData?.current_qty || 0,
            last_purchase_price: lastPurchase?.unit_price || 0,
            last_purchase_date: lastPurchase?.date || '',
            last_vendor_name: lastPurchase?.supplier_name || lastPurchase?.suppliers?.supplier_name || 'Unknown',
            stock_status: stockData?.stock_status || 'normal'
          };
        })
      );

      return itemsWithHistory;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const selectedItem = itemsData?.find(item => item.item_code === value);

  const handleSelect = (item: PurchaseHistoryItem) => {
    const itemData: ItemData = {
      item_code: item.item_code,
      item_name: item.item_name,
      uom: item.uom,
      category_name: item.category_name,
      current_stock: item.current_stock,
      last_purchase: item.last_purchase_price > 0 ? {
        price: item.last_purchase_price,
        date: item.last_purchase_date,
        vendor: item.last_vendor_name
      } : undefined
    };
    
    onChange(item.item_code, itemData);
    setOpen(false);
    setSearchQuery("");
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'out_of_stock': return 'bg-red-100 text-red-800';
      case 'low_stock': return 'bg-yellow-100 text-yellow-800';
      case 'overstock': return 'bg-blue-100 text-blue-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

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
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Package className="h-4 w-4 shrink-0 opacity-50" />
              {selectedItem ? (
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedItem.item_code}</span>
                    <Badge variant="outline" className="text-xs">
                      {selectedItem.uom}
                    </Badge>
                    <Badge className={cn("text-xs", getStockStatusColor(selectedItem.stock_status))}>
                      {selectedItem.current_stock} {selectedItem.uom}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground truncate">
                    {selectedItem.item_name}
                  </span>
                </div>
              ) : (
                <span className="truncate">{placeholder}</span>
              )}
            </div>
            <Search className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[600px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search by item code or name..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="h-9"
            />
            <CommandList className="max-h-[400px]">
              <CommandEmpty>
                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="ml-2 text-sm">Loading items...</span>
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm">
                    No items found.
                    {searchQuery && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Try searching with different keywords
                      </div>
                    )}
                  </div>
                )}
              </CommandEmpty>
              <CommandGroup>
                {itemsData?.map((item) => (
                  <CommandItem
                    key={item.item_code}
                    value={`${item.item_code} ${item.item_name}`}
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer p-4"
                  >
                    <div className="flex flex-col w-full space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.item_code}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.uom}
                          </Badge>
                          <Badge className={cn("text-xs", getStockStatusColor(item.stock_status))}>
                            {item.current_stock} {item.uom}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                          {item.category_name}
                        </span>
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        {item.item_name}
                      </div>
                      
                      {item.last_purchase_price > 0 && (
                        <Card className="bg-muted/50">
                          <CardContent className="p-2">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>Last Purchase:</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">₹{item.last_purchase_price.toFixed(2)}</span>
                                <span className="text-muted-foreground">
                                  {item.last_purchase_date ? new Date(item.last_purchase_date).toLocaleDateString() : 'N/A'}
                                </span>
                                <span className="text-muted-foreground">
                                  via {item.last_vendor_name}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
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
