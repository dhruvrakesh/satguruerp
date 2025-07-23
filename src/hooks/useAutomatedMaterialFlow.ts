import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UpstreamMaterial {
  material_id: string;
  process_stage: string;
  material_type: string;
  available_quantity: number;
  quality_grade: string;
  recorded_at: string;
  operator_id: string;
}

interface AutoTransferResult {
  success: boolean;
  transferred_count: number;
  total_quantity: number;
  from_process: string;
  to_process: string;
  uiorn: string;
}

interface MaterialFlowValidation {
  uiorn: string;
  is_valid: boolean;
  gaps_found: number;
  process_gaps: any[];
  validation_timestamp: string;
}

export function useAutomatedMaterialFlow(uiorn: string) {
  const queryClient = useQueryClient();

  // Get available upstream materials
  const getUpstreamMaterials = (currentProcess: string) => {
    return useQuery<UpstreamMaterial[]>({
      queryKey: ['upstream-materials', uiorn, currentProcess],
      queryFn: async () => {
        // Using direct SQL call through supabase client
        const { data, error } = await (supabase as any).rpc('get_available_upstream_materials', {
          p_uiorn: uiorn,
          p_current_process: currentProcess
        });
        
        if (error) throw error;
        return (data || []) as UpstreamMaterial[];
      },
      enabled: !!uiorn && !!currentProcess,
      refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
    });
  };

  // Auto-transfer materials between processes
  const autoTransferMutation = useMutation<AutoTransferResult, Error, {
    fromProcess: string;
    toProcess: string;
    operatorId?: string;
  }>({
    mutationFn: async ({ fromProcess, toProcess, operatorId }) => {
      const { data, error } = await (supabase as any).rpc('auto_transfer_good_materials', {
        p_uiorn: uiorn,
        p_from_process: fromProcess,
        p_to_process: toProcess,
        p_operator_id: operatorId
      });
      
      if (error) throw error;
      return data as AutoTransferResult;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['upstream-materials'] });
      queryClient.invalidateQueries({ queryKey: ['process-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['material-flow-continuity'] });
    }
  });

  // Validate material flow continuity
  const validateMaterialFlowQuery = useQuery<MaterialFlowValidation>({
    queryKey: ['material-flow-validation', uiorn],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('validate_material_flow_continuity', {
        p_uiorn: uiorn
      });
      
      if (error) throw error;
      return data as MaterialFlowValidation;
    },
    enabled: !!uiorn,
    refetchInterval: 60000, // Refresh every minute
  });

  // Get material flow tracking data (using existing table)
  const materialFlowContinuityQuery = useQuery({
    queryKey: ['material-flow-continuity', uiorn],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('material_flow_tracking')
        .select('*')
        .eq('uiorn', uiorn)
        .order('recorded_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!uiorn,
    refetchInterval: 30000,
  });

  return {
    getUpstreamMaterials,
    autoTransferMutation,
    validateMaterialFlowQuery,
    materialFlowContinuityQuery,
  };
}

// Enhanced hook for specific process material availability
// Enhanced material type validation hook
export function useMaterialTypeValidation() {
  const validateCompatibility = async (
    fromProcess: string,
    toProcess: string,
    materialType: string
  ): Promise<boolean> => {
    const { data, error } = await (supabase as any).rpc('validate_material_type_compatibility', {
      p_from_process: fromProcess,
      p_to_process: toProcess,
      p_material_type: materialType
    });
    
    if (error) throw error;
    return data as boolean;
  };

  return { validateCompatibility };
}

export function useProcessMaterialAvailability(uiorn: string, processStage: string) {
  return useQuery({
    queryKey: ['process-material-availability', uiorn, processStage],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('material_flow_tracking')
        .select('*')
        .eq('uiorn', uiorn)
        .eq('process_stage', processStage)
        .gt('output_good_quantity', 0);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!uiorn && !!processStage,
    refetchInterval: 15000, // More frequent updates for active processes
  });
}