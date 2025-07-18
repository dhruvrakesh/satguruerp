import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ManufacturingOrder, OrderProgress, WorkflowBottleneck } from "@/types/manufacturing";

export const useManufacturingOrders = (filters?: {
  status?: string;
  priority?: string;
  customer_id?: string;
  search?: string;
}) => {
  return useQuery({
    queryKey: ["manufacturing-orders", filters],
    queryFn: async () => {
      let query = supabase
        .from("order_punching")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status as any);
      }
      
      if (filters?.priority) {
        query = query.eq("priority_level", filters.priority);
      }

      if (filters?.search) {
        query = query.or(`uiorn.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

export const useOrderProgress = () => {
  return useQuery({
    queryKey: ["order-progress"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_order_progress');
      if (error) throw error;
      return data as OrderProgress[];
    },
  });
};

export const useWorkflowBottlenecks = () => {
  return useQuery({
    queryKey: ["workflow-bottlenecks"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_workflow_bottlenecks');
      if (error) throw error;
      return data as WorkflowBottleneck[];
    },
  });
};


export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderData: {
      customer_name: string;
      product_description: string;
      order_quantity: number;
      priority_level?: string;
      delivery_date?: string;
      special_instructions?: string;
      order_date: string;
      status?: string;
    }) => {
      const { data, error } = await supabase
        .from("order_punching")
        .insert([{
          ...orderData,
          uiorn: `ORDER-${Date.now()}`, // Temporary UIORN generation
          status: (orderData.status as any) || "PENDING"
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manufacturing-orders"] });
    },
  });
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      uiorn, 
      status
    }: { 
      uiorn: string; 
      status: string;
    }) => {
      const { error } = await supabase
        .from("order_punching")
        .update({ status: status as any })
        .eq("uiorn", uiorn);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manufacturing-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-progress"] });
    },
  });
};

export const useManufacturingDashboard = () => {
  return useQuery({
    queryKey: ["manufacturing-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_punching")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
  });
};