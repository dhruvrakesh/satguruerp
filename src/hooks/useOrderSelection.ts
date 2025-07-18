import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OrderOption {
  uiorn: string;
  customer_name: string;
  product_description: string;
  status: string;
  order_date: string;
  delivery_date?: string;
  priority_level?: string;
}

export function useOrderSelection() {
  const [availableOrders, setAvailableOrders] = useState<OrderOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAvailableOrders();
  }, []);

  const loadAvailableOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_punching')
        .select('uiorn, customer_name, product_description, status, order_date, delivery_date, priority_level')
        .in('status', ['PENDING', 'IN_PROGRESS'])
        .order('order_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAvailableOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getOrdersByStatus = (status: string) => {
    return availableOrders.filter(order => order.status === status);
  };

  const getRecentOrders = (limit: number = 10) => {
    return availableOrders.slice(0, limit);
  };

  const getUrgentOrders = () => {
    return availableOrders.filter(order => 
      order.priority_level === 'URGENT' || order.priority_level === 'urgent'
    );
  };

  const searchOrders = (searchTerm: string) => {
    if (!searchTerm) return availableOrders;
    
    const term = searchTerm.toLowerCase();
    return availableOrders.filter(order =>
      order.uiorn.toLowerCase().includes(term) ||
      order.customer_name.toLowerCase().includes(term) ||
      order.product_description.toLowerCase().includes(term)
    );
  };

  return {
    availableOrders,
    isLoading,
    getOrdersByStatus,
    getRecentOrders,
    getUrgentOrders,
    searchOrders,
    refreshOrders: loadAvailableOrders
  };
}