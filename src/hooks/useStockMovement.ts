import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StockMovementData {
  date: string;
  received: number;
  issued: number;
}

export const useStockMovement = (days: number = 30) => {
  return useQuery({
    queryKey: ["stock-movement", days],
    queryFn: async (): Promise<StockMovementData[]> => {
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

      // Get GRN data
      const { data: grnData, error: grnError } = await supabase
        .from("satguru_grn_log")
        .select("date, qty_received")
        .gte("date", fromDate)
        .order("date");

      if (grnError) throw grnError;

      // Get issue data
      const { data: issueData, error: issueError } = await supabase
        .from("satguru_issue_log")
        .select("date, qty_issued")
        .gte("date", fromDate)
        .order("date");

      if (issueError) throw issueError;

      // Combine and aggregate by date
      const combinedData: { [key: string]: { received: number; issued: number } } = {};

      // Process GRN data
      grnData?.forEach(item => {
        const dateStr = item.date;
        if (!combinedData[dateStr]) {
          combinedData[dateStr] = { received: 0, issued: 0 };
        }
        combinedData[dateStr].received += item.qty_received || 0;
      });

      // Process issue data
      issueData?.forEach(item => {
        const dateStr = item.date;
        if (!combinedData[dateStr]) {
          combinedData[dateStr] = { received: 0, issued: 0 };
        }
        combinedData[dateStr].issued += item.qty_issued || 0;
      });

      // Convert to array and sort
      return Object.entries(combinedData)
        .map(([date, data]) => ({
          date,
          received: data.received,
          issued: data.issued,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    },
    refetchInterval: 60000, // Refresh every minute
  });
};