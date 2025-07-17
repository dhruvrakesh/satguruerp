import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Factory, Clock, AlertTriangle } from "lucide-react";

const productionData = [
  {
    machine: "Flexo Press #1",
    currentJob: "ORD-2024-001",
    progress: 75,
    status: "Running",
    statusColor: "bg-green-500" as const,
    operator: "Rajesh Kumar",
    estimatedCompletion: "2 hours"
  },
  {
    machine: "Digital Press #2", 
    currentJob: "ORD-2024-004",
    progress: 45,
    status: "Running",
    statusColor: "bg-green-500" as const,
    operator: "Suresh Patel",
    estimatedCompletion: "4 hours"
  },
  {
    machine: "Rotary Press #3",
    currentJob: "Maintenance",
    progress: 0,
    status: "Maintenance",
    statusColor: "bg-yellow-500" as const,
    operator: "Tech Team",
    estimatedCompletion: "1 hour"
  },
  {
    machine: "Lamination Unit #1",
    currentJob: "ORD-2024-002",
    progress: 90,
    status: "Finishing",
    statusColor: "bg-blue-500" as const,
    operator: "Amit Singh",
    estimatedCompletion: "30 mins"
  }
];

export function ProductionOverview() {
  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Factory className="w-5 h-5 text-primary" />
          Production Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {productionData.map((machine) => (
            <div key={machine.machine} className="p-4 border border-border/50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-foreground">{machine.machine}</h4>
                  <p className="text-sm text-muted-foreground">Job: {machine.currentJob}</p>
                </div>
                <Badge className={`${machine.statusColor} text-white`}>
                  {machine.status}
                </Badge>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{machine.progress}%</span>
                  </div>
                  <Progress value={machine.progress} className="h-2" />
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>Operator: {machine.operator}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{machine.estimatedCompletion}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}