import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string;
    trend: "up" | "down" | "neutral";
  };
  icon: LucideIcon;
  description?: string;
}

export function StatCard({ title, value, change, icon: Icon, description }: StatCardProps) {
  const getTrendColor = (trend: "up" | "down" | "neutral") => {
    switch (trend) {
      case "up":
        return "text-green-600";
      case "down":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Card className="transition-all duration-200 hover:shadow-card animate-fade-in">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
            <p className="text-3xl font-bold text-foreground mb-1">{value}</p>
            {change && (
              <div className="flex items-center gap-1">
                <span className={`text-sm font-medium ${getTrendColor(change.trend)}`}>
                  {change.value}
                </span>
                {description && (
                  <span className="text-sm text-muted-foreground">vs last month</span>
                )}
              </div>
            )}
            {description && !change && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="ml-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}