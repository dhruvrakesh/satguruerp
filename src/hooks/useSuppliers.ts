import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Supplier {
  id: string;
  supplier_code: string;
  supplier_name: string;
  supplier_type: string;
  category: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  material_categories: string[];
  lead_time_days: number;
  is_active: boolean;
  performance_rating: number;
  address?: any;
  gst_number?: string;
  pan_number?: string;
}

export const useSuppliers = () => {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('supplier_name');

      if (error) throw error;
      return data as Supplier[];
    },
  });
};