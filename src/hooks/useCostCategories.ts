
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CostCategory {
  id: string;
  category_code: string;
  category_name: string;
  description?: string;
  allocation_method?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCostCategories() {
  const [costCategories, setCostCategories] = useState<CostCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCostCategories = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // For now, return mock data since the cost_categories table doesn't exist in the current schema
      const mockCategories: CostCategory[] = [
        {
          id: '1',
          category_code: 'MAT',
          category_name: 'Material Cost',
          description: 'Direct material costs',
          allocation_method: 'DIRECT',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '2', 
          category_code: 'LAB',
          category_name: 'Labor Cost',
          description: 'Direct labor costs',
          allocation_method: 'DIRECT',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: '3',
          category_code: 'OH',
          category_name: 'Overhead Cost',
          description: 'Manufacturing overhead',
          allocation_method: 'ALLOCATED',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      
      setCostCategories(mockCategories);
    } catch (err) {
      console.error('Error fetching cost categories:', err);
      setError('Failed to fetch cost categories');
      toast({
        title: "Error",
        description: "Failed to fetch cost categories",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createCostCategory = async (categoryData: Omit<CostCategory, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Mock implementation - in real scenario this would insert to database
      const newCategory: CostCategory = {
        ...categoryData,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      setCostCategories(prev => [...prev, newCategory]);
      
      toast({
        title: "Success",
        description: "Cost category created successfully",
      });
      
      return { data: newCategory, error: null };
    } catch (err) {
      console.error('Error creating cost category:', err);
      toast({
        title: "Error", 
        description: "Failed to create cost category",
        variant: "destructive",
      });
      return { data: null, error: err };
    }
  };

  const updateCostCategory = async (id: string, updates: Partial<CostCategory>) => {
    try {
      setCostCategories(prev => 
        prev.map(cat => 
          cat.id === id 
            ? { ...cat, ...updates, updated_at: new Date().toISOString() }
            : cat
        )
      );
      
      toast({
        title: "Success",
        description: "Cost category updated successfully",
      });
      
      return { error: null };
    } catch (err) {
      console.error('Error updating cost category:', err);
      toast({
        title: "Error",
        description: "Failed to update cost category",
        variant: "destructive",
      });
      return { error: err };
    }
  };

  const deleteCostCategory = async (id: string) => {
    try {
      setCostCategories(prev => prev.filter(cat => cat.id !== id));
      
      toast({
        title: "Success",
        description: "Cost category deleted successfully",
      });
      
      return { error: null };
    } catch (err) {
      console.error('Error deleting cost category:', err);
      toast({
        title: "Error",
        description: "Failed to delete cost category", 
        variant: "destructive",
      });
      return { error: err };
    }
  };

  useEffect(() => {
    fetchCostCategories();
  }, []);

  return {
    costCategories,
    isLoading,
    error,
    refetch: fetchCostCategories,
    createCostCategory,
    updateCostCategory,
    deleteCostCategory
  };
}
