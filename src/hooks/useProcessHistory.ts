import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOrderProcessHistory(uiorn: string) {
  return useQuery({
    queryKey: ["order-process-history", uiorn],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_order_process_history", {
        p_uiorn: uiorn,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!uiorn,
  });
}

export function useProcessStatistics() {
  return useQuery({
    queryKey: ["process-statistics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_process_statistics");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useOrderProcessHistoryView() {
  return useQuery({
    queryKey: ["order-process-history-view"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_process_history")
        .select("*")
        .limit(100)
        .order("captured_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}