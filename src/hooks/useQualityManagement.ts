import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Interfaces for Quality Management System
export interface QualityTemplate {
  id: string;
  checkpoint_name: string;
  checkpoint_code: string;
  process_stage: 'GRAVURE_PRINTING' | 'ADHESIVE_COATING' | 'PRINTING' | 'LAMINATION' | 'SLITTING' | 'DISPATCH';
  measurement_type: 'VISUAL' | 'MEASUREMENT' | 'TEST' | 'VERIFICATION';
  specification_limits: any;
  test_method: string;
  frequency: 'CONTINUOUS' | 'BATCH' | 'HOURLY' | 'SHIFT';
  critical_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  is_mandatory: boolean;
  created_at: string;
  updated_at: string;
}

export interface QualityMetric {
  id: string;
  uiorn: string;
  quality_template_id: string;
  process_stage: string;
  measured_value?: number;
  text_value?: string;
  measurement_unit?: string;
  operator_id?: string;
  measurement_timestamp: string;
  specification_min?: number;
  specification_max?: number;
  specification_target?: number;
  within_specification?: boolean;
  deviation_percentage?: number;
  notes?: string;
  image_urls?: string[];
  status: 'MEASURED' | 'APPROVED' | 'REJECTED' | 'REWORK';
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  quality_templates?: QualityTemplate;
}

export interface QualityWorkflow {
  id: string;
  uiorn: string;
  process_stage: string;
  workflow_type: 'CHECKPOINT' | 'APPROVAL' | 'REWORK' | 'ESCALATION';
  current_step: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ESCALATED';
  assigned_to?: string;
  due_date?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  workflow_data: any;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface QualitySpecification {
  id: string;
  customer_code: string;
  item_code: string;
  specification_name: string;
  specification_type: 'DIMENSIONAL' | 'COLOR' | 'SURFACE' | 'PERFORMANCE';
  target_value?: number;
  min_value?: number;
  max_value?: number;
  measurement_unit?: string;
  test_method?: string;
  acceptance_criteria?: string;
  is_critical: boolean;
  is_active: boolean;
  version: number;
  effective_date: string;
  expiry_date?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface QualityDashboardSummary {
  uiorn: string;
  process_stage: string;
  total_measurements: number;
  passed_measurements: number;
  failed_measurements: number;
  compliance_percentage: number;
  last_measurement: string;
  avg_deviation: number;
}

export function useQualityManagement() {
  const queryClient = useQueryClient();

  // Fetch quality templates by process stage
  const useQualityTemplates = (processStage?: string) => {
    return useQuery<QualityTemplate[]>({
      queryKey: ['quality-templates', processStage],
      queryFn: async () => {
        let query = supabase
          .from('quality_templates')
          .select('*')
          .order('checkpoint_name');

        if (processStage) {
          query = query.eq('process_stage', processStage);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
      },
    });
  };

  // Fetch quality metrics for an order
  const useQualityMetrics = (uiorn: string, processStage?: string) => {
    return useQuery<QualityMetric[]>({
      queryKey: ['quality-metrics', uiorn, processStage],
      queryFn: async () => {
        let query = supabase
          .from('quality_metrics')
          .select(`
            *,
            quality_templates (
              checkpoint_name,
              checkpoint_code,
              measurement_type,
              test_method,
              critical_level
            )
          `)
          .eq('uiorn', uiorn)
          .order('measurement_timestamp', { ascending: false });

        if (processStage) {
          query = query.eq('process_stage', processStage);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
      },
      enabled: !!uiorn,
    });
  };

  // Fetch quality workflows for an order
  const useQualityWorkflows = (uiorn: string, processStage?: string) => {
    return useQuery<QualityWorkflow[]>({
      queryKey: ['quality-workflows', uiorn, processStage],
      queryFn: async () => {
        let query = supabase
          .from('quality_workflows')
          .select('*')
          .eq('uiorn', uiorn)
          .order('created_at', { ascending: false });

        if (processStage) {
          query = query.eq('process_stage', processStage);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
      },
      enabled: !!uiorn,
    });
  };

  // Fetch quality specifications for customer/item
  const useQualitySpecifications = (customerCode?: string, itemCode?: string) => {
    return useQuery<QualitySpecification[]>({
      queryKey: ['quality-specifications', customerCode, itemCode],
      queryFn: async () => {
        let query = supabase
          .from('quality_specifications')
          .select('*')
          .eq('is_active', true)
          .order('specification_name');

        if (customerCode) {
          query = query.eq('customer_code', customerCode);
        }
        if (itemCode) {
          query = query.eq('item_code', itemCode);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
      },
    });
  };

  // Fetch quality dashboard summary
  const useQualityDashboard = (uiorn: string) => {
    return useQuery<QualityDashboardSummary[]>({
      queryKey: ['quality-dashboard', uiorn],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('quality_dashboard_summary')
          .select('*')
          .eq('uiorn', uiorn);

        if (error) throw error;
        return data;
      },
      enabled: !!uiorn,
      refetchInterval: 30000, // Refresh every 30 seconds
    });
  };

  // Calculate quality score for an order
  const useQualityScore = (uiorn: string) => {
    return useQuery<number>({
      queryKey: ['quality-score', uiorn],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('calculate_quality_score', {
          p_uiorn: uiorn
        });

        if (error) throw error;
        return data;
      },
      enabled: !!uiorn,
      refetchInterval: 60000, // Refresh every minute
    });
  };

  // Record quality measurement
  const recordQualityMeasurement = useMutation({
    mutationFn: async (measurement: {
      uiorn: string;
      quality_template_id: string;
      process_stage: string;
      measured_value?: number;
      text_value?: string;
      measurement_unit?: string;
      specification_min?: number;
      specification_max?: number;
      specification_target?: number;
      notes?: string;
      image_urls?: string[];
    }) => {
      // Calculate if within specification
      let within_specification: boolean | null = null;
      let deviation_percentage: number | null = null;

      if (measurement.measured_value && measurement.specification_target) {
        const deviation = Math.abs(measurement.measured_value - measurement.specification_target);
        deviation_percentage = (deviation / measurement.specification_target) * 100;

        if (measurement.specification_min && measurement.specification_max) {
          within_specification = 
            measurement.measured_value >= measurement.specification_min &&
            measurement.measured_value <= measurement.specification_max;
        }
      }

      const { data, error } = await supabase
        .from('quality_metrics')
        .insert({
          ...measurement,
          within_specification,
          deviation_percentage,
          status: 'MEASURED',
          measurement_timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quality-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['quality-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['quality-score'] });
      queryClient.invalidateQueries({ queryKey: ['quality-workflows'] });
    },
  });

  // Approve quality measurement
  const approveQualityMeasurement = useMutation({
    mutationFn: async ({ id, status, notes }: {
      id: string;
      status: 'APPROVED' | 'REJECTED' | 'REWORK';
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('quality_metrics')
        .update({
          status,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['quality-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['quality-workflows'] });
    },
  });

  // Create quality workflow
  const createQualityWorkflow = useMutation({
    mutationFn: async (workflow: {
      uiorn: string;
      process_stage: string;
      workflow_type: 'CHECKPOINT' | 'APPROVAL' | 'REWORK' | 'ESCALATION';
      current_step: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      workflow_data: any;
      assigned_to?: string;
      due_date?: string;
    }) => {
      const { data, error } = await supabase
        .from('quality_workflows')
        .insert({
          ...workflow,
          status: 'PENDING',
          priority: workflow.priority || 'MEDIUM'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-workflows'] });
    },
  });

  // Update quality workflow
  const updateQualityWorkflow = useMutation({
    mutationFn: async ({ id, updates }: {
      id: string;
      updates: Partial<QualityWorkflow>;
    }) => {
      const { data, error } = await supabase
        .from('quality_workflows')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-workflows'] });
    },
  });

  return {
    // Query hooks
    useQualityTemplates,
    useQualityMetrics,
    useQualityWorkflows,
    useQualitySpecifications,
    useQualityDashboard,
    useQualityScore,
    
    // Mutation hooks
    recordQualityMeasurement,
    approveQualityMeasurement,
    createQualityWorkflow,
    updateQualityWorkflow,
  };
}