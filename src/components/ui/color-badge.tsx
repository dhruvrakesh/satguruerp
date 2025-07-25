import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ColorBadgeProps {
  status: "PASS" | "FAIL" | "PENDING" | null | undefined;
  className?: string;
}

export function ColorBadge({ status, className }: ColorBadgeProps) {
  const getStatusConfig = (status: string | null | undefined) => {
    switch (status) {
      case "PASS":
        return {
          text: "PASS",
          className: "bg-green-100 text-green-800 border-green-200 hover:bg-green-100",
        };
      case "FAIL":
        return {
          text: "FAIL",
          className: "bg-red-100 text-red-800 border-red-200 hover:bg-red-100",
        };
      case "PENDING":
        return {
          text: "PENDING",
          className: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100",
        };
      default:
        return {
          text: "NOT MEASURED",
          className: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100",
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge 
      className={cn(config.className, className)}
      variant="outline"
    >
      {config.text}
    </Badge>
  );
}