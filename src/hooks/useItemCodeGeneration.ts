import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ItemCodeParams {
  categoryName?: string;
  usageType?: 'RAW_MATERIAL' | 'FINISHED_GOOD' | 'PACKAGING' | 'CONSUMABLE';
  qualifier?: string;
  size?: string;
  gsm?: number;
}

export function useItemCodeGeneration() {
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [isValidating, setIsValidating] = useState(false);
  const [isUnique, setIsUnique] = useState<boolean | null>(null);

  const generateCode = useMutation({
    mutationFn: async (params: ItemCodeParams) => {
      if (!params.categoryName) return "";
      
      const { data, error } = await supabase.rpc('satguru_generate_enhanced_item_code', {
        category_name: params.categoryName,
        usage_type: params.usageType || 'FINISHED_GOOD',
        qualifier: params.qualifier || '',
        size_mm: params.size || '',
        gsm: params.gsm || null
      });
      
      if (error) throw error;
      return data as string;
    },
    onSuccess: (code) => {
      setGeneratedCode(code);
      if (code) {
        validateCode.mutate(code);
      }
    }
  });

  const validateCode = useMutation({
    mutationFn: async (code: string) => {
      setIsValidating(true);
      const { data, error } = await supabase.rpc('satguru_validate_unique_item_code', {
        p_item_code: code,
        p_exclude_id: null
      });
      
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: (isValid) => {
      setIsUnique(isValid);
      setIsValidating(false);
    },
    onError: () => {
      setIsValidating(false);
    }
  });

  const updateCode = (params: ItemCodeParams) => {
    generateCode.mutate(params);
  };

  const validateManualCode = (code: string) => {
    setGeneratedCode(code);
    validateCode.mutate(code);
  };

  return {
    generatedCode,
    isValidating,
    isUnique,
    updateCode,
    validateManualCode,
    isGenerating: generateCode.isPending
  };
}