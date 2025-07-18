import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrderProcessHistoryView, useProcessStatistics } from "@/hooks/useProcessHistory";
import { Search, Activity, TrendingUp, Clock, Hash } from "lucide-react";
import { format } from "date-fns";

export function ProcessHistoryViewer() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: processHistory = [], isLoading } = useOrderProcessHistoryView();
  const { data: statistics = [] } = useProcessStatistics();

  const filteredHistory = processHistory.filter(
    (entry) =>
      entry.uiorn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.stage?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStageColor = (stage: string) => {
    switch (stage?.toUpperCase()) {
      case "PRINTING":
        return "bg-blue-100 text-blue-800";
      case "LAMINATION":
        return "bg-green-100 text-green-800";
      case "SLITTING":
        return "bg-orange-100 text-orange-800";
      case "COATING":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatValue = (value: number | null, txtValue: string | null, metric: string) => {
    if (txtValue) return txtValue;
    if (value !== null) {
      if (metric.includes("temperature")) return `${value}°C`;
      if (metric.includes("speed")) return `${value} mpm`;
      if (metric.includes("viscosity")) return `${value} sec`;
      return value.toString();
    }
    return "-";
  };

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statistics.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.stage?.replace("_", " ")}
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.total_entries}</div>
              <p className="text-xs text-muted-foreground">
                {stat.unique_orders} unique orders
              </p>
              {stat.latest_activity && (
                <p className="text-xs text-muted-foreground mt-1">
                  Latest: {format(new Date(stat.latest_activity), "MMM dd, HH:mm")}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Process History ({filteredHistory.length} records)
          </CardTitle>
          <CardDescription>
            Historical process data from production operations - 889 total entries integrated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by UIORN, customer, stage..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => setSearchTerm("")}>
              Clear
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>UIORN</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Captured At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="h-4 w-4 animate-spin" />
                        Loading process history...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No process history found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.slice(0, 50).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Hash className="h-3 w-3 text-muted-foreground" />
                          {entry.uiorn}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStageColor(entry.stage)}>
                          {entry.stage?.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.metric?.replace("_", " ")}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatValue(entry.value, entry.txt_value, entry.metric || "")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.customer_name || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.captured_at
                          ? format(new Date(entry.captured_at), "MMM dd, HH:mm:ss")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredHistory.length > 50 && (
            <p className="text-sm text-muted-foreground mt-2">
              Showing first 50 of {filteredHistory.length} results
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}