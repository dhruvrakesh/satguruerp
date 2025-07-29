import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePurchaseOrderEdit } from "@/hooks/usePurchaseOrderEdit";
import { useAuth } from "@/contexts/AuthContext";
import { useSuppliers } from "@/hooks/useSuppliers";

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name?: string;
  delivery_date: string;
  priority: string;
  remarks?: string;
  status: string;
}

interface PurchaseOrderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder | null;
  onEditSuccess: () => void;
}

const formSchema = z.object({
  supplier_id: z.string().min(1, "Supplier is required"),
  delivery_date: z.string().min(1, "Delivery date is required"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT", "EMERGENCY"]),
  remarks: z.string().optional(),
});

export function PurchaseOrderEditDialog({
  open,
  onOpenChange,
  purchaseOrder,
  onEditSuccess,
}: PurchaseOrderEditDialogProps) {
  const { updatePurchaseOrder, canEdit, isLoading } = usePurchaseOrderEdit();
  const { profile } = useAuth();
  const { data: suppliers = [] } = useSuppliers();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplier_id: "",
      delivery_date: "",
      priority: "MEDIUM",
      remarks: "",
    },
  });

  React.useEffect(() => {
    if (purchaseOrder && open) {
      form.reset({
        supplier_id: purchaseOrder.supplier_id || "",
        delivery_date: purchaseOrder.delivery_date?.split('T')[0] || "",
        priority: purchaseOrder.priority as any || "MEDIUM",
        remarks: purchaseOrder.remarks || "",
      });
    }
  }, [purchaseOrder, open, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!purchaseOrder) return;

    if (!canEdit(purchaseOrder.status, profile?.role)) {
      return;
    }

    const result = await updatePurchaseOrder(purchaseOrder.id, values);
    
    if (result.success) {
      onOpenChange(false);
      onEditSuccess();
    }
  };

  if (!purchaseOrder) return null;

  const isEditable = purchaseOrder ? canEdit(purchaseOrder.status, profile?.role) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Purchase Order</DialogTitle>
          <DialogDescription>
            {isEditable 
              ? `Edit details for PO ${purchaseOrder.po_number}`
              : `Cannot edit PO ${purchaseOrder.po_number} - Status: ${purchaseOrder.status}`
            }
          </DialogDescription>
        </DialogHeader>

        {!isEditable ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">
              {profile?.role === 'admin' 
                ? 'Admin access: You can edit purchase orders in any status.'
                : 'This purchase order cannot be edited because it has been submitted for approval. Only DRAFT purchase orders can be modified.'
              }
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a supplier" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.supplier_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                name="priority"
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
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any additional remarks"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Update Purchase Order"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}