
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DataValidationIssue {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  table: string;
  field: string;
  affectedRecords: number;
  canAutoFix: boolean;
}

export interface ValidationSummary {
  criticalIssues: number;
  warnings: number;
  passedChecks: number;
  lastRun: string | null;
}

export const useDataValidation = () => {
  const queryClient = useQueryClient();

  const validationResults = useQuery({
    queryKey: ["data-validation-results"],
    queryFn: async (): Promise<DataValidationIssue[]> => {
      // Mock validation data for now
      return [
        {
          id: "1",
          type: "error",
          severity: "critical",
          title: "Missing Item Codes",
          description: "Items without proper item codes",
          table: "satguru_item_master",
          field: "item_code",
          affectedRecords: 5,
          canAutoFix: false
        },
        {
          id: "2",
          type: "warning",
          severity: "medium",
          title: "Inconsistent UOM",
          description: "Items with inconsistent unit of measure",
          table: "satguru_item_master",
          field: "uom",
          affectedRecords: 12,
          canAutoFix: true
        }
      ];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const validationSummary = useQuery({
    queryKey: ["validation-summary"],
    queryFn: async (): Promise<ValidationSummary> => {
      return {
        criticalIssues: 5,
        warnings: 12,
        passedChecks: 23,
        lastRun: new Date().toISOString()
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const runValidation = useMutation({
    mutationFn: async () => {
      // Mock validation run
      console.log("Running data validation...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-validation-results"] });
      queryClient.invalidateQueries({ queryKey: ["validation-summary"] });
    },
  });

  return {
    validationResults,
    validationSummary,
    isValidating: runValidation.isPending,
    runValidation: runValidation.mutate,
  };
};
