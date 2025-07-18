import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateOrder } from "@/hooks/useManufacturingOrders";
import { useToast } from "@/hooks/use-toast";

const orderSchema = z.object({
  customer_name: z.string().min(1, "Customer name is required"),
  product_description: z.string().min(1, "Product description is required"),
  order_quantity: z.number().min(1, "Quantity must be greater than 0"),
  priority_level: z.enum(["low", "medium", "high", "urgent"]),
  delivery_date: z.string().min(1, "Delivery date is required"),
  special_instructions: z.string().optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

export function OrderCreationDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createOrder = useCreateOrder();

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_name: "",
      product_description: "",
      order_quantity: 0,
      priority_level: "medium",
      delivery_date: "",
      special_instructions: "",
    },
  });

  const onSubmit = async (data: OrderFormData) => {
    try {
      await createOrder.mutateAsync({
        item_code: "", // Temporary: will be deprecated in favor of EnhancedOrderCreationDialog
        customer_name: data.customer_name,
        product_description: data.product_description,
        order_quantity: data.order_quantity,
        priority_level: data.priority_level,
        delivery_date: data.delivery_date,
        special_instructions: data.special_instructions,
        order_date: new Date().toISOString().split('T')[0],
        status: "PENDING",
      });

      toast({
        title: "Order Created",
        description: "Manufacturing order has been created successfully.",
      });

      form.reset();
      setOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create order. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          New Order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Manufacturing Order</DialogTitle>
          <DialogDescription>
            Enter the details for a new production order. A UIORN will be automatically generated.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter customer name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="product_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., BOPP Film with UV coating, 25 micron" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="order_quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order Quantity</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Enter quantity" 
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="delivery_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="special_instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Instructions</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any special requirements or instructions..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createOrder.isPending}
              >
                {createOrder.isPending ? "Creating..." : "Create Order"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}