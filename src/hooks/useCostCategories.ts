
import { useState, useEffect } from 'react';

export interface CostCategory {
  id: string;
  category_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useCostCategories = () => {
  const [costCategories, setCostCategories] = useState<CostCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const fetchCostCategories = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Mock data for now - replace with actual Supabase query once table exists
      const mockCategories: CostCategory[] = [
        {
          id: '1',
          category_name: 'Raw Materials',
          description: 'Films, papers, inks, and other raw materials',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '2',
          category_name: 'Consumables',
          description: 'Inks, adhesives, solvents, and consumable materials',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '3',
          category_name: 'Finished Goods',
          description: 'Completed products ready for sale',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      setCostCategories(mockCategories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cost categories');
      console.error('Error fetching cost categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = async () => {
    await fetchCostCategories();
  };

  const createCostCategory = async (categoryData: Omit<CostCategory, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Mock implementation - replace with actual Supabase insert
      console.log('Creating cost category:', categoryData);
      await fetchCostCategories(); // Refresh data
    } catch (err) {
      throw new Error('Failed to create cost category');
    }
  };

  const updateCostCategory = async (id: string, updates: Partial<CostCategory>) => {
    try {
      // Mock implementation - replace with actual Supabase update
      console.log('Updating cost category:', id, updates);
      await fetchCostCategories(); // Refresh data
    } catch (err) {
      throw new Error('Failed to update cost category');
    }
  };

  const deleteCostCategory = async (id: string) => {
    try {
      // Mock implementation - replace with actual Supabase delete
      console.log('Deleting cost category:', id);
      await fetchCostCategories(); // Refresh data
    } catch (err) {
      throw new Error('Failed to delete cost category');
    }
  };

  useEffect(() => {
    fetchCostCategories();
  }, []);

  return {
    costCategories,
    isLoading,
    error,
    refetch,
    createCostCategory,
    updateCostCategory,
    deleteCostCategory
  };
};
