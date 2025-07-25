import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ColorMeasurement {
  id: string;
  session_id: string;
  measured_l: number;
  measured_a: number;
  measured_b: number;
  delta_e: number;
  is_pass: boolean;
  measurement_notes?: string;
  captured_at: string;
}

export interface QCSession {
  id: string;
  uiorn: string;
  operator_id: string;
  target_l: number;
  target_a: number;
  target_b: number;
  delta_e_tolerance: number;
  status: 'active' | 'completed';
  start_time: string;
  end_time?: string;
}

export function useColorMeasurement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Start a new QC session
  const startQCSession = useMutation({
    mutationFn: async (uiorn: string) => {
      const { data, error } = await supabase.functions.invoke('start-qc-session', {
        body: { uiorn }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['qc-sessions'] });
      toast({
        title: "QC Session Started",
        description: `Color quality session started for order ${data.uiorn}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error Starting QC Session",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Record a color measurement
  const recordColorMeasurement = useMutation({
    mutationFn: async (measurement: {
      session_id: string;
      measured_l: number;
      measured_a: number;
      measured_b: number;
      measurement_notes?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('record-color-measurement', {
        body: measurement
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['color-measurements'] });
      queryClient.invalidateQueries({ queryKey: ['orders-dashboard'] });
      toast({
        title: data.is_pass ? "Measurement Recorded - PASS" : "Measurement Recorded - FAIL",
        description: `Delta E: ${data.delta_e.toFixed(2)} (Target: <${data.tolerance})`,
        variant: data.is_pass ? "default" : "destructive",
      });
    },
    onError: (error) => {
      toast({
        title: "Error Recording Measurement",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // End QC session
  const endQCSession = useMutation({
    mutationFn: async (session_id: string) => {
      const { data, error } = await supabase.functions.invoke('end-qc-session', {
        body: { session_id }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['qc-sessions'] });
      toast({
        title: "QC Session Completed",
        description: `${data.statistics.total_measurements} measurements recorded. Pass rate: ${data.statistics.pass_rate}%`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error Ending QC Session",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Get active QC session for an order
  const useActiveQCSession = (uiorn: string) => {
    return useQuery({
      queryKey: ['qc-sessions', uiorn, 'active'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('qc_sessions')
          .select('*')
          .eq('uiorn', uiorn)
          .eq('status', 'active')
          .order('start_time', { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data as QCSession | null;
      },
      enabled: !!uiorn,
    });
  };

  // Get color measurements for a session
  const useColorMeasurements = (session_id: string) => {
    return useQuery({
      queryKey: ['color-measurements', session_id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('color_measurements_log')
          .select('*')
          .eq('session_id', session_id)
          .order('captured_at', { ascending: false });

        if (error) throw error;
        return data as ColorMeasurement[];
      },
      enabled: !!session_id,
      refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
    });
  };

  // Get color trend data for an order
  const useColorTrends = (uiorn: string, days: number = 7) => {
    return useQuery({
      queryKey: ['color-trends', uiorn, days],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('color_measurements_log')
          .select(`
            *,
            qc_sessions!inner(uiorn)
          `)
          .eq('qc_sessions.uiorn', uiorn)
          .gte('captured_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
          .order('captured_at', { ascending: true });

        if (error) throw error;
        return data as (ColorMeasurement & { qc_sessions: { uiorn: string } })[];
      },
      enabled: !!uiorn,
    });
  };

  // Get current color status for dashboard
  const useColorStatus = (uiorn: string) => {
    return useQuery({
      queryKey: ['color-status', uiorn],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('orders_dashboard_se')
          .select('xrite_l, xrite_a, xrite_b, xrite_de, xrite_status')
          .eq('uiorn', uiorn)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
      },
      enabled: !!uiorn,
      refetchInterval: 10000, // Refresh every 10 seconds
    });
  };

  return {
    // Mutations
    startQCSession,
    recordColorMeasurement,
    endQCSession,
    
    // Queries
    useActiveQCSession,
    useColorMeasurements,
    useColorTrends,
    useColorStatus,
  };
}