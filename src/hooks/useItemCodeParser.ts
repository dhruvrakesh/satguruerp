import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ParsedItemCode {
  code: string;
  type: 'FINISHED_GOOD' | 'RAW_MATERIAL' | 'WIP' | 'PACKAGING' | 'CONSUMABLE';
  category?: string;
  material?: string;
  variant?: string;
  grade?: string;
  isValid: boolean;
  suggestedName?: string;
}

export function useItemCodeParser() {
  const parseItemCode = useMutation({
    mutationFn: async (itemCode: string): Promise<ParsedItemCode> => {
      const code = itemCode.trim().toUpperCase();
      
      // Finished Goods patterns
      if (code.match(/^\d{8}$/)) {
        return {
          code,
          type: 'FINISHED_GOOD',
          isValid: true,
          suggestedName: `Finished Product ${code}`
        };
      }
      
      if (code.startsWith('ITM')) {
        return {
          code,
          type: 'FINISHED_GOOD',
          isValid: true,
          suggestedName: `Item ${code.substring(3)}`
        };
      }
      
      // Raw Material patterns
      if (code.includes('_')) {
        const parts = code.split('_');
        const material = parts[0];
        const variant = parts[1] || '';
        const grade = parts[2] || '';
        
        let category = 'RAW_MATERIALS';
        let suggestedName = code;
        
        // Auto-categorize based on material prefix
        if (material.startsWith('ADH')) {
          category = 'ADHESIVES';
          suggestedName = `Adhesive ${variant} ${grade}`.trim();
        } else if (material.includes('BOPP') || material.includes('PET')) {
          category = 'FILMS';
          suggestedName = `${material} Film ${variant}`.trim();
        } else if (material.includes('INK')) {
          category = 'INKS';
          suggestedName = `Ink ${variant} ${grade}`.trim();
        }
        
        return {
          code,
          type: 'RAW_MATERIAL',
          category,
          material,
          variant,
          grade,
          isValid: true,
          suggestedName
        };
      }
      
      // Legacy or complex formats
      if (code.match(/^[A-Z0-9]{6,15}$/)) {
        return {
          code,
          type: 'RAW_MATERIAL',
          isValid: true,
          suggestedName: `Material ${code}`
        };
      }
      
      // WIP or other formats
      return {
        code,
        type: 'WIP',
        isValid: code.length >= 4,
        suggestedName: `Work Item ${code}`
      };
    }
  });

  const validateItemCode = useMutation({
    mutationFn: async ({ itemCode, usageType }: { itemCode: string; usageType: string }) => {
      const { data, error } = await supabase.rpc('satguru_validate_item_code_format', {
        p_item_code: itemCode,
        p_usage_type: usageType
      });
      
      if (error) throw error;
      return data as boolean;
    }
  });

  return {
    parseItemCode,
    validateItemCode,
    isParsingCode: parseItemCode.isPending,
    isValidatingCode: validateItemCode.isPending
  };
}