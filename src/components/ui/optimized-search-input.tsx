
import { useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OptimizedSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isSearching?: boolean;
}

export function OptimizedSearchInput({ 
  value, 
  onChange, 
  placeholder = "Search...",
  className,
  disabled = false,
  isSearching = false
}: OptimizedSearchInputProps) {
  const [localValue, setLocalValue] = useState(value);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  }, [onChange]);

  const handleClear = useCallback(() => {
    setLocalValue("");
    onChange("");
  }, [onChange]);

  return (
    <div className={cn("relative", className)}>
      <Search className={cn(
        "absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 transition-colors",
        isSearching ? "text-primary animate-pulse" : "text-muted-foreground"
      )} />
      <Input
        value={localValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "pl-10 pr-10 transition-all duration-200",
          isSearching && "border-primary/50"
        )}
      />
      {localValue && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
          disabled={disabled}
        >
          <X className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}
