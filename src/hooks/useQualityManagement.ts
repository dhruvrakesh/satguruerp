import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QualityTemplate, QualityMetric, QualityWorkflow, QualitySpecification, QualityDashboardSummary } from "@/types/manufacturing";

export function useQualityManagement() {
  const queryClient = useQueryClient();

  // Fetch quality templates by process stage
  const useQualityTemplates = (processStage?: string) => {
    return useQuery({
      queryKey: ['quality-templates', processStage],
      queryFn: async () => {
        let query = supabase
          .from('quality_templates')
          .select('*')
          .order('checkpoint_name');

        if (processStage) {
          query = query.eq('process_stage', processStage as any);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        // Transform database result to match our interface
        return (data || []).map(item => ({
          ...item,
          measurement_type: item.measurement_type || 'MEASUREMENT',
          created_at: item.created_at || '',
          updated_at: item.updated_at || '',
          critical_level: item.critical_level || '',
          frequency: item.frequency || '',
          is_mandatory: item.is_mandatory || false
        })) as QualityTemplate[];
      },
    });
  };

  // Fetch quality metrics for an order
  const useQualityMetrics = (uiorn: string, processStage?: string) => {
    return useQuery({
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
          query = query.eq('process_stage', processStage as any);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        // Transform and type the data
        return (data || []).map(item => ({
          ...item,
          status: item.status || 'PENDING',
          measured_at: item.measurement_timestamp || item.created_at || '',
          deviation: item.deviation_percentage || 0,
          within_specification: item.within_specification || false,
          checkpoint_id: item.quality_template_id || '',
          notes: item.notes || '',
          approved_by: item.approved_by || undefined,
          approved_at: item.approved_at || undefined,
          measured_by: item.operator_id || undefined
        })) as QualityMetric[];
      },
      enabled: !!uiorn,
    });
  };

  // Fetch quality workflows for an order
  const useQualityWorkflows = (uiorn: string, processStage?: string) => {
    return useQuery({
      queryKey: ['quality-workflows', uiorn, processStage],
      queryFn: async () => {
        let query = supabase
          .from('quality_workflows')
          .select('*')
          .eq('uiorn', uiorn)
          .order('created_at', { ascending: false });

        if (processStage) {
          query = query.eq('process_stage', processStage as any);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        // Transform to match interface
        return (data || []).map(item => ({
          ...item,
          workflow_name: item.current_step || 'Quality Workflow',
          status: item.status === 'PENDING' ? 'ACTIVE' : 
                 item.status === 'COMPLETED' ? 'COMPLETED' : 'SUSPENDED',
          start_date: item.started_at || item.created_at || '',
          target_completion_date: item.due_date || undefined,
          actual_completion_date: item.completed_at || undefined,
          assigned_to: item.assigned_to || undefined,
          created_by: undefined,
        })) as QualityWorkflow[];
      },
      enabled: !!uiorn,
    });
  };

  // Fetch quality specifications for customer/item
  const useQualitySpecifications = (customerCode?: string, itemCode?: string) => {
    return useQuery({
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
        
        // Transform to match interface
        return (data || []).map(item => ({
          ...item,
          specification_type: item.specification_type || 'DIMENSIONAL',
          test_method: item.test_method || '',
          frequency: 'daily',
          customer_code: item.customer_code || undefined,
          item_code: item.item_code || undefined,
          target_value: item.target_value || undefined,
          tolerance_upper: item.max_value || undefined,
          tolerance_lower: item.min_value || undefined,
          unit_of_measure: item.measurement_unit || undefined,
        })) as QualitySpecification[];
      },
    });
  };

  // Fetch quality dashboard summary
  const useQualityDashboard = (uiorn: string) => {
    return useQuery({
      queryKey: ['quality-dashboard', uiorn],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('quality_dashboard_summary')
          .select('*')
          .eq('uiorn', uiorn);

        if (error) throw error;
        
        // Calculate summary from individual measurements
        const summary: QualityDashboardSummary = {
          total_checkpoints: data?.length || 0,
          completed_checkpoints: data?.filter(d => d.passed_measurements > 0).length || 0,
          pending_checkpoints: data?.filter(d => d.total_measurements === 0).length || 0,
          failed_checkpoints: data?.filter(d => d.failed_measurements > 0).length || 0,
          overall_score: data?.reduce((acc, item) => acc + item.compliance_percentage, 0) / Math.max(data?.length || 1, 1) || 0,
          color_accuracy: data?.find(d => d.process_stage === 'PRINTING')?.compliance_percentage || 0,
          dimensional_accuracy: data?.find(d => d.process_stage === 'LAMINATION')?.compliance_percentage || 0,
          process_compliance: data?.reduce((acc, item) => acc + item.compliance_percentage, 0) / Math.max(data?.length || 1, 1) || 0
        };
        
        return summary;
      },
      enabled: !!uiorn,
      refetchInterval: 30000, // Refresh every 30 seconds
    });
  };

  // Calculate quality score for an order
  const useQualityScore = (uiorn: string) => {
    return useQuery({
      queryKey: ['quality-score', uiorn],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('calculate_quality_score', {
          p_uiorn: uiorn
        });

        if (error) throw error;
        return data || 0;
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
          uiorn: measurement.uiorn,
          quality_template_id: measurement.quality_template_id,
          process_stage: measurement.process_stage as any,
          measured_value: measurement.measured_value,
          text_value: measurement.text_value,
          measurement_unit: measurement.measurement_unit,
          notes: measurement.notes,
          image_urls: measurement.image_urls,
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
          uiorn: workflow.uiorn,
          process_stage: workflow.process_stage as any,
          workflow_type: workflow.workflow_type,
          current_step: workflow.current_step,
          workflow_data: workflow.workflow_data,
          assigned_to: workflow.assigned_to,
          due_date: workflow.due_date,
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
          current_step: updates.workflow_name,
          assigned_to: updates.assigned_to,
          due_date: updates.target_completion_date,
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