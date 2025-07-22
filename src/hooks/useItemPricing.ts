
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
      
      // Mock data for now - replace with actual Supabase query once table exists
      const mockData: ItemPricingEntry[] = [
        {
          id: '1',
          item_code: 'BOPP-001',
          item_name: 'BOPP Film 20 Micron',
          category: 'Films',
          uom: 'KG',
          current_price: 120.50,
          previous_price: 118.00,
          cost_category: 'Raw Materials',
          supplier: 'SUP-001',
          effective_date: new Date().toISOString().split('T')[0],
          approval_status: 'APPROVED',
          price_change_reason: 'Market rate adjustment',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true
        },
        {
          id: '2',
          item_code: 'INK-RED-001',
          item_name: 'Gravure Ink Red',
          category: 'Inks',
          uom: 'KG',
          current_price: 450.00,
          cost_category: 'Consumables',
          supplier: 'SUP-002',
          effective_date: new Date().toISOString().split('T')[0],
          approval_status: 'PENDING',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true
        }
      ];

      // Apply filters
      let filteredData = mockData;
      
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

  const mutate = async (params: { itemId: string; newPrice: number; reason: string }) => {
    setIsPending(true);
    try {
      // Mock implementation - replace with actual Supabase update
      console.log('Updating item price:', params);
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true };
    } catch (error) {
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  const mutateAsync = async (params: { itemId: string; newPrice: number; reason: string }) => {
    return mutate(params);
  };

  return {
    mutate: (params: { itemId: string; newPrice: number; reason: string }, options?: any) => {
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
