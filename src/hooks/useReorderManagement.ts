import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ReorderRule {
  id: string;
  item_code: string;
  supplier_id?: string;
  reorder_level: number;
  reorder_quantity: number;
  safety_stock: number;
  maximum_stock?: number;
  lead_time_days: number;
  minimum_order_quantity: number;
  economic_order_quantity?: number;
  auto_reorder_enabled: boolean;
  is_active: boolean;
  item_name?: string;
  current_stock?: number;
  supplier_name?: string;
}

export interface ReorderSuggestion {
  id: string;
  item_code: string;
  item_name?: string;
  current_stock: number;
  reorder_level: number;
  suggested_quantity: number;
  urgency_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimated_stockout_date?: string;
  supplier_id?: string;
  supplier_name?: string;
  estimated_cost?: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ORDERED';
  created_at: string;
}

export const useReorderManagement = () => {
  const [reorderRules, setReorderRules] = useState<ReorderRule[]>([]);
  const [reorderSuggestions, setReorderSuggestions] = useState<ReorderSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReorderRules = async () => {
    try {
      const { data, error } = await supabase
        .from('reorder_rules')
        .select(`
          *
        `)
        .eq('is_active', true)
        .order('item_code');

      if (error) throw error;
      
      // Get additional data separately to avoid join issues
      const rulesWithData = await Promise.all(
        (data || []).map(async (rule) => {
          const [itemData, supplierData, stockData] = await Promise.all([
            supabase
              .from('satguru_item_master')
              .select('item_name')
              .eq('item_code', rule.item_code)
              .single(),
            rule.supplier_id 
              ? supabase
                  .from('suppliers')
                  .select('supplier_name')
                  .eq('id', rule.supplier_id)
                  .single()
              : Promise.resolve({ data: null }),
            supabase
              .from('satguru_stock')
              .select('current_qty')
              .eq('item_code', rule.item_code)
              .single()
          ]);

          return {
            ...rule,
            item_name: itemData.data?.item_name || rule.item_code,
            supplier_name: supplierData.data?.supplier_name || 'No Supplier',
            current_stock: stockData.data?.current_qty || 0,
          };
        })
      );
      
      setReorderRules(rulesWithData);
    } catch (err) {
      console.error('Error fetching reorder rules:', err);
      setError('Failed to fetch reorder rules');
    }
  };

  const fetchReorderSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('reorder_suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get additional data separately
      const suggestionsWithData = await Promise.all(
        (data || []).map(async (suggestion) => {
          const [itemData, supplierData] = await Promise.all([
            supabase
              .from('satguru_item_master')
              .select('item_name')
              .eq('item_code', suggestion.item_code)
              .single(),
            suggestion.supplier_id 
              ? supabase
                  .from('suppliers')
                  .select('supplier_name')
                  .eq('id', suggestion.supplier_id)
                  .single()
              : Promise.resolve({ data: null })
          ]);

          return {
            ...suggestion,
            urgency_level: suggestion.urgency_level as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
            status: suggestion.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'ORDERED',
            item_name: itemData.data?.item_name || suggestion.item_code,
            supplier_name: supplierData.data?.supplier_name || 'No Supplier',
          };
        })
      );
      
      setReorderSuggestions(suggestionsWithData);
    } catch (err) {
      console.error('Error fetching reorder suggestions:', err);
    }
  };

  const calculateReorderSuggestions = async () => {
    try {
      const { data, error } = await supabase.rpc('calculate_reorder_suggestions');
      if (error) throw error;
      
      const result = data as any;
      toast.success(`Generated ${result.total_suggestions || 0} reorder suggestions`);
      if (result.critical_items > 0) {
        toast.warning(`⚠️ ${result.critical_items} items are critically low on stock!`);
      }
      
      await fetchReorderSuggestions();
      return result;
    } catch (err) {
      console.error('Error calculating reorder suggestions:', err);
      toast.error('Failed to calculate reorder suggestions');
      throw err;
    }
  };

  const createReorderRule = async (ruleData: Partial<ReorderRule>) => {
    try {
      const { error } = await supabase
        .from('reorder_rules')
        .insert({
          item_code: ruleData.item_code,
          supplier_id: ruleData.supplier_id,
          reorder_level: ruleData.reorder_level,
          reorder_quantity: ruleData.reorder_quantity,
          safety_stock: ruleData.safety_stock || 0,
          maximum_stock: ruleData.maximum_stock,
          lead_time_days: ruleData.lead_time_days || 7,
          minimum_order_quantity: ruleData.minimum_order_quantity || 1,
          economic_order_quantity: ruleData.economic_order_quantity,
          auto_reorder_enabled: ruleData.auto_reorder_enabled || false,
        });

      if (error) throw error;
      
      toast.success('Reorder rule created successfully');
      await fetchReorderRules();
    } catch (err) {
      console.error('Error creating reorder rule:', err);
      toast.error('Failed to create reorder rule');
      throw err;
    }
  };

  const updateReorderRule = async (id: string, updates: Partial<ReorderRule>) => {
    try {
      const { error } = await supabase
        .from('reorder_rules')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Reorder rule updated successfully');
      await fetchReorderRules();
    } catch (err) {
      console.error('Error updating reorder rule:', err);
      toast.error('Failed to update reorder rule');
      throw err;
    }
  };

  const deleteReorderRule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('reorder_rules')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Reorder rule deactivated');
      await fetchReorderRules();
    } catch (err) {
      console.error('Error deactivating reorder rule:', err);
      toast.error('Failed to deactivate reorder rule');
      throw err;
    }
  };

  const approveSuggestion = async (suggestionId: string) => {
    try {
      const { error } = await supabase
        .from('reorder_suggestions')
        .update({ status: 'APPROVED' })
        .eq('id', suggestionId);

      if (error) throw error;
      
      toast.success('Reorder suggestion approved');
      await fetchReorderSuggestions();
    } catch (err) {
      console.error('Error approving suggestion:', err);
      toast.error('Failed to approve suggestion');
      throw err;
    }
  };

  const rejectSuggestion = async (suggestionId: string) => {
    try {
      const { error } = await supabase
        .from('reorder_suggestions')
        .update({ status: 'REJECTED' })
        .eq('id', suggestionId);

      if (error) throw error;
      
      toast.success('Reorder suggestion rejected');
      await fetchReorderSuggestions();
    } catch (err) {
      console.error('Error rejecting suggestion:', err);
      toast.error('Failed to reject suggestion');
      throw err;
    }
  };

  const bulkApproveRules = async (itemCodes: string[]) => {
    try {
      // Get the approved suggestions for these items
      const { data: suggestions, error: fetchError } = await supabase
        .from('reorder_suggestions')
        .select('*')
        .in('item_code', itemCodes)
        .eq('status', 'PENDING');

      if (fetchError) throw fetchError;

      // Mark suggestions as approved
      const { error: updateError } = await supabase
        .from('reorder_suggestions')
        .update({ status: 'APPROVED' })
        .in('item_code', itemCodes)
        .eq('status', 'PENDING');

      if (updateError) throw updateError;

      toast.success(`Approved ${suggestions?.length || 0} reorder suggestions`);
      await fetchReorderSuggestions();
    } catch (err) {
      console.error('Error bulk approving suggestions:', err);
      toast.error('Failed to bulk approve suggestions');
      throw err;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchReorderRules(), fetchReorderSuggestions()]);
      setLoading(false);
    };

    loadData();
  }, []);

  return {
    reorderRules,
    reorderSuggestions,
    loading,
    error,
    createReorderRule,
    updateReorderRule,
    deleteReorderRule,
    calculateReorderSuggestions,
    approveSuggestion,
    rejectSuggestion,
    bulkApproveRules,
    refreshData: () => Promise.all([fetchReorderRules(), fetchReorderSuggestions()]),
  };
};