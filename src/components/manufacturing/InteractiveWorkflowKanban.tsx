
import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useManufacturingOrders } from "@/hooks/useManufacturingOrders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MANUFACTURING_CONFIG, mapUIStatusToDatabase } from "@/config/manufacturing";

export function InteractiveWorkflowKanban() {
  const { data: orders, isLoading, refetch } = useManufacturingOrders();
  const [columns, setColumns] = useState({
    pending: { id: 'pending', title: 'Pending', orders: [] },
    in_progress: { id: 'in_progress', title: 'In Progress', orders: [] },
    completed: { id: 'completed', title: 'Completed', orders: [] }
  });

  useEffect(() => {
    if (orders) {
      const newColumns = {
        pending: { id: 'pending', title: 'Pending', orders: [] },
        in_progress: { id: 'in_progress', title: 'In Progress', orders: [] },
        completed: { id: 'completed', title: 'Completed', orders: [] }
      };

      orders.forEach(order => {
        const status = order.status?.toLowerCase() || 'pending';
        if (newColumns[status as keyof typeof newColumns]) {
          newColumns[status as keyof typeof newColumns].orders.push(order);
        }
      });

      setColumns(newColumns);
    }
  }, [orders]);

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    if (source.droppableId === destination.droppableId) return;

    // Find the order being moved
    const order = orders?.find(o => o.id === draggableId);
    if (!order) return;

    // Map UI status to process status for new manufacturing stage status system
    const newStatus = mapUIStatusToDatabase(destination.droppableId);
    
    try {
      // Use the new manufacturing stage transition function
      const { error } = await supabase.rpc('handle_manufacturing_stage_transition', {
        p_uiorn: order.uiorn,
        p_stage: 'GRAVURE_PRINTING', // Default stage - should be determined dynamically
        p_status: newStatus,
        p_operator_id: null,
        p_machine_id: null,
        p_process_parameters: {},
        p_quality_metrics: {},
        p_notes: `Status updated via Kanban board to ${MANUFACTURING_CONFIG.STATUS_LABELS[newStatus]}`
      });

      if (error) throw error;

      toast.success(`Order ${order.uiorn} moved to ${MANUFACTURING_CONFIG.STATUS_LABELS[newStatus]}`);
      refetch();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading workflow...</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Manufacturing Workflow</h2>
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.values(columns).map(column => (
            <div key={column.id} className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-4 flex items-center justify-between">
                {column.title}
                <Badge variant="secondary">{column.orders.length}</Badge>
              </h3>
              
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[500px] space-y-3 ${
                      snapshot.isDraggingOver ? 'bg-blue-50' : ''
                    }`}
                  >
                    {column.orders.map((order: any, index: number) => (
                      <Draggable key={order.id} draggableId={order.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`cursor-move hover:shadow-md transition-shadow ${
                              snapshot.isDragging ? 'rotate-2 shadow-lg' : ''
                            }`}
                          >
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">{order.uiorn}</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-2 text-xs">
                                <div><strong>Customer:</strong> {order.customer_name}</div>
                                <div><strong>Product:</strong> {order.product_description}</div>
                                <div><strong>Quantity:</strong> {order.order_quantity}</div>
                                <div><strong>Priority:</strong> 
                                  <Badge variant="outline" className="ml-1 text-xs">
                                    {order.priority_level || 'NORMAL'}
                                  </Badge>
                                </div>
                                {order.delivery_date && (
                                  <div><strong>Delivery:</strong> {new Date(order.delivery_date).toLocaleDateString()}</div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
