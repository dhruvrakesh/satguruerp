
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ItemPricingEntry {
  id: string;
  item_code: string;
  item_name: string;
  category: string;
  uom: string;
  current_price: number;
  previous_price?: number;
  cost_category: string;
  supplier?: string;
  effective_date: string;
  approval_status: 'APPROVED' | 'PENDING' | 'REJECTED';
  price_change_reason?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface UseItemPricingParams {
  category?: string;
  costCategory?: string;
  search?: string;
}

export const useItemPricing = (params?: UseItemPricingParams) => {
  const [data, setData] = useState<ItemPricingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch from actual database
      let query = supabase
        .from('item_pricing_master')
        .select('*')
        .eq('is_active', true)
        .order('effective_date', { ascending: false });

      const { data: pricingData, error } = await query;
      if (error) throw error;

      // Apply filters and transform data
      let filteredData = (pricingData || []).map(item => ({
        id: item.id,
        item_code: item.item_code,
        item_name: item.item_name || '',
        category: item.category || '',
        uom: item.uom || 'KG',
        current_price: item.current_price,
        previous_price: item.previous_price,
        cost_category: item.cost_category,
        supplier: item.supplier,
        effective_date: item.effective_date,
        approval_status: item.approval_status as 'APPROVED' | 'PENDING' | 'REJECTED',
        price_change_reason: item.price_change_reason,
        created_at: item.created_at,
        updated_at: item.updated_at,
        is_active: item.is_active
      }));
      
      if (params?.category && params.category !== 'all') {
        filteredData = filteredData.filter(item => 
          item.category.toLowerCase().includes(params.category!.toLowerCase())
        );
      }
      
      if (params?.costCategory && params.costCategory !== 'all') {
        filteredData = filteredData.filter(item => 
          item.cost_category.toLowerCase().includes(params.costCategory!.toLowerCase())
        );
      }
      
      if (params?.search) {
        filteredData = filteredData.filter(item => 
          item.item_code.toLowerCase().includes(params.search!.toLowerCase()) ||
          item.item_name.toLowerCase().includes(params.search!.toLowerCase())
        );
      }

      setData(filteredData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching item pricing:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [params?.category, params?.costCategory, params?.search]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData
  };
};

export const useUpdateItemPrice = () => {
  const [isPending, setIsPending] = useState(false);

  const mutate = async (params: { itemCode: string; newPrice: number; reason: string }) => {
    setIsPending(true);
    try {
      // Use the database function we created
      const { data, error } = await supabase.rpc('update_item_price', {
        p_item_code: params.itemCode,
        p_new_price: params.newPrice,
        p_reason: params.reason
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  const mutateAsync = async (params: { itemCode: string; newPrice: number; reason: string }) => {
    return mutate(params);
  };

  return {
    mutate: (params: { itemCode: string; newPrice: number; reason: string }, options?: any) => {
      mutate(params).then(options?.onSuccess).catch(options?.onError);
    },
    mutateAsync,
    isPending
  };
};

export const useAddItemPrice = () => {
  const [isPending, setIsPending] = useState(false);

  const mutate = async (data: Omit<ItemPricingEntry, 'id' | 'created_at' | 'updated_at'>) => {
    setIsPending(true);
    try {
      // Mock implementation - replace with actual Supabase insert
      console.log('Adding new item price:', data);
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true };
    } catch (error) {
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  const mutateAsync = async (data: Omit<ItemPricingEntry, 'id' | 'created_at' | 'updated_at'>) => {
    return mutate(data);
  };

  return {
    mutate: (data: Omit<ItemPricingEntry, 'id' | 'created_at' | 'updated_at'>, options?: any) => {
      mutate(data).then(options?.onSuccess).catch(options?.onError);
    },
    mutateAsync,
    isPending
  };
};
