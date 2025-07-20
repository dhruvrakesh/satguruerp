
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

export const useRecentTransactions = (limit?: number) => {
  const recentGRN = useQuery({
    queryKey: ["recent-grn", limit],
    queryFn: async () => {
      try {
        let query = supabase
          .from("satguru_grn_log")
          .select("grn_number, item_code, qty_received, vendor, date, amount_inr")
          .order("created_at", { ascending: false });
        
        // Filter out opening stock entries using transaction_type column
        query = query.neq('transaction_type', 'OPENING_STOCK');
        
        if (limit) {
          query = query.limit(limit);
        }

        const { data, error } = await query;
        
        if (error) {
          console.error('Recent GRN query error:', error);
          throw error;
        }
        
        return data || [];
      } catch (error) {
        console.error('Recent GRN hook error:', error);
        throw error;
      }
    },
    refetchInterval: 30000,
  });

  const recentIssues = useQuery({
    queryKey: ["recent-issues", limit],
    queryFn: async () => {
      try {
        let query = supabase
          .from("satguru_issue_log")
          .select("id, item_code, qty_issued, purpose, date, total_issued_qty")
          .order("created_at", { ascending: false });
        
        if (limit) {
          query = query.limit(limit);
        }

        const { data, error } = await query;
        
        if (error) {
          console.error('Recent issues query error:', error);
          throw error;
        }
        
        return data || [];
      } catch (error) {
        console.error('Recent issues hook error:', error);
        throw error;
      }
    },
    refetchInterval: 30000,
  });

  return {
    recentGRN,
    recentIssues,
  };
};
