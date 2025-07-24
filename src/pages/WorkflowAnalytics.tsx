import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Activity, Clock, Zap, TrendingDown } from "lucide-react";

const workflowData = [
  { stage: 'Order Processing', avgTime: 2.1, bottleneck: false },
  { stage: 'Material Planning', avgTime: 4.5, bottleneck: true },
  { stage: 'Production Setup', avgTime: 1.8, bottleneck: false },
  { stage: 'Manufacturing', avgTime: 12.3, bottleneck: false },
  { stage: 'Quality Check', avgTime: 3.2, bottleneck: true },
  { stage: 'Packaging', avgTime: 1.5, bottleneck: false },
  { stage: 'Dispatch', avgTime: 2.1, bottleneck: false },
];

const cycleTimeData = [
  { week: 'W1', cycleTime: 28.5, target: 24 },
  { week: 'W2', cycleTime: 26.8, target: 24 },
  { week: 'W3', cycleTime: 24.2, target: 24 },
  { week: 'W4', cycleTime: 22.9, target: 24 },
];

export default function WorkflowAnalytics() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Workflow Analytics</h1>
        <p className="text-muted-foreground">Process optimization and bottleneck analysis</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
            <p className="text-xs text-muted-foreground">
              +23 since yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cycle Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">25.6h</div>
            <p className="text-xs text-muted-foreground">
              -2.4h from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94.2%</div>
            <p className="text-xs text-muted-foreground">
              +1.2% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bottlenecks</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">
              Critical stages identified
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bottlenecks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bottlenecks">Bottleneck Analysis</TabsTrigger>
          <TabsTrigger value="cycle-time">Cycle Time Trends</TabsTrigger>
          <TabsTrigger value="efficiency">Process Efficiency</TabsTrigger>
        </TabsList>

        <TabsContent value="bottlenecks">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Stage Analysis</CardTitle>
              <CardDescription>Average time spent in each workflow stage</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={workflowData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="stage" type="category" width={120} />
                  <Tooltip />
                  <Bar 
                    dataKey="avgTime" 
                    fill="hsl(var(--primary))"
                    name="Avg Time (hours)"
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-primary"></div>
                  <span className="text-sm text-muted-foreground">Normal Flow</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-destructive"></div>
                  <span className="text-sm text-muted-foreground">Bottleneck</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cycle-time">
          <Card>
            <CardHeader>
              <CardTitle>Cycle Time Improvement</CardTitle>
              <CardDescription>Weekly cycle time performance vs target</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cycleTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="target" 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeDasharray="5 5"
                    name="Target"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cycleTime" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Actual"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="efficiency">
          <Card>
            <CardHeader>
              <CardTitle>Process Efficiency Metrics</CardTitle>
              <CardDescription>Overall workflow performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">Detailed efficiency metrics coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}