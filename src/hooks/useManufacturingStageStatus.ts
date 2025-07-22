
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MANUFACTURING_CONFIG } from '@/config/manufacturing';

export interface ManufacturingStageStatus {
  id: string;
  uiorn: string;
  stage: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  operator_id?: string;
  machine_id?: string;
  process_parameters?: Record<string, any>;
  quality_metrics?: Record<string, any>;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const useManufacturingStageStatus = (uiorn?: string) => {
  const [stageStatuses, setStageStatuses] = useState<ManufacturingStageStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchStageStatuses = async () => {
    try {
      setLoading(true);
      
      // Use existing process_logs_se table for stage status tracking
      let query = supabase
        .from('process_logs_se')
        .select('*')
        .order('captured_at', { ascending: false });

      if (uiorn) {
        query = query.eq('uiorn', uiorn);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Transform process_logs_se data to ManufacturingStageStatus format
      const transformedData: ManufacturingStageStatus[] = (data || []).map(log => ({
        id: log.id,
        uiorn: log.uiorn,
        stage: log.stage || 'UNKNOWN',
        status: log.txt_value || 'PENDING',
        started_at: log.captured_at,
        completed_at: undefined,
        operator_id: log.captured_by,
        machine_id: undefined,
        process_parameters: {},
        quality_metrics: {},
        notes: log.metric,
        created_at: log.captured_at,
        updated_at: log.captured_at
      }));

      setStageStatuses(transformedData);
    } catch (error) {
      console.error('Error fetching stage statuses:', error);
      toast({
        title: "Error",
        description: "Failed to fetch stage statuses",
        variant: "destructive",
      });
      // Set empty array on error
      setStageStatuses([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStageStatus = async (params: {
    uiorn: string;
    stage: string;
    status: string;
    operator_id?: string;
    machine_id?: string;
    process_parameters?: Record<string, any>;
    quality_metrics?: Record<string, any>;
    notes?: string;
  }) => {
    try {
      // Insert into process_logs_se table instead of using RPC
      const { data, error } = await supabase
        .from('process_logs_se')
        .insert({
          uiorn: params.uiorn,
          stage: params.stage as any,
          metric: params.notes || 'Stage Status Update',
          txt_value: params.status,
          captured_by: params.operator_id || undefined,
          captured_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `Stage ${MANUFACTURING_CONFIG.STAGE_LABELS[params.stage] || params.stage} updated to ${MANUFACTURING_CONFIG.STATUS_LABELS[params.status] || params.status}`,
      });

      fetchStageStatuses();
      return data;
    } catch (error) {
      console.error('Error updating stage status:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update stage status",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchStageStatuses();
  }, [uiorn]);

  // Set up real-time subscription using process_logs_se table
  useEffect(() => {
    const channel = supabase
      .channel('process_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'process_logs_se',
          filter: uiorn ? `uiorn=eq.${uiorn}` : undefined
        },
        () => {
          fetchStageStatuses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [uiorn]);

  return {
    stageStatuses,
    loading,
    updateStageStatus,
    refetch: fetchStageStatuses
  };
};
