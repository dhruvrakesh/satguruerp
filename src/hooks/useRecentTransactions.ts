import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RecentGRN {
  grn_number: string;
  item_code: string;
  qty_received: number;
  vendor: string;
  date: string;
  amount_inr: number;
}

export interface RecentIssue {
  id: string;
  item_code: string;
  qty_issued: number;
  purpose: string;
  date: string;
  total_issued_qty: number;
}

export const useRecentTransactions = (limit: number = 5) => {
  const recentGRN = useQuery({
    queryKey: ["recent-grn", limit],
    queryFn: async (): Promise<RecentGRN[]> => {
      const { data, error } = await supabase
        .from("satguru_grn_log")
        .select("grn_number, item_code, qty_received, vendor, date, amount_inr")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const recentIssues = useQuery({
    queryKey: ["recent-issues", limit],
    queryFn: async (): Promise<RecentIssue[]> => {
      const { data, error } = await supabase
        .from("satguru_issue_log")
        .select("id, item_code, qty_issued, purpose, date, total_issued_qty")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  return {
    recentGRN,
    recentIssues,
  };
};