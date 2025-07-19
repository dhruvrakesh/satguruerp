
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useCylinderTracking = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateCylinderUsage = useMutation({
    mutationFn: async ({ 
      cylinderCode, 
      mileageIncrement, 
      lastRun 
    }: { 
      cylinderCode: string; 
      mileageIncrement: number; 
      lastRun?: string; 
    }) => {
      const { error } = await supabase.rpc('update_cylinder_usage', {
        p_cylinder_code: cylinderCode,
        p_mileage_increment: mileageIncrement,
        p_last_run: lastRun
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cylinders-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cylinders-for-item"] });
      toast({
        title: "Cylinder usage updated",
        description: "Mileage and usage data have been recorded"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update cylinder usage",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    }
  });

  const updateCylinderStatus = useMutation({
    mutationFn: async ({ 
      cylinderCode, 
      status 
    }: { 
      cylinderCode: string; 
      status: string; 
    }) => {
      const { error } = await supabase
        .from('satguru_cylinders')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('cylinder_code', cylinderCode);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cylinders-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cylinders-for-item"] });
    }
  });

  const getCylinderUsageHistory = (cylinderCode: string) => {
    return useQuery({
      queryKey: ["cylinder-usage-history", cylinderCode],
      queryFn: async () => {
        // This would typically come from a usage history table
        // For now, we'll return the cylinder's current data
        const { data, error } = await supabase
          .from('satguru_cylinders')
          .select('*')
          .eq('cylinder_code', cylinderCode)
          .single();
        
        if (error) throw error;
        return data;
      },
      enabled: !!cylinderCode,
    });
  };

  return {
    updateCylinderUsage,
    updateCylinderStatus,
    getCylinderUsageHistory
  };
};
