import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ABCItem {
  item_code: string;
  item_name: string;
  category_name: string;
  current_qty: number;
  unit_price: number;
  total_value: number;
  cumulative_value: number;
  cumulative_percentage: number;
  abc_class: 'A' | 'B' | 'C';
}

export interface ABCSummary {
  class: 'A' | 'B' | 'C';
  item_count: number;
  total_value: number;
  percentage_items: number;
  percentage_value: number;
}

export const useABCAnalysis = () => {
  const abcAnalysis = useQuery({
    queryKey: ["abc-analysis"],
    queryFn: async (): Promise<ABCItem[]> => {
      const { data, error } = await supabase
        .from("satguru_stock_summary_view")
        .select(`
          item_code,
          item_name,
          category_name,
          current_qty
        `)
        .gt('current_qty', 0);

      if (error) throw error;

      // Calculate total value for each item (using qty as proxy for value since no pricing data)
      const itemsWithValue = data.map(item => ({
        ...item,
        unit_price: 1, // Using unit price of 1 as proxy
        total_value: (item.current_qty || 0) * 1 // Using quantity as value proxy
      }));

      // Sort by total value descending
      itemsWithValue.sort((a, b) => b.total_value - a.total_value);

      // Calculate cumulative values and ABC classification
      const totalInventoryValue = itemsWithValue.reduce((sum, item) => sum + item.total_value, 0);
      let cumulativeValue = 0;

      const abcItems: ABCItem[] = itemsWithValue.map(item => {
        cumulativeValue += item.total_value;
        const cumulativePercentage = (cumulativeValue / totalInventoryValue) * 100;

        let abc_class: 'A' | 'B' | 'C';
        if (cumulativePercentage <= 80) {
          abc_class = 'A';
        } else if (cumulativePercentage <= 95) {
          abc_class = 'B';
        } else {
          abc_class = 'C';
        }

        return {
          ...item,
          cumulative_value: cumulativeValue,
          cumulative_percentage: cumulativePercentage,
          abc_class
        };
      });

      return abcItems;
    },
    refetchInterval: 300000, // 5 minutes
  });

  const abcSummary = useQuery({
    queryKey: ["abc-summary", abcAnalysis.data],
    queryFn: async (): Promise<ABCSummary[]> => {
      if (!abcAnalysis.data) return [];

      const summary = {
        A: { item_count: 0, total_value: 0 },
        B: { item_count: 0, total_value: 0 },
        C: { item_count: 0, total_value: 0 }
      };

      abcAnalysis.data.forEach(item => {
        summary[item.abc_class].item_count++;
        summary[item.abc_class].total_value += item.total_value;
      });

      const totalItems = abcAnalysis.data.length;
      const totalValue = abcAnalysis.data.reduce((sum, item) => sum + item.total_value, 0);

      return (['A', 'B', 'C'] as const).map(cls => ({
        class: cls,
        item_count: summary[cls].item_count,
        total_value: summary[cls].total_value,
        percentage_items: totalItems > 0 ? (summary[cls].item_count / totalItems) * 100 : 0,
        percentage_value: totalValue > 0 ? (summary[cls].total_value / totalValue) * 100 : 0
      }));
    },
    enabled: !!abcAnalysis.data,
  });

  return {
    abcAnalysis,
    abcSummary,
  };
};