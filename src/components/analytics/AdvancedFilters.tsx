import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Filter, RotateCcw } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { StockValuationFilters } from "@/hooks/useStockValuation";
import { useStockAnalytics } from "@/hooks/useStockAnalytics";

interface AdvancedFiltersProps {
  filters: StockValuationFilters;
  onFiltersChange: (filters: StockValuationFilters) => void;
  onApplyFilters: () => void;
}

export function AdvancedFilters({ filters, onFiltersChange, onApplyFilters }: AdvancedFiltersProps) {
  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    filters.dateFrom ? new Date(filters.dateFrom) : undefined
  );
  const [dateTo, setDateTo] = useState<Date | undefined>(
    filters.dateTo ? new Date(filters.dateTo) : undefined
  );
  const [isOpen, setIsOpen] = useState(false);

  const { categoryAnalysis } = useStockAnalytics();
  const categories = categoryAnalysis.data?.map(cat => cat.category) || [];

  const handleDateFromChange = (date: Date | undefined) => {
    setDateFrom(date);
    onFiltersChange({
      ...filters,
      dateFrom: date ? format(date, 'yyyy-MM-dd') : undefined
    });
  };

  const handleDateToChange = (date: Date | undefined) => {
    setDateTo(date);
    onFiltersChange({
      ...filters,
      dateTo: date ? format(date, 'yyyy-MM-dd') : undefined
    });
  };

  const handlePresetRange = (days: number) => {
    const to = new Date();
    const from = subDays(to, days);
    setDateFrom(from);
    setDateTo(to);
    onFiltersChange({
      ...filters,
      dateFrom: format(from, 'yyyy-MM-dd'),
      dateTo: format(to, 'yyyy-MM-dd')
    });
  };

  const resetFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    onFiltersChange({
      valuationMethod: 'WEIGHTED_AVG'
    });
  };

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.category || 
                          filters.supplier || filters.minValue || filters.maxValue;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          Advanced Filters
          {hasActiveFilters && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              {Object.values(filters).filter(Boolean).length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Filter Stock Analytics
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-8 gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date Range</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetRange(7)}
                  className="text-xs"
                >
                  7D
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetRange(30)}
                  className="text-xs"
                >
                  30D
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetRange(90)}
                  className="text-xs"
                >
                  90D
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetRange(365)}
                  className="text-xs"
                >
                  1Y
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={handleDateFromChange}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={handleDateToChange}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Category</Label>
              <Select
                value={filters.category || ""}
                onValueChange={(value) => 
                  onFiltersChange({ ...filters, category: value || undefined })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Supplier Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Supplier</Label>
              <Input
                placeholder="Enter supplier name"
                value={filters.supplier || ""}
                onChange={(e) => 
                  onFiltersChange({ ...filters, supplier: e.target.value || undefined })
                }
              />
            </div>

            {/* Value Range */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Value Range (₹)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Min</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.minValue || ""}
                    onChange={(e) => 
                      onFiltersChange({ 
                        ...filters, 
                        minValue: e.target.value ? parseFloat(e.target.value) : undefined 
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Max</Label>
                  <Input
                    type="number"
                    placeholder="No limit"
                    value={filters.maxValue || ""}
                    onChange={(e) => 
                      onFiltersChange({ 
                        ...filters, 
                        maxValue: e.target.value ? parseFloat(e.target.value) : undefined 
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Apply Button */}
            <Button 
              onClick={() => {
                onApplyFilters();
                setIsOpen(false);
              }}
              className="w-full"
            >
              Apply Filters
            </Button>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}