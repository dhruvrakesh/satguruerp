
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

export const useRecentTransactions = (
  limit?: number, 
  showAll: boolean = false,
  searchQuery?: string,
  typeFilter?: string,
  dateRange?: { from: string; to: string }
) => {
  const recentGRN = useQuery({
    queryKey: ["recent-grn", limit, showAll, searchQuery, typeFilter, dateRange],
    queryFn: async () => {
      try {
        let query = supabase
          .from("satguru_grn_log")
          .select("grn_number, item_code, qty_received, vendor, date, amount_inr")
          .order("created_at", { ascending: false });
        
        // Filter out opening stock entries using transaction_type column
        query = query.neq('transaction_type', 'OPENING_STOCK');
        
        // Apply search filter at database level
        if (searchQuery && searchQuery.trim() !== '') {
          const searchTerm = searchQuery.trim();
          query = query.or(`item_code.ilike.%${searchTerm}%,grn_number.ilike.%${searchTerm}%,vendor.ilike.%${searchTerm}%`);
        }
        
        // Apply date range filter
        if (dateRange?.from) {
          query = query.gte('date', dateRange.from);
        }
        if (dateRange?.to) {
          query = query.lte('date', dateRange.to);
        }
        
        // Only apply limit if NOT showing all records AND limit is specified
        if (!showAll && limit) {
          query = query.limit(limit);
        }

        const { data, error } = await query;
        
        if (error) {
          console.error('Recent GRN query error:', error);
          throw error;
        }
        
        console.log(`✅ GRN Query Results: ${data?.length || 0} records (showAll: ${showAll}, limit: ${limit}, search: "${searchQuery}")`);
        return data || [];
      } catch (error) {
        console.error('Recent GRN hook error:', error);
        throw error;
      }
    },
    refetchInterval: 30000,
  });

  const recentIssues = useQuery({
    queryKey: ["recent-issues", limit, showAll, searchQuery, typeFilter, dateRange],
    queryFn: async () => {
      try {
        let query = supabase
          .from("satguru_issue_log")
          .select("id, item_code, qty_issued, purpose, date, total_issued_qty")
          .order("created_at", { ascending: false });
        
        // Apply search filter at database level
        if (searchQuery && searchQuery.trim() !== '') {
          const searchTerm = searchQuery.trim();
          query = query.or(`item_code.ilike.%${searchTerm}%,purpose.ilike.%${searchTerm}%,id.ilike.%${searchTerm}%`);
        }
        
        // Apply date range filter
        if (dateRange?.from) {
          query = query.gte('date', dateRange.from);
        }
        if (dateRange?.to) {
          query = query.lte('date', dateRange.to);
        }
        
        // Only apply limit if NOT showing all records AND limit is specified
        if (!showAll && limit) {
          query = query.limit(limit);
        }

        const { data, error } = await query;
        
        if (error) {
          console.error('Recent issues query error:', error);
          throw error;
        }
        
        console.log(`✅ Issues Query Results: ${data?.length || 0} records (showAll: ${showAll}, limit: ${limit}, search: "${searchQuery}")`);
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
