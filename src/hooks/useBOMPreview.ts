import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BOMItem {
  rm_item_code: string;
  item_name?: string;
  quantity_required: number;
  unit_of_measure: string;
  consumption_rate: number;
  wastage_percentage: number;
  percentage_contribution: number;
  gsm_contribution: number;
}

export interface BOMExplosion {
  fg_item_code: string;
  fg_item_name?: string;
  materials: BOMItem[];
  total_materials: number;
  has_bom: boolean;
  total_cost?: number;
}

export const useBOMPreview = (fgItemCodes: string[]) => {
  return useQuery({
    queryKey: ['bom-preview', fgItemCodes],
    queryFn: async (): Promise<BOMExplosion[]> => {
      if (fgItemCodes.length === 0) return [];

      // Get BOM data for FG items
      const { data: bomData, error: bomError } = await supabase
        .from('bill_of_materials')
        .select(`
          fg_item_code,
          rm_item_code,
          quantity_required,
          unit_of_measure,
          consumption_rate,
          wastage_percentage,
          percentage_contribution,
          gsm_contribution
        `)
        .in('fg_item_code', fgItemCodes)
        .eq('is_active', true);

      if (bomError) throw bomError;

      // Get FG item names from artwork master
      const { data: fgItemNames, error: fgError } = await supabase
        .from('master_data_artworks_se')
        .select('item_code, item_name')
        .in('item_code', fgItemCodes);

      if (fgError) throw fgError;

      // Get RM item names from item master
      const rmItemCodes = bomData?.map(bom => bom.rm_item_code) || [];
      const { data: rmItemNames, error: rmError } = await supabase
        .from('satguru_item_master')
        .select('item_code, item_name')
        .in('item_code', rmItemCodes);

      if (rmError) throw rmError;

      // Combine both name maps
      const itemNameMap = new Map<string, string>();
      
      // Add FG item names
      fgItemNames?.forEach(item => {
        if (item.item_code && item.item_name) {
          itemNameMap.set(item.item_code, item.item_name);
        }
      });
      
      // Add RM item names
      rmItemNames?.forEach(item => {
        if (item.item_code && item.item_name) {
          itemNameMap.set(item.item_code, item.item_name);
        }
      });

      // Group BOM data by FG item
      const bomMap = new Map<string, BOMItem[]>();
      bomData?.forEach(bom => {
        if (!bomMap.has(bom.fg_item_code)) {
          bomMap.set(bom.fg_item_code, []);
        }
        bomMap.get(bom.fg_item_code)!.push({
          rm_item_code: bom.rm_item_code,
          item_name: itemNameMap.get(bom.rm_item_code),
          quantity_required: bom.quantity_required,
          unit_of_measure: bom.unit_of_measure,
          consumption_rate: bom.consumption_rate,
          wastage_percentage: bom.wastage_percentage,
          percentage_contribution: bom.percentage_contribution,
          gsm_contribution: bom.gsm_contribution
        });
      });

      // Create explosion data for each FG item
      return fgItemCodes.map(fgCode => ({
        fg_item_code: fgCode,
        fg_item_name: itemNameMap.get(fgCode) || `Artwork - ${fgCode}`,
        materials: bomMap.get(fgCode) || [],
        total_materials: bomMap.get(fgCode)?.length || 0,
        has_bom: bomMap.has(fgCode)
      }));
    },
    enabled: fgItemCodes.length > 0,
    staleTime: 30000
  });
};

export const useBOMExplosionCalculator = (fgItemCode: string, quantity: number) => {
  return useQuery({
    queryKey: ['bom-explosion', fgItemCode, quantity],
    queryFn: async () => {
      if (!fgItemCode || quantity <= 0) return null;

      // Calculate manually
      const { data: bomData, error: bomError } = await supabase
        .from('bill_of_materials')
        .select('*')
        .eq('fg_item_code', fgItemCode)
        .eq('is_active', true);

      if (bomError) throw bomError;

      return bomData?.map(bom => ({
        rm_item_code: bom.rm_item_code,
        required_quantity: (bom.quantity_required * bom.consumption_rate * quantity) * (1 + bom.wastage_percentage / 100),
        unit_of_measure: bom.unit_of_measure
      })) || [];
    },
    enabled: !!fgItemCode && quantity > 0
  });
};