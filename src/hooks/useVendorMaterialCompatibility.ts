
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useVendorMaterialCompatibility = (vendorId?: string) => {
  return useQuery({
    queryKey: ['vendor-material-compatibility', vendorId],
    queryFn: async () => {
      if (!vendorId) return null;

      // Get vendor's material categories
      const { data: vendor, error } = await supabase
        .from('suppliers')
        .select('material_categories, supplier_name')
        .eq('id', vendorId)
        .single();

      if (error) throw error;

      // Get items that match vendor's material categories
      const { data: compatibleItems, error: itemsError } = await supabase
        .from('satguru_item_master')
        .select(`
          item_code,
          item_name,
          uom,
          categories:category_id(category_name)
        `)
        .eq('status', 'active');

      if (itemsError) throw itemsError;

      // Filter items by vendor's material categories
      const filteredItems = compatibleItems?.filter(item => {
        const itemCategory = item.categories?.category_name;
        return vendor.material_categories.some((vendorCategory: string) => 
          itemCategory?.toLowerCase().includes(vendorCategory.toLowerCase()) ||
          vendorCategory.toLowerCase().includes(itemCategory?.toLowerCase() || '')
        );
      }) || [];

      return {
        vendor,
        compatibleItems: filteredItems,
        totalCompatibleItems: filteredItems.length
      };
    },
    enabled: !!vendorId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
