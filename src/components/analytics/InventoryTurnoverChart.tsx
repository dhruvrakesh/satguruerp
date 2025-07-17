import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInventoryTurnover } from "@/hooks/useInventoryTurnover";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { RotateCcw, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

const TURNOVER_COLORS = {
  Fast: "hsl(var(--chart-1))",
  Medium: "hsl(var(--chart-2))",
  Slow: "hsl(var(--chart-3))",
  Dead: "hsl(var(--chart-4))"
};

export function InventoryTurnoverChart() {
  const [selectedPeriod, setSelectedPeriod] = useState("90");
  const { turnoverSummary, turnoverAnalysis } = useInventoryTurnover(Number(selectedPeriod));
  const { data: summaryData, isLoading, error } = turnoverSummary;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Inventory Turnover Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-80">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !summaryData || summaryData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Inventory Turnover Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-80">
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5" />
          Inventory Turnover Analysis
        </CardTitle>
        <div className="flex justify-end">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 Days</SelectItem>
              <SelectItem value="60">60 Days</SelectItem>
              <SelectItem value="90">90 Days</SelectItem>
              <SelectItem value="180">180 Days</SelectItem>
              <SelectItem value="365">1 Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Movement Classification Pie Chart */}
          <div className="h-64">
            <h4 className="text-sm font-medium mb-2">Movement Classification</h4>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summaryData}
                  dataKey="percentage"
                  nameKey="classification"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ classification, percentage }) => `${classification}: ${percentage.toFixed(1)}%`}
                >
                  {summaryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={TURNOVER_COLORS[entry.classification]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Percentage']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Average Turnover Bar Chart */}
          <div className="h-64">
            <h4 className="text-sm font-medium mb-2">Average Turnover Ratio</h4>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summaryData}>
                <XAxis dataKey="classification" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(2)}`, 'Avg Turnover']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="avg_turnover" 
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {summaryData.map((item) => (
            <div key={item.classification} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{item.classification}</span>
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: TURNOVER_COLORS[item.classification] }} 
                />
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-2xl font-bold">{item.item_count}</p>
                <p className="text-xs text-muted-foreground">
                  {item.percentage.toFixed(1)}% of items
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg: {item.avg_turnover.toFixed(2)}x
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}