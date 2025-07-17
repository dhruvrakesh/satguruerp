import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MLForecastData {
  forecast_period: string;
  algorithm: string;
  predicted_demand: number;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  model_accuracy: number;
  feature_importance: Record<string, number>;
}

export interface ForecastFilters {
  itemCode?: string;
  forecastHorizon?: number;
  confidenceLevel?: number;
}

export const useMLForecasting = (filters: ForecastFilters) => {
  return useQuery({
    queryKey: ["ml-forecasting", filters],
    queryFn: async () => {
      if (!filters.itemCode) {
        return [];
      }

      const { data, error } = await supabase.rpc("ml_demand_prediction", {
        p_item_code: filters.itemCode,
        p_forecast_horizon: filters.forecastHorizon || 3,
        p_confidence_level: filters.confidenceLevel || 0.95,
      });

      if (error) {
        console.error("Error fetching ML forecasting data:", error);
        throw error;
      }

      return data as MLForecastData[];
    },
    enabled: !!filters.itemCode,
    refetchInterval: 300000, // 5 minutes
  });
};

export interface AdvancedForecastData {
  forecast_month: string;
  simple_moving_average: number;
  exponential_smoothing: number;
  linear_trend: number;
  seasonal_adjusted: number;
  confidence_score: number;
  recommended_forecast: number;
}

export const useAdvancedForecasting = (filters: ForecastFilters) => {
  return useQuery({
    queryKey: ["advanced-forecasting", filters],
    queryFn: async () => {
      if (!filters.itemCode) {
        return [];
      }

      const { data, error } = await supabase.rpc("advanced_demand_forecast", {
        p_item_code: filters.itemCode,
        p_forecast_months: filters.forecastHorizon || 6,
      });

      if (error) {
        console.error("Error fetching advanced forecasting data:", error);
        throw error;
      }

      return data as AdvancedForecastData[];
    },
    enabled: !!filters.itemCode,
    refetchInterval: 300000, // 5 minutes
  });
};

export interface AnomalyData {
  item_code: string;
  item_name: string;
  anomaly_date: string;
  expected_consumption: number;
  actual_consumption: number;
  deviation_factor: number;
  anomaly_type: 'high_consumption' | 'low_consumption' | 'normal';
}

export const useConsumptionAnomalies = (itemCode?: string, thresholdFactor: number = 2.0) => {
  return useQuery({
    queryKey: ["consumption-anomalies", itemCode, thresholdFactor],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("detect_consumption_anomalies", {
        p_item_code: itemCode || null,
        p_threshold_factor: thresholdFactor,
      });

      if (error) {
        console.error("Error fetching consumption anomalies:", error);
        throw error;
      }

      return data as AnomalyData[];
    },
    refetchInterval: 300000, // 5 minutes
  });
};