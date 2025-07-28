import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useVendorMutations = () => {
  const queryClient = useQueryClient();

  const updateVendor = useMutation({
    mutationFn: async ({ vendorId, data }: { vendorId: string; data: any }) => {
      // Properly format address as JSONB
      const addressData = typeof data.address === 'string' ? {
        street: data.address,
        city: data.city || '',
        state: data.state || '',
        postal_code: data.pincode || '',
        country: 'India'
      } : {
        street: data.address?.street || '',
        city: data.address?.city || data.city || '',
        state: data.address?.state || data.state || '',
        postal_code: data.address?.postal_code || data.pincode || '',
        country: data.address?.country || 'India'
      };

      // Ensure material_categories is an array
      const materialCategories = Array.isArray(data.material_categories) 
        ? data.material_categories 
        : [];

      const updateData = {
        supplier_name: data.supplier_name,
        supplier_type: data.supplier_type,
        category: data.category,
        contact_person: data.contact_person,
        email: data.email,
        phone: data.phone,
        address: addressData,
        tax_details: {
          gst_number: data.gstin || data.gst_number || '',
          pan_number: data.pan || data.pan_number || '',
          registration_type: 'Regular'
        },
        payment_terms: data.payment_terms,
        credit_limit: data.credit_limit ? Number(data.credit_limit) : null,
        lead_time_days: data.lead_time_days ? Number(data.lead_time_days) : null,
        material_categories: materialCategories,
        performance_rating: data.performance_rating ? Number(data.performance_rating) : null,
        updated_at: new Date().toISOString(),
      };

      const { data: result, error } = await supabase
        .from('suppliers')
        .update(updateData)
        .eq('id', vendorId)
        .select()
        .single();

      if (error) {
        console.error('Update error:', error);
        throw error;
      }
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