import { useState } from "react";
import { format } from "date-fns";
import { FileSpreadsheet, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStockMovementExport } from "@/hooks/useDataExport";
import { toast } from "@/hooks/use-toast";

export function StockMovementReport() {
  const [dateFrom, setDateFrom] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const exportMovement = useStockMovementExport();

  const handleExport = () => {
    if (!dateFrom || !dateTo) {
      toast({
        title: "Invalid Date Range",
        description: "Please select both start and end dates",
        variant: "destructive"
      });
      return;
    }

    if (new Date(dateFrom) > new Date(dateTo)) {
      toast({
        title: "Invalid Date Range", 
        description: "Start date cannot be after end date",
        variant: "destructive"
      });
      return;
    }

    exportMovement.mutate({ dateFrom, dateTo });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Stock Movement Report
        </CardTitle>
        <CardDescription>
          Generate comprehensive stock movement analysis for any date range
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleExport}
            disabled={exportMovement.isPending}
            className="flex-1"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {exportMovement.isPending ? "Generating Report..." : "Generate Movement Report"}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>This report includes:</p>
          <ul className="mt-1 ml-4 space-y-1 list-disc">
            <li>Item-wise total received quantities</li>
            <li>Item-wise total issued quantities</li>
            <li>Net movement calculations</li>
            <li>Excel format for easy analysis</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}