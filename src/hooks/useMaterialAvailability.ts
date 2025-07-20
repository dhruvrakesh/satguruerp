import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MaterialAvailability {
  uiorn: string;
  process_stage: string;
  available_quantity: number;
  quality_grade: string;
  recorded_at: string;
  operator_id: string | null;
  availability_status: 'AVAILABLE' | 'TRANSFERRED';
}

export interface BOMVarianceResult {
  planned_consumption: number;
  actual_consumption: number;
  variance_percentage: number;
  status: 'WITHIN_TOLERANCE' | 'OVER_CONSUMPTION' | 'UNDER_CONSUMPTION';
}

export interface OrderProgressResult {
  uiorn: string;
  completed_processes: number;
  total_processes: number;
  current_stage: string;
  progress_percentage: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export const useMaterialAvailability = (uiorn?: string, processStage?: string) => {
  return useQuery({
    queryKey: ['material-availability', uiorn, processStage],
    queryFn: async () => {
      let query = supabase
        .from('material_availability_view')
        .select('*');

      if (uiorn) {
        query = query.eq('uiorn', uiorn);
      }

      if (processStage) {
        query = query.eq('process_stage', processStage as any);
      }

      const { data, error } = await query.order('recorded_at', { ascending: false });

      if (error) throw error;
      return data as MaterialAvailability[];
    },
    enabled: true,
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
  });
};

export const useBOMVarianceAnalysis = (uiorn: string, processStage: string) => {
  return useQuery({
    queryKey: ['bom-variance', uiorn, processStage],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_bom_variance', {
        p_uiorn: uiorn,
        p_process_stage: processStage
      });

      if (error) throw error;
      return data as unknown as BOMVarianceResult;
    },
    enabled: !!uiorn && !!processStage,
  });
};

export const useOrderMaterialProgress = (uiorn: string) => {
  return useQuery({
    queryKey: ['order-material-progress', uiorn],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_order_material_progress', {
        p_uiorn: uiorn
      });

      if (error) throw error;
      return data as unknown as OrderProgressResult;
    },
    enabled: !!uiorn,
    refetchInterval: 30000,
  });
};