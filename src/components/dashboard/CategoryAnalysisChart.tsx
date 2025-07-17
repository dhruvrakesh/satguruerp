import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStockAnalytics } from "@/hooks/useStockAnalytics";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Loader2 } from "lucide-react";

export function CategoryAnalysisChart() {
  const { categoryAnalysis } = useStockAnalytics();
  const { data, isLoading, error } = categoryAnalysis;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Category-wise Stock Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-80">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Category-wise Stock Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-80">
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const truncateCategory = (category: string) => {
    return category.length > 15 ? category.substring(0, 15) + "..." : category;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Category-wise Stock Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="horizontal">
              <XAxis 
                type="number" 
                className="text-xs"
              />
              <YAxis 
                dataKey="category" 
                type="category" 
                width={100}
                tickFormatter={truncateCategory}
                className="text-xs"
              />
              <Tooltip 
                formatter={(value, name) => [
                  `${value} ${name === 'totalQty' ? 'units' : 'items'}`,
                  name === 'totalQty' ? 'Total Quantity' : 'Item Count'
                ]}
                labelFormatter={(category) => `Category: ${category}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar 
                dataKey="totalQty" 
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}