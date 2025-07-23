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
      console.log('Generating item code with params:', params);
      
      if (!params.categoryName) {
        throw new Error('Category name is required for item code generation');
      }
      
      try {
        const { data, error } = await supabase.rpc('satguru_generate_enhanced_item_code', {
          category_name: params.categoryName,
          usage_type: params.usageType || 'RAW_MATERIAL',
          qualifier: params.qualifier || '',
          size_mm: params.size || '',
          gsm: params.gsm || null
        });
        
        if (error) {
          console.error('Database error in item code generation:', error);
          throw new Error(`Failed to generate item code: ${error.message}`);
        }
        
        if (!data || data.startsWith('ERROR_')) {
          throw new Error('Item code generation returned an error. Please check the parameters and try again.');
        }
        
        console.log('Generated item code:', data);
        return data as string;
      } catch (err) {
        console.error('Error in generateCode:', err);
        throw err;
      }
    },
    onSuccess: (code) => {
      setGeneratedCode(code);
      if (code && !code.startsWith('ERROR_')) {
        validateCode.mutate(code);
      }
    },
    onError: (error) => {
      console.error('Item code generation failed:', error);
      setGeneratedCode('');
      setIsUnique(null);
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