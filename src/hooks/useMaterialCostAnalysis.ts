import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MaterialCostSummary {
  uiorn: string;
  process_stage: string;
  total_input_cost: number;
  total_waste_cost: number;
  net_material_value: number;
  yield_percentage: number;
  cost_per_unit: number;
}

interface ProcessEfficiency {
  process_stage: string;
  avg_yield: number;
  avg_waste_cost: number;
  total_orders: number;
  efficiency_trend: 'improving' | 'declining' | 'stable';
}

export function useMaterialCostAnalysis(uiorn?: string) {
  const [costSummary, setCostSummary] = useState<MaterialCostSummary[]>([]);
  const [processEfficiency, setProcessEfficiency] = useState<ProcessEfficiency[]>([]);
  const [totalCostImpact, setTotalCostImpact] = useState({
    total_input_cost: 0,
    total_waste_cost: 0,
    overall_yield: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (uiorn) {
      loadCostAnalysis();
    } else {
      loadProcessEfficiency();
    }
  }, [uiorn]);

  const loadCostAnalysis = async () => {
    if (!uiorn) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('material_flow_tracking')
        .select('*')
        .eq('uiorn', uiorn)
        .order('recorded_at', { ascending: false });

      if (error) throw error;

      const summary: MaterialCostSummary[] = data?.reduce((acc: any[], flow) => {
        const existing = acc.find(item => item.process_stage === flow.process_stage);
        
        if (existing) {
          existing.total_input_cost += flow.total_input_cost || 0;
          existing.total_waste_cost += flow.waste_cost_impact || 0;
          existing.yield_percentage = (existing.yield_percentage + flow.yield_percentage) / 2;
        } else {
          acc.push({
            uiorn: flow.uiorn,
            process_stage: flow.process_stage,
            total_input_cost: flow.total_input_cost || 0,
            total_waste_cost: flow.waste_cost_impact || 0,
            net_material_value: (flow.total_input_cost || 0) - (flow.waste_cost_impact || 0),
            yield_percentage: flow.yield_percentage || 0,
            cost_per_unit: flow.material_cost_per_unit || 0
          });
        }
        return acc;
      }, []) || [];

      setCostSummary(summary);

      // Calculate total impact
      const totalInput = summary.reduce((sum, item) => sum + item.total_input_cost, 0);
      const totalWaste = summary.reduce((sum, item) => sum + item.total_waste_cost, 0);
      const avgYield = summary.length > 0 ? 
        summary.reduce((sum, item) => sum + item.yield_percentage, 0) / summary.length : 0;

      setTotalCostImpact({
        total_input_cost: totalInput,
        total_waste_cost: totalWaste,
        overall_yield: avgYield
      });

    } catch (error) {
      console.error('Error loading cost analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProcessEfficiency = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('material_flow_tracking')
        .select('process_stage, yield_percentage, waste_cost_impact, recorded_at')
        .order('recorded_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const processStats = data?.reduce((acc: any, flow) => {
        if (!acc[flow.process_stage]) {
          acc[flow.process_stage] = {
            process_stage: flow.process_stage,
            yields: [],
            waste_costs: [],
            total_orders: 0
          };
        }
        
        acc[flow.process_stage].yields.push(flow.yield_percentage || 0);
        acc[flow.process_stage].waste_costs.push(flow.waste_cost_impact || 0);
        acc[flow.process_stage].total_orders += 1;
        
        return acc;
      }, {});

      const efficiency: ProcessEfficiency[] = Object.values(processStats || {}).map((stat: any) => {
        const avgYield = stat.yields.reduce((sum: number, y: number) => sum + y, 0) / stat.yields.length;
        const avgWasteCost = stat.waste_costs.reduce((sum: number, c: number) => sum + c, 0) / stat.waste_costs.length;
        
        // Simple trend calculation based on recent vs older yields
        const recentYields = stat.yields.slice(0, Math.floor(stat.yields.length / 2));
        const olderYields = stat.yields.slice(Math.floor(stat.yields.length / 2));
        const recentAvg = recentYields.reduce((sum: number, y: number) => sum + y, 0) / recentYields.length;
        const olderAvg = olderYields.reduce((sum: number, y: number) => sum + y, 0) / olderYields.length;
        
        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        if (recentAvg > olderAvg + 2) trend = 'improving';
        else if (recentAvg < olderAvg - 2) trend = 'declining';

        return {
          process_stage: stat.process_stage,
          avg_yield: avgYield,
          avg_waste_cost: avgWasteCost,
          total_orders: stat.total_orders,
          efficiency_trend: trend
        };
      });

      setProcessEfficiency(efficiency);

    } catch (error) {
      console.error('Error loading process efficiency:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateProcessROI = (processStage: string) => {
    const processCost = costSummary.find(c => c.process_stage === processStage);
    if (!processCost) return 0;
    
    return processCost.total_input_cost > 0 ? 
      (processCost.net_material_value / processCost.total_input_cost) * 100 : 0;
  };

  const getYieldTrend = (processStage: string) => {
    const efficiency = processEfficiency.find(e => e.process_stage === processStage);
    return efficiency?.efficiency_trend || 'stable';
  };

  return {
    costSummary,
    processEfficiency,
    totalCostImpact,
    isLoading,
    calculateProcessROI,
    getYieldTrend,
    refreshData: uiorn ? loadCostAnalysis : loadProcessEfficiency
  };
}