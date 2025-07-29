import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier?: {
    supplier_name: string;
    supplier_code: string;
    contact_person: string;
    phone: string;
    email: string;
  };
  po_date: string;
  required_date?: string;
  delivery_date?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'ISSUED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'EMERGENCY';
  currency: string;
  total_amount: number;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED';
  created_at: string;
  created_by: string;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  uom: string;
  received_quantity: number;
  pending_quantity: number;
}

export interface Supplier {
  id: string;
  supplier_code: string;
  supplier_name: string;
  supplier_type: string;
  category: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  material_categories: string[];
  lead_time_days: number;
  is_active: boolean;
  performance_rating: number;
}

export const usePurchaseOrders = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPurchaseOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(
            supplier_name,
            supplier_code,
            contact_person,
            phone,
            email
          ),
          items:purchase_order_items(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchaseOrders(data || []);
    } catch (err) {
      console.error('Error fetching purchase orders:', err);
      setError('Failed to fetch purchase orders');
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('supplier_name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const generatePONumber = async (): Promise<string> => {
    try {
      const { data, error } = await supabase.rpc('generate_po_number');
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error generating PO number:', err);
      throw new Error('Failed to generate PO number');
    }
  };

  const createPurchaseOrder = async (orderData: any) => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Get user's organization
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();
      
      if (profileError || !profile?.organization_id) {
        throw new Error('User organization not found');
      }

      const poNumber = await generatePONumber();
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert({
          supplier_id: orderData.supplier_id,
          po_number: poNumber,
          po_date: orderData.po_date || new Date().toISOString().split('T')[0],
          required_date: orderData.required_date,
          delivery_date: orderData.delivery_date,
          status: orderData.status || 'DRAFT',
          priority: orderData.priority || 'MEDIUM',
          currency: orderData.currency || 'INR',
          total_amount: orderData.total_amount || 0,
          notes: orderData.notes,
          department: orderData.department,
          created_by: user.id,
          organization_id: profile.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Purchase order created successfully');
      await fetchPurchaseOrders();
      return data;
    } catch (err) {
      console.error('Error creating purchase order:', err);
      toast.error('Failed to create purchase order');
      throw err;
    }
  };

  const updatePurchaseOrder = async (id: string, updates: Partial<PurchaseOrder>) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Purchase order updated successfully');
      await fetchPurchaseOrders();
    } catch (err) {
      console.error('Error updating purchase order:', err);
      toast.error('Failed to update purchase order');
      throw err;
    }
  };

  const addPOItems = async (poId: string, items: any[]) => {
    try {
      const { error } = await supabase
        .from('purchase_order_items')
        .insert(
          items.map((item, index) => ({
            po_id: poId,
            item_code: item.item_code,
            item_name: item.item_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total || (item.quantity * item.unit_price),
            uom: item.uom,
            line_number: index + 1,
            description: item.description,
            specifications: item.specifications,
          }))
        );

      if (error) throw error;
      
      toast.success('Items added to purchase order');
      await fetchPurchaseOrders();
    } catch (err) {
      console.error('Error adding PO items:', err);
      toast.error('Failed to add items to purchase order');
      throw err;
    }
  };

  const submitForApproval = async (poId: string) => {
    try {
      // Update PO status
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'SUBMITTED',
          approval_status: 'PENDING',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', poId);

      if (updateError) throw updateError;

      // Create approval records
      const { error: approvalError } = await supabase
        .from('purchase_order_approvals')
        .insert({
          po_id: poId,
          approval_level: 1,
          approval_status: 'PENDING',
          created_at: new Date().toISOString()
        });

      if (approvalError) throw approvalError;
      
      toast.success('Purchase order submitted for approval');
      await fetchPurchaseOrders();
    } catch (err) {
      console.error('Error submitting for approval:', err);
      toast.error('Failed to submit for approval');
      throw err;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPurchaseOrders(), fetchSuppliers()]);
      setLoading(false);
    };

    loadData();
  }, []);

  return {
    purchaseOrders,
    suppliers,
    loading,
    error,
    createPurchaseOrder,
    updatePurchaseOrder,
    addPOItems,
    submitForApproval,
    refreshData: () => Promise.all([fetchPurchaseOrders(), fetchSuppliers()]),
    refetch: () => Promise.all([fetchPurchaseOrders(), fetchSuppliers()]),
  };
};