import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useVendorMutations = () => {
  const queryClient = useQueryClient();

  const updateVendor = useMutation({
    mutationFn: async ({ vendorId, data }: { vendorId: string; data: any }) => {
      const { data: result, error } = await supabase
        .from('suppliers')
        .update({
          supplier_name: data.supplier_name,
          supplier_type: data.supplier_type,
          category: data.category,
          contact_person: data.contact_person,
          email: data.email,
          phone: data.phone,
          address: typeof data.address === 'string' ? data.address : JSON.stringify({
            street: data.address || '',
            city: data.city || '',
            state: data.state || '',
            postal_code: data.pincode || '',
            country: 'India'
          }),
          tax_details: {
            gst_number: data.gstin || '',
            pan_number: data.pan || '',
            registration_type: 'Regular'
          },
          payment_terms: data.payment_terms,
          credit_limit: data.credit_limit,
          lead_time_days: data.lead_time_days,
          material_categories: data.material_categories,
          certifications: data.certifications,
          performance_rating: data.performance_rating,
          notes: data.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendorId)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success("Vendor updated successfully");
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error: any) => {
      toast.error("Failed to update vendor: " + error.message);
    },
  });

  const toggleVendorStatus = useMutation({
    mutationFn: async ({ vendorId, isActive }: { vendorId: string; isActive: boolean }) => {
      const { data: result, error } = await supabase
        .from('suppliers')
        .update({ 
          is_active: !isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendorId)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      toast.success(`Vendor ${data.is_active ? 'activated' : 'deactivated'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error: any) => {
      toast.error("Failed to update vendor status: " + error.message);
    },
  });

  return {
    updateVendor,
    toggleVendorStatus,
  };
};