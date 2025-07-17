import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export interface ConsumptionData {
  item_code: string;
  item_name: string;
  category: string;
  monthly_consumption: number;
  average_consumption: number;
  trend_direction: 'increasing' | 'decreasing' | 'stable';
  trend_percentage: number;
  seasonality_score: number;
  forecast_next_month: number;
  safety_stock_recommended: number;
  variance_coefficient: number;
  consumption_pattern: 'regular' | 'irregular' | 'seasonal' | 'declining';
}

export interface ConsumptionTrendData {
  period: string;
  total_consumption: number;
  unique_items: number;
  average_per_item: number;
}

export interface ConsumptionFilters {
  months?: number;
  category?: string;
  itemCode?: string;
  minConsumption?: number;
}

export const useConsumptionPatterns = (filters: ConsumptionFilters = {}) => {
  const { months = 12, category, itemCode, minConsumption } = filters;

  return useQuery({
    queryKey: ["consumption-patterns", filters],
    queryFn: async (): Promise<ConsumptionData[]> => {
      const startDate = startOfMonth(subMonths(new Date(), months));
      const endDate = endOfMonth(new Date());

      // Get consumption data from issue_log
      let query = supabase
        .from("issue_log")
        .select(`
          item_code,
          qty_issued,
          issue_date,
          item_master!inner(item_name, categories(category_name))
        `)
        .gte("issue_date", format(startDate, "yyyy-MM-dd"))
        .lte("issue_date", format(endDate, "yyyy-MM-dd"));

      if (category) {
        query = query.eq("item_master.categories.category_name", category);
      }

      if (itemCode) {
        query = query.eq("item_code", itemCode);
      }

      const { data: issueData, error } = await query;

      if (error) throw error;

      // Process data to calculate consumption patterns
      const consumptionMap = new Map<string, {
        item_code: string;
        item_name: string;
        category: string;
        monthly_data: number[];
        total_consumption: number;
      }>();

      issueData?.forEach((issue: any) => {
        const key = issue.item_code;
        const consumption = issue.qty_issued || 0;
        const month = new Date(issue.issue_date).getMonth();
        
        if (!consumptionMap.has(key)) {
          consumptionMap.set(key, {
            item_code: issue.item_code,
            item_name: issue.item_master?.item_name || '',
            category: issue.item_master?.categories?.category_name || 'Uncategorized',
            monthly_data: new Array(12).fill(0),
            total_consumption: 0
          });
        }

        const item = consumptionMap.get(key)!;
        item.monthly_data[month] += consumption;
        item.total_consumption += consumption;
      });

      // Calculate patterns and analytics
      const results: ConsumptionData[] = Array.from(consumptionMap.values())
        .filter(item => !minConsumption || item.total_consumption >= minConsumption)
        .map(item => {
          const nonZeroMonths = item.monthly_data.filter(m => m > 0);
          const avgConsumption = nonZeroMonths.length > 0 
            ? nonZeroMonths.reduce((a, b) => a + b, 0) / nonZeroMonths.length 
            : 0;

          // Calculate trend
          const recentAvg = item.monthly_data.slice(-3).reduce((a, b) => a + b, 0) / 3;
          const earlierAvg = item.monthly_data.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
          const trendPercentage = earlierAvg > 0 
            ? ((recentAvg - earlierAvg) / earlierAvg) * 100 
            : 0;

          let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
          if (Math.abs(trendPercentage) > 10) {
            trendDirection = trendPercentage > 0 ? 'increasing' : 'decreasing';
          }

          // Calculate variance coefficient
          const variance = item.monthly_data.reduce((acc, val) => {
            return acc + Math.pow(val - avgConsumption, 2);
          }, 0) / item.monthly_data.length;
          const stdDev = Math.sqrt(variance);
          const varianceCoefficient = avgConsumption > 0 ? (stdDev / avgConsumption) * 100 : 0;

          // Determine consumption pattern
          let pattern: 'regular' | 'irregular' | 'seasonal' | 'declining' = 'regular';
          if (varianceCoefficient > 50) pattern = 'irregular';
          else if (trendDirection === 'decreasing' && trendPercentage < -20) pattern = 'declining';
          else if (varianceCoefficient > 25) pattern = 'seasonal';

          // Calculate seasonality score (simplified)
          const seasonalityScore = Math.min(varianceCoefficient / 100, 1);

          // Forecast next month (simple moving average with trend)
          const lastThreeMonths = item.monthly_data.slice(-3);
          const baselineForecast = lastThreeMonths.reduce((a, b) => a + b, 0) / 3;
          const trendAdjustment = (trendPercentage / 100) * baselineForecast;
          const forecastNextMonth = Math.max(0, baselineForecast + trendAdjustment);

          // Safety stock recommendation (based on variability)
          const safetyStockRecommended = Math.ceil(avgConsumption * (1 + varianceCoefficient / 100) * 0.5);

          return {
            item_code: item.item_code,
            item_name: item.item_name,
            category: item.category,
            monthly_consumption: avgConsumption,
            average_consumption: avgConsumption,
            trend_direction: trendDirection,
            trend_percentage: Math.round(trendPercentage * 100) / 100,
            seasonality_score: Math.round(seasonalityScore * 100) / 100,
            forecast_next_month: Math.round(forecastNextMonth),
            safety_stock_recommended: safetyStockRecommended,
            variance_coefficient: Math.round(varianceCoefficient * 100) / 100,
            consumption_pattern: pattern
          };
        });

      return results.sort((a, b) => b.monthly_consumption - a.monthly_consumption);
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });
};

export const useConsumptionTrends = (months: number = 12) => {
  return useQuery({
    queryKey: ["consumption-trends", months],
    queryFn: async (): Promise<ConsumptionTrendData[]> => {
      const startDate = startOfMonth(subMonths(new Date(), months));
      const endDate = endOfMonth(new Date());

      const { data, error } = await supabase
        .from("issue_log")
        .select("qty_issued, issue_date")
        .gte("issue_date", format(startDate, "yyyy-MM-dd"))
        .lte("issue_date", format(endDate, "yyyy-MM-dd"));

      if (error) throw error;

      // Group by month
      const monthlyData = new Map<string, { total: number; items: Set<string> }>();

      data?.forEach((issue: any) => {
        const monthKey = format(new Date(issue.issue_date), "yyyy-MM");
        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, { total: 0, items: new Set() });
        }
        const month = monthlyData.get(monthKey)!;
        month.total += issue.qty_issued || 0;
        month.items.add(issue.item_code);
      });

      return Array.from(monthlyData.entries())
        .map(([period, data]) => ({
          period,
          total_consumption: data.total,
          unique_items: data.items.size,
          average_per_item: data.items.size > 0 ? data.total / data.items.size : 0
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
    }
  });
};