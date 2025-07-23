
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProcessReadiness {
  process: string;
  is_ready: boolean;
  available_materials: number;
  total_quantity: number;
  quality_issues: number;
  pending_transfers: number;
  readiness_score: number;
  assessment_timestamp: string;
}

interface YieldAnalysis {
  uiorn: string;
  overall_yield_percentage: number;
  total_input: number;
  total_output: number;
  total_waste: number;
  total_rework: number;
  waste_percentage: number;
  rework_percentage: number;
  process_yields: any[];
  calculated_at: string;
}

interface Bottleneck {
  process: string;
  bottleneck_score: number;
  avg_yield: number;
  avg_processing_hours: number;
  total_waste: number;
  total_rework: number;
  recommendation: string;
}

interface BottleneckAnalysis {
  bottlenecks: Bottleneck[];
  analysis_scope: 'single_order' | 'all_orders';
  analyzed_at: string;
}

interface ReworkRoutingResult {
  success: boolean;
  rework_routed_to: string;
  quantity: number;
  material_type: string;
  routing_timestamp: string;
}

interface ProcessParameter {
  metric: string;
  current_value: number;
  recommended_value: number;
  optimization_score: number;
  recommendation: string;
}

interface QualityAlert {
  alert_id: string;
  process: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  created_at: string;
  status: 'ACTIVE' | 'RESOLVED';
}

// Type-safe helper function for process stage validation
const validateProcessStage = (process: string): 'GRAVURE_PRINTING' | 'ADHESIVE_COATING' | 'PRINTING' | 'LAMINATION' | 'SLITTING' | 'DISPATCH' => {
  const validProcessStages = ['GRAVURE_PRINTING', 'ADHESIVE_COATING', 'PRINTING', 'LAMINATION', 'SLITTING', 'DISPATCH'] as const;
  
  // Handle common mapping cases
  if (process === 'PACKAGING') {
    return 'DISPATCH';
  }
  
  // Check if the process is already valid
  if (validProcessStages.includes(process as any)) {
    return process as 'GRAVURE_PRINTING' | 'ADHESIVE_COATING' | 'PRINTING' | 'LAMINATION' | 'SLITTING' | 'DISPATCH';
  }
  
  // Default fallback
  console.warn(`Invalid process stage: ${process}, mapping to DISPATCH`);
  return 'DISPATCH';
};

export function useProcessIntelligence() {
  const queryClient = useQueryClient();

  // Assess process readiness
  const useProcessReadiness = (uiorn: string, targetProcess: string) => {
    return useQuery<ProcessReadiness>({
      queryKey: ['process-readiness', uiorn, targetProcess],
      queryFn: async () => {
        const { data, error } = await (supabase as any).rpc('assess_process_readiness', {
          p_uiorn: uiorn,
          p_target_process: targetProcess
        });
        
        if (error) throw error;
        return data as ProcessReadiness;
      },
      enabled: !!uiorn && !!targetProcess,
      refetchInterval: 30000,
    });
  };

  // Calculate end-to-end yield
  const useEndToEndYield = (uiorn: string) => {
    return useQuery<YieldAnalysis>({
      queryKey: ['end-to-end-yield', uiorn],
      queryFn: async () => {
        const { data, error } = await (supabase as any).rpc('calculate_end_to_end_yield', {
          p_uiorn: uiorn
        });
        
        if (error) throw error;
        return data as YieldAnalysis;
      },
      enabled: !!uiorn,
      refetchInterval: 60000,
    });
  };

  // Identify process bottlenecks
  const useBottleneckAnalysis = (uiorn?: string) => {
    return useQuery<BottleneckAnalysis>({
      queryKey: ['bottleneck-analysis', uiorn || 'all'],
      queryFn: async () => {
        const { data, error } = await (supabase as any).rpc('identify_process_bottlenecks', {
          p_uiorn: uiorn || null
        });
        
        if (error) throw error;
        return data as BottleneckAnalysis;
      },
      refetchInterval: 120000,
    });
  };

  // Validate material type compatibility
  const validateMaterialCompatibility = async (
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

  // Route rework material
  const routeReworkMutation = useMutation<ReworkRoutingResult, Error, {
    uiorn: string;
    materialType: string;
    qualityGrade: string;
    reworkQuantity: number;
    currentProcess: string;
  }>({
    mutationFn: async ({ uiorn, materialType, qualityGrade, reworkQuantity, currentProcess }) => {
      const { data, error } = await (supabase as any).rpc('route_rework_material', {
        p_uiorn: uiorn,
        p_material_type: materialType,
        p_quality_grade: qualityGrade,
        p_rework_quantity: reworkQuantity,
        p_current_process: currentProcess
      });
      
      if (error) throw error;
      return data as ReworkRoutingResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['process-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['material-flow-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['process-readiness'] });
    }
  });

  return {
    useProcessReadiness,
    useEndToEndYield,
    useBottleneckAnalysis,
    validateMaterialCompatibility,
    routeReworkMutation,
  };
}

// Process parameters hook - now queries process_logs_se for process-specific metrics
export const useProcessParameters = (process: string) => {
  return useQuery<ProcessParameter[]>({
    queryKey: ['process-parameters', process],
    queryFn: async () => {
      // Use the type-safe helper function to validate and cast the process
      const validatedProcess = validateProcessStage(process);

      // Query process_logs_se for process-specific metrics and transform to ProcessParameter format
      const { data, error } = await supabase
        .from('process_logs_se')
        .select('*')
        .eq('stage', validatedProcess)
        .eq('metric', 'parameter_optimization')
        .order('captured_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      // Transform the data to match ProcessParameter interface
      const transformedData: ProcessParameter[] = data?.map(log => ({
        metric: log.txt_value || 'unknown_parameter',
        current_value: log.value || 0,
        recommended_value: log.value ? log.value * 1.1 : 0, // Mock recommendation
        optimization_score: Math.random() * 100, // Mock score
        recommendation: `Optimize ${log.txt_value || 'parameter'} for better performance`
      })) || [];
      
      return transformedData;
    },
    enabled: !!process,
  });
};

// Process quality alerts hook - now queries quality_checkpoints for quality issues
export const useProcessQualityAlerts = (process: string) => {
  return useQuery<QualityAlert[]>({
    queryKey: ['process-quality-alerts', process],
    queryFn: async () => {
      // Query quality_checkpoints for process-specific quality issues
      const { data, error } = await supabase
        .from('quality_checkpoints')
        .select('*')
        .eq('stage', process) // Using process as stage filter
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      // Transform the data to match QualityAlert interface
      const transformedData: QualityAlert[] = data?.map(checkpoint => ({
        alert_id: checkpoint.id,
        process: process,
        severity: checkpoint.passed ? 'LOW' : 'HIGH' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        message: checkpoint.remarks || 'Quality checkpoint alert',
        created_at: checkpoint.created_at,
        status: checkpoint.passed ? 'RESOLVED' : 'ACTIVE' as 'ACTIVE' | 'RESOLVED'
      })) || [];
      
      return transformedData;
    },
    enabled: !!process,
  });
};

// Hook for multi-process readiness assessment
export function useMultiProcessReadiness(uiorn: string, processes: string[]) {
  const { useProcessReadiness } = useProcessIntelligence();
  
  const readinessQueries = processes.map(process => 
    useProcessReadiness(uiorn, process)
  );

  return {
    data: readinessQueries.map(query => query.data).filter(Boolean),
    isLoading: readinessQueries.some(query => query.isLoading),
    isError: readinessQueries.some(query => query.isError),
    error: readinessQueries.find(query => query.error)?.error,
  };
}
