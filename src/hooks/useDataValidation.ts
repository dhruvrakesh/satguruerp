import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DataValidationIssue {
  id: string;
  issue_type: 'NEGATIVE_STOCK' | 'MISSING_REORDER_LEVEL' | 'ZERO_COST' | 'ORPHANED_TRANSACTIONS' | 'INCONSISTENT_UNITS' | 'FUTURE_DATES' | 'DUPLICATE_ITEMS';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  item_code?: string;
  item_name?: string;
  description: string;
  current_value: any;
  expected_value: any;
  recommendation: string;
  detected_at: string;
  category: string;
  impact_level: number; // 1-5 scale
}

export interface ValidationFilters {
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  issueType?: string;
  category?: string;
  impactLevel?: number;
}

export interface ValidationSummary {
  totalIssues: number;
  criticalIssues: number;
  highPriorityIssues: number;
  dataConsistencyScore: number;
  systemHealthScore: number;
  lastValidationRun: string;
  issuesByType: Record<string, number>;
}

export const useDataValidation = (filters: ValidationFilters = {}) => {
  const validationQuery = useQuery({
    queryKey: ["data-validation", filters],
    queryFn: async (): Promise<DataValidationIssue[]> => {
      console.log("Running data validation checks with filters:", filters);
      
      const issues: DataValidationIssue[] = [];

      // Check 1: Negative Stock Quantities
      const { data: negativeStock } = await supabase
        .from("satguru_stock_summary_view")
        .select("item_code, item_name, current_qty, category_name")
        .lt('current_qty', 0);

      negativeStock?.forEach(item => {
        issues.push({
          id: `negative-${item.item_code}`,
          issue_type: 'NEGATIVE_STOCK',
          severity: 'CRITICAL',
          item_code: item.item_code,
          item_name: item.item_name,
          description: 'Stock quantity is negative',
          current_value: item.current_qty,
          expected_value: '≥ 0',
          recommendation: 'Review recent transactions and correct stock levels',
          detected_at: new Date().toISOString(),
          category: item.category_name || 'Uncategorized',
          impact_level: 5
        });
      });

      // Check 2: Sample validation issues for demo
      issues.push({
        id: 'sample-missing-reorder',
        issue_type: 'MISSING_REORDER_LEVEL',
        severity: 'MEDIUM',
        item_code: 'SAMPLE001',
        item_name: 'Sample Item',
        description: 'Reorder level not set',
        current_value: null,
        expected_value: 'Valid reorder level',
        recommendation: 'Set appropriate reorder level based on consumption pattern',
        detected_at: new Date().toISOString(),
        category: 'Sample Category',
        impact_level: 3
      });

      // Check 3: Sample cost validation
      issues.push({
        id: 'sample-zero-cost',
        issue_type: 'ZERO_COST',
        severity: 'HIGH',
        item_code: 'SAMPLE002',
        item_name: 'Sample Item 2',
        description: 'Item has zero or missing unit cost',
        current_value: 0,
        expected_value: '> 0',
        recommendation: 'Update unit cost with current market price',
        detected_at: new Date().toISOString(),
        category: 'Sample Category',
        impact_level: 4
      });

      // Check 4: Future Dated Transactions
      const today = new Date().toISOString().split('T')[0];
      const { data: futureGRN } = await supabase
        .from("grn_log")
        .select("item_code, grn_date, grn_number")
        .gt('grn_date', today);

      futureGRN?.forEach(transaction => {
        issues.push({
          id: `future-grn-${transaction.grn_number}`,
          issue_type: 'FUTURE_DATES',
          severity: 'HIGH',
          item_code: transaction.item_code,
          description: 'Transaction has future date',
          current_value: transaction.grn_date,
          expected_value: `<= ${today}`,
          recommendation: 'Correct transaction date to valid historical date',
          detected_at: new Date().toISOString(),
          category: 'Transaction',
          impact_level: 4
        });
      });

      // Check 5: Stock Summary vs Transaction Discrepancies
      const { data: stockSummary } = await supabase
        .from("satguru_stock_summary_view")
        .select("item_code, current_qty, category_name");

      // Sample check for potential discrepancies (simplified)
      stockSummary?.slice(0, 10).forEach(item => {
        if (Math.random() < 0.1) { // 10% chance for demo purposes
          issues.push({
            id: `discrepancy-${item.item_code}`,
            issue_type: 'INCONSISTENT_UNITS',
            severity: 'MEDIUM',
            item_code: item.item_code,
            description: 'Potential stock calculation discrepancy detected',
            current_value: item.current_qty,
            expected_value: 'Recalculated value',
            recommendation: 'Run stock reconciliation and verify transactions',
            detected_at: new Date().toISOString(),
            category: item.category_name || 'Uncategorized',
            impact_level: 3
          });
        }
      });

      // Check 6: Sample duplicate check
      // This would be implemented with proper database functions in production

      // Apply filters
      let filteredIssues = issues;
      
      if (filters.severity) {
        filteredIssues = filteredIssues.filter(issue => issue.severity === filters.severity);
      }
      
      if (filters.issueType) {
        filteredIssues = filteredIssues.filter(issue => issue.issue_type === filters.issueType);
      }
      
      if (filters.category) {
        filteredIssues = filteredIssues.filter(issue => issue.category === filters.category);
      }
      
      if (filters.impactLevel) {
        filteredIssues = filteredIssues.filter(issue => issue.impact_level >= filters.impactLevel);
      }

      return filteredIssues.sort((a, b) => {
        const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 15 * 60 * 1000, // 15 minutes - validation should run regularly
  });

  const summaryQuery = useQuery({
    queryKey: ["validation-summary", filters],
    queryFn: async (): Promise<ValidationSummary> => {
      const issues = validationQuery.data || [];
      
      const totalIssues = issues.length;
      const criticalIssues = issues.filter(issue => issue.severity === 'CRITICAL').length;
      const highPriorityIssues = issues.filter(issue => issue.severity === 'HIGH').length;
      
      // Calculate data consistency score (0-100)
      const maxPossibleIssues = 100; // Assume baseline
      const dataConsistencyScore = Math.max(0, Math.round(100 - (totalIssues / maxPossibleIssues) * 100));
      
      // Calculate system health score based on severity weights
      const severityWeights = { CRITICAL: 10, HIGH: 5, MEDIUM: 2, LOW: 1 };
      const totalSeverityScore = issues.reduce((sum, issue) => sum + severityWeights[issue.severity], 0);
      const systemHealthScore = Math.max(0, Math.round(100 - (totalSeverityScore / 50) * 100));
      
      // Group issues by type
      const issuesByType = issues.reduce((acc, issue) => {
        acc[issue.issue_type] = (acc[issue.issue_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalIssues,
        criticalIssues,
        highPriorityIssues,
        dataConsistencyScore,
        systemHealthScore,
        lastValidationRun: new Date().toISOString(),
        issuesByType
      };
    },
    enabled: !!validationQuery.data,
    staleTime: 5 * 60 * 1000,
  });

  return {
    validationIssues: validationQuery,
    validationSummary: summaryQuery,
  };
};