
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RecentGRN {
  grn_number: string;
  item_code: string;
  qty_received: number;
  vendor: string;
  date: string;
  amount_inr: number;
  id: string;
  created_at: string;
}

export interface RecentIssue {
  id: string;
  item_code: string;
  qty_issued: number;
  purpose: string;
  date: string;
  total_issued_qty: number;
  created_at: string;
}

const CHUNK_SIZE = 1000;

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
        console.log(`🔍 Starting GRN query - showAll: ${showAll}, limit: ${limit}, search: "${searchQuery}"`);
        
        if (showAll) {
          // For showAll, we need to handle large datasets by fetching in chunks
          const allRecords: RecentGRN[] = [];
          let hasMore = true;
          let offset = 0;
          
          while (hasMore) {
            let query = supabase
              .from("satguru_grn_log")
              .select("id, grn_number, item_code, qty_received, vendor, date, amount_inr, created_at")
              .order("created_at", { ascending: false })
              .range(offset, offset + CHUNK_SIZE - 1);
            
            // Filter out opening stock entries
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

            const { data, error } = await query;
            
            if (error) {
              console.error('GRN chunk query error:', error);
              throw error;
            }
            
            if (data && data.length > 0) {
              allRecords.push(...data);
              console.log(`📊 GRN chunk loaded: ${data.length} records (total: ${allRecords.length})`);
              
              // If we got less than chunk size, we've reached the end
              if (data.length < CHUNK_SIZE) {
                hasMore = false;
              } else {
                offset += CHUNK_SIZE;
              }
            } else {
              hasMore = false;
            }
            
            // Safety break to prevent infinite loops
            if (offset > 10000) {
              console.warn('⚠️ Safety break: More than 10,000 records, stopping fetch');
              hasMore = false;
            }
          }
          
          console.log(`✅ GRN Complete Dataset: ${allRecords.length} records (showAll: ${showAll})`);
          return allRecords;
        } else {
          // Regular limited query
          let query = supabase
            .from("satguru_grn_log")
            .select("id, grn_number, item_code, qty_received, vendor, date, amount_inr, created_at")
            .order("created_at", { ascending: false });
          
          // Filter out opening stock entries
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
          
          // Apply limit for regular view
          if (limit) {
            query = query.limit(limit);
          }

          const { data, error } = await query;
          
          if (error) {
            console.error('GRN query error:', error);
            throw error;
          }
          
          console.log(`✅ GRN Limited Query: ${data?.length || 0} records (showAll: ${showAll}, limit: ${limit})`);
          return data || [];
        }
      } catch (error) {
        console.error('GRN hook error:', error);
        throw error;
      }
    },
    refetchInterval: 30000,
    staleTime: 10000,
    gcTime: 300000,
  });

  const recentIssues = useQuery({
    queryKey: ["recent-issues", limit, showAll, searchQuery, typeFilter, dateRange],
    queryFn: async () => {
      try {
        console.log(`🔍 Starting Issues query - showAll: ${showAll}, limit: ${limit}, search: "${searchQuery}"`);
        
        if (showAll) {
          // For showAll, we need to handle large datasets by fetching in chunks
          const allRecords: RecentIssue[] = [];
          let hasMore = true;
          let offset = 0;
          
          while (hasMore) {
            let query = supabase
              .from("satguru_issue_log")
              .select("id, item_code, qty_issued, purpose, date, total_issued_qty, created_at")
              .order("created_at", { ascending: false })
              .range(offset, offset + CHUNK_SIZE - 1);
            
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

            const { data, error } = await query;
            
            if (error) {
              console.error('Issues chunk query error:', error);
              throw error;
            }
            
            if (data && data.length > 0) {
              allRecords.push(...data);
              console.log(`📊 Issues chunk loaded: ${data.length} records (total: ${allRecords.length})`);
              
              // If we got less than chunk size, we've reached the end
              if (data.length < CHUNK_SIZE) {
                hasMore = false;
              } else {
                offset += CHUNK_SIZE;
              }
            } else {
              hasMore = false;
            }
            
            // Safety break to prevent infinite loops
            if (offset > 10000) {
              console.warn('⚠️ Safety break: More than 10,000 records, stopping fetch');
              hasMore = false;
            }
          }
          
          console.log(`✅ Issues Complete Dataset: ${allRecords.length} records (showAll: ${showAll})`);
          return allRecords;
        } else {
          // Regular limited query
          let query = supabase
            .from("satguru_issue_log")
            .select("id, item_code, qty_issued, purpose, date, total_issued_qty, created_at")
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
          
          // Apply limit for regular view
          if (limit) {
            query = query.limit(limit);
          }

          const { data, error } = await query;
          
          if (error) {
            console.error('Issues query error:', error);
            throw error;
          }
          
          console.log(`✅ Issues Limited Query: ${data?.length || 0} records (showAll: ${showAll}, limit: ${limit})`);
          return data || [];
        }
      } catch (error) {
        console.error('Issues hook error:', error);
        throw error;
      }
    },
    refetchInterval: 30000,
    staleTime: 10000,
    gcTime: 300000,
  });

  return {
    recentGRN,
    recentIssues,
  };
};
