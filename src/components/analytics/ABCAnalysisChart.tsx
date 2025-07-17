import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useABCAnalysis } from "@/hooks/useABCAnalysis";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Loader2 } from "lucide-react";

const ABC_COLORS = {
  A: "hsl(var(--chart-1))",
  B: "hsl(var(--chart-2))", 
  C: "hsl(var(--chart-3))"
};

export function ABCAnalysisChart() {
  const { abcSummary } = useABCAnalysis();
  const { data, isLoading, error } = abcSummary;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            ABC Analysis
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
            <TrendingUp className="w-5 h-5" />
            ABC Analysis
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
          <TrendingUp className="w-5 h-5" />
          ABC Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Value Distribution Pie Chart */}
          <div className="h-64">
            <h4 className="text-sm font-medium mb-2">Value Distribution</h4>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="percentage_value"
                  nameKey="class"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ class: cls, percentage_value }) => `${cls}: ${percentage_value.toFixed(1)}%`}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={ABC_COLORS[entry.class]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`₹${value.toFixed(0)}`, 'Value %']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Item Count Bar Chart */}
          <div className="h-64">
            <h4 className="text-sm font-medium mb-2">Item Distribution</h4>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis dataKey="class" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${value} ${name === 'item_count' ? 'items' : '%'}`,
                    name === 'item_count' ? 'Items' : 'Percentage'
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="item_count" 
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          {data.map((item) => (
            <div key={item.class} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Class {item.class}</span>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ABC_COLORS[item.class] }} />
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-2xl font-bold">{item.item_count}</p>
                <p className="text-xs text-muted-foreground">
                  {item.percentage_items.toFixed(1)}% of items
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.percentage_value.toFixed(1)}% of value
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}