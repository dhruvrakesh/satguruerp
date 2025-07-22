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
      let query = supabase
        .from('manufacturing_stage_status')
        .select('*')
        .order('created_at', { ascending: false });

      if (uiorn) {
        query = query.eq('uiorn', uiorn);
      }

      const { data, error } = await query;

      if (error) throw error;
      setStageStatuses(data || []);
    } catch (error) {
      console.error('Error fetching stage statuses:', error);
      toast({
        title: "Error",
        description: "Failed to fetch stage statuses",
        variant: "destructive",
      });
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
      const { data, error } = await supabase.rpc('handle_manufacturing_stage_transition', {
        p_uiorn: params.uiorn,
        p_stage: params.stage,
        p_status: params.status,
        p_operator_id: params.operator_id,
        p_machine_id: params.machine_id,
        p_process_parameters: params.process_parameters || {},
        p_quality_metrics: params.quality_metrics || {},
        p_notes: params.notes
      });

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: `Stage ${MANUFACTURING_CONFIG.STAGE_LABELS[params.stage]} updated to ${MANUFACTURING_CONFIG.STATUS_LABELS[params.status]}`,
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

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('manufacturing_stage_status_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'manufacturing_stage_status',
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