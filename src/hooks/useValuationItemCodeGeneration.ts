import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ValuationItemCodeParams {
  categoryName?: string;
  usageType?: string;
  qualifier?: string;
  size?: number;
  gsm?: number;
}

export const useValuationItemCodeGeneration = () => {
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [isValidating, setIsValidating] = useState(false);
  const [isUnique, setIsUnique] = useState<boolean | null>(null);

  const generateCodeMutation = useMutation({
    mutationFn: async (params: ValuationItemCodeParams) => {
      if (!params.categoryName) {
        throw new Error("Category name is required");
      }

      const { data, error } = await supabase.rpc('generate_valuation_item_code', {
        p_category_name: params.categoryName,
        p_usage_type: params.usageType || 'RAW_MATERIAL',
        p_qualifier: params.qualifier || null,
        p_size_mm: params.size || null,
        p_gsm: params.gsm || null
      });

      if (error) {
        console.error('Item code generation error:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (code) => {
      setGeneratedCode(code);
      setIsUnique(true);
      console.log('Generated item code:', code);
    },
    onError: (error) => {
      console.error('Failed to generate item code:', error);
      toast({
        title: "Code Generation Failed",
        description: error.message || "Failed to generate unique item code",
        variant: "destructive",
      });
      setIsUnique(false);
    },
  });

  const validateCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      setIsValidating(true);
      
      // Check uniqueness in both tables
      const [valuationCheck, masterCheck] = await Promise.all([
        supabase
          .from('valuation_item_codes')
          .select('item_code')
          .eq('item_code', code)
          .single(),
        supabase
          .from('satguru_item_master')
          .select('item_code')
          .eq('item_code', code)
          .single()
      ]);

      const isUnique = !valuationCheck.data && !masterCheck.data;
      return isUnique;
    },
    onSuccess: (unique) => {
      setIsUnique(unique);
      setIsValidating(false);
    },
    onError: () => {
      setIsUnique(false);
      setIsValidating(false);
    },
  });

  const generateCode = (params: ValuationItemCodeParams) => {
    if (!params.categoryName?.trim()) {
      toast({
        title: "Invalid Parameters",
        description: "Category name is required for code generation",
        variant: "destructive",
      });
      return;
    }

    // Reset state
    setIsUnique(null);
    setGeneratedCode("");
    
    // Debounce to prevent rapid successive calls
    const timeoutId = setTimeout(() => {
      generateCodeMutation.mutate(params);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  const validateManualCode = (code: string) => {
    if (!code?.trim()) {
      setIsUnique(null);
      return;
    }
    
    setGeneratedCode(code);
    validateCodeMutation.mutate(code);
  };

  return {
    generatedCode,
    isValidating,
    isUnique,
    isGenerating: generateCodeMutation.isPending,
    generateCode,
    validateManualCode,
  };
};