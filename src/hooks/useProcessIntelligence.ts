import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProcessStage = Database["public"]["Enums"]["process_stage"];

interface ProcessParameter {
  metric: string;
  avg_value: number;
  records: number;
  stage: string;
}

interface ArtworkData {
  item_code: string;
  item_name: string;
  customer_name: string;
  dimensions: string;
  no_of_colours: string;
  ups?: number;
  circum?: number;
  coil_size?: string;
}

export function useProcessParameters(stage: ProcessStage) {
  return useQuery({
    queryKey: ["process-parameters", stage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_logs_se")
        .select("metric, value, stage")
        .eq("stage", stage)
        .not("value", "is", null);
      
      if (error) throw error;

      // Calculate averages and recommendations
      const parameterMap = new Map<string, number[]>();
      
      data.forEach((record) => {
        if (!parameterMap.has(record.metric)) {
          parameterMap.set(record.metric, []);
        }
        parameterMap.get(record.metric)?.push(record.value);
      });

      return Array.from(parameterMap.entries()).map(([metric, values]) => ({
        metric,
        avg_value: values.reduce((a, b) => a + b, 0) / values.length,
        min_value: Math.min(...values),
        max_value: Math.max(...values),
        records: values.length,
        stage,
        recommended: values.reduce((a, b) => a + b, 0) / values.length,
        variance: Math.sqrt(values.reduce((a, b) => a + Math.pow(b - (values.reduce((c, d) => c + d, 0) / values.length), 2), 0) / values.length)
      }));
    },
    enabled: !!stage,
  });
}

export function useArtworkByItemCode(itemCode: string) {
  return useQuery({
    queryKey: ["artwork", itemCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("_artworks_revised_staging")
        .select("*")
        .eq("item_code", itemCode)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as ArtworkData | null;
    },
    enabled: !!itemCode,
  });
}

export function useHistoricalParameters(uiorn: string, stage: ProcessStage) {
  return useQuery({
    queryKey: ["historical-parameters", uiorn, stage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_logs_se")
        .select("*")
        .eq("uiorn", uiorn)
        .eq("stage", stage)
        .order("captured_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!uiorn && !!stage,
  });
}

export function useOptimalParameters(itemCode: string, stage: ProcessStage) {
  return useQuery({
    queryKey: ["optimal-parameters", itemCode, stage],
    queryFn: async () => {
      // Get artwork data first
      const { data: artwork } = await supabase
        .from("_artworks_revised_staging")
        .select("*")
        .eq("item_code", itemCode)
        .single();

      if (!artwork) return null;

      // Find similar jobs based on dimensions and color count
      const dimensionMatch = artwork.dimensions?.split('x')[0]; // Width
      
      const { data: similarJobs, error } = await supabase
        .from("process_logs_se")
        .select("uiorn, metric, value")
        .eq("stage", stage)
        .not("value", "is", null);

      if (error) throw error;

      // Calculate optimal parameters based on historical data
      const parameterMap = new Map<string, number[]>();
      
      similarJobs.forEach((record) => {
        if (!parameterMap.has(record.metric)) {
          parameterMap.set(record.metric, []);
        }
        parameterMap.get(record.metric)?.push(record.value);
      });

      return {
        artwork,
        recommendations: Array.from(parameterMap.entries()).map(([metric, values]) => ({
          metric,
          recommended_value: values.reduce((a, b) => a + b, 0) / values.length,
          confidence: Math.min(values.length / 10, 1), // Max confidence at 10+ samples
          sample_size: values.length
        }))
      };
    },
    enabled: !!itemCode && !!stage,
  });
}

export function useProcessQualityAlerts(stage: ProcessStage) {
  return useQuery({
    queryKey: ["quality-alerts", stage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_logs_se")
        .select("*")
        .eq("stage", stage)
        .gte("captured_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("captured_at", { ascending: false });
      
      if (error) throw error;

      // Analyze for quality issues based on variance from optimal
      const alerts = [];
      const parameterGroups = new Map<string, any[]>();
      
      data.forEach((record) => {
        if (!parameterGroups.has(record.metric)) {
          parameterGroups.set(record.metric, []);
        }
        parameterGroups.get(record.metric)?.push(record);
      });

      parameterGroups.forEach((records, metric) => {
        if (records.length < 3) return;
        
        const values = records.map(r => r.value).filter(v => v !== null);
        if (values.length === 0) return;
        
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length);
        
        // Alert if recent values are outside 2 standard deviations
        const recentValues = values.slice(0, 3);
        const hasOutliers = recentValues.some(v => Math.abs(v - avg) > 2 * variance);
        
        if (hasOutliers && variance > avg * 0.1) { // 10% variance threshold
          alerts.push({
            metric,
            severity: variance > avg * 0.2 ? 'high' : 'medium',
            message: `${metric} showing high variance: ±${variance.toFixed(2)}`,
            recent_values: recentValues,
            expected_range: `${(avg - variance).toFixed(2)} - ${(avg + variance).toFixed(2)}`
          });
        }
      });

      return alerts;
    },
    refetchInterval: 60000, // Check every minute
  });
}