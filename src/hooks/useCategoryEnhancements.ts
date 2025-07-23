import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CategoryUsageTracking {
  id: string;
  category_id: string;
  usage_type: 'VIEW' | 'ITEM_ADDED' | 'ITEM_REMOVED' | 'UPDATED' | 'SEARCHED';
  user_id: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface CategoryRecommendation {
  id: string;
  suggested_category_name: string;
  suggested_category_code?: string;
  confidence_score: number;
  reasoning: string;
  based_on_items: string[];
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  created_by?: string;
  processed_by?: string;
  created_at: string;
  processed_at?: string;
}

export interface CategoryPerformanceMetrics {
  category_id: string;
  category_name: string;
  view_count: number;
  item_additions: number;
  search_frequency: number;
  last_activity?: string;
  utilization_score: number;
}

export function useCategoryUsageTracking() {
  const { toast } = useToast();

  const trackUsage = useCallback(async (
    categoryId: string,
    usageType: CategoryUsageTracking['usage_type'],
    metadata: Record<string, any> = {}
  ) => {
    try {
      const { error } = await supabase.rpc('track_category_usage', {
        p_category_id: categoryId,
        p_usage_type: usageType,
        p_metadata: metadata
      });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to track category usage:', error);
    }
  }, []);

  return { trackUsage };
}

export function useCategoryPerformanceMetrics() {
  const [days, setDays] = useState(30);
  
  const fetchMetrics = useCallback(async (daysFilter?: number) => {
    const { data, error } = await supabase.rpc('get_category_performance_metrics', {
      p_days: daysFilter || days
    });
    
    if (error) throw error;
    return data as CategoryPerformanceMetrics[];
  }, [days]);

  return { fetchMetrics, days, setDays };
}

export function useCategoryRecommendations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const generateRecommendations = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('generate_category_recommendations');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-recommendations'] });
      toast({
        title: "Recommendations Generated",
        description: "New category recommendations have been generated based on current items.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to generate recommendations: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const fetchRecommendations = useCallback(async () => {
    const { data, error } = await supabase
      .from('category_recommendations')
      .select('*')
      .eq('status', 'PENDING')
      .order('confidence_score', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as CategoryRecommendation[];
  }, []);

  const processRecommendation = useMutation({
    mutationFn: async ({ id, status, notes }: { 
      id: string; 
      status: 'ACCEPTED' | 'REJECTED'; 
      notes?: string; 
    }) => {
      const { error } = await supabase
        .from('category_recommendations')
        .update({ 
          status, 
          processed_at: new Date().toISOString(),
          processed_by: (await supabase.auth.getUser()).data.user?.id 
        })
        .eq('id', id);
      
      if (error) throw error;

      // If accepted, optionally create the category
      if (status === 'ACCEPTED') {
        const recommendation = await supabase
          .from('category_recommendations')
          .select('*')
          .eq('id', id)
          .single();
        
        if (recommendation.data) {
          // Create category logic here if needed
          // This could trigger a separate mutation or be handled in the UI
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-recommendations'] });
      toast({
        title: "Recommendation Processed",
        description: "The category recommendation has been processed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to process recommendation: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  return {
    generateRecommendations,
    fetchRecommendations,
    processRecommendation,
    isGenerating: generateRecommendations.isPending
  };
}

export function useCategoryLifecycle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const manageLifecycle = useMutation({
    mutationFn: async ({ 
      categoryId, 
      action, 
      justification 
    }: { 
      categoryId: string; 
      action: 'ARCHIVE' | 'RESTORE' | 'DEPRECATE'; 
      justification?: string; 
    }) => {
      const { data, error } = await supabase.rpc('manage_category_lifecycle', {
        p_category_id: categoryId,
        p_action: action,
        p_justification: justification
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-categories'] });
      queryClient.invalidateQueries({ queryKey: ['category-stats'] });
      
      const parsedResult = result as { success: boolean; action?: string; error?: string };
      
      if (parsedResult.success) {
        toast({
          title: "Category Updated",
          description: `Category has been ${parsedResult.action} successfully.`,
        });
      } else {
        toast({
          title: "Action Failed",
          description: parsedResult.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to manage category lifecycle: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  return {
    manageLifecycle,
    isManaging: manageLifecycle.isPending
  };
}