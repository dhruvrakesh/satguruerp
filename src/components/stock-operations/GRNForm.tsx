
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGRNMutations, useNextGRNNumber, GRNFormData } from "@/hooks/useGRN";
import { useItemCodeValidation } from "@/hooks/useStockValidation";
import { ItemCodeSelector } from "@/components/shared/ItemCodeSelector";
import { toast } from "@/hooks/use-toast";

const grnSchema = z.object({
  grn_number: z.string().min(1, "GRN number is required"),
  grn_date: z.string().min(1, "Date is required"),
  item_code: z.string().min(1, "Item code is required"),
  qty_received: z.number().positive("Quantity must be positive"),
  unit_price: z.number().optional(),
  total_value: z.number().optional(),
  supplier: z.string().optional(),
  invoice_number: z.string().optional(),
  remarks: z.string().optional(),
});

interface GRNFormProps {
  onSuccess?: () => void;
  initialData?: Partial<GRNFormData>;
}

export function GRNForm({ onSuccess, initialData }: GRNFormProps) {
  const { data: nextGRNNumber } = useNextGRNNumber();
  const { createGRN } = useGRNMutations();

  const form = useForm<z.infer<typeof grnSchema>>({
    resolver: zodResolver(grnSchema),
    defaultValues: {
      grn_number: initialData?.grn_number || nextGRNNumber || "",
      grn_date: initialData?.grn_date || format(new Date(), "yyyy-MM-dd"),
      item_code: initialData?.item_code || "",
      qty_received: initialData?.qty_received || 0,
      unit_price: initialData?.unit_price || undefined,
      total_value: initialData?.total_value || undefined,
      supplier: initialData?.supplier || "",
      invoice_number: initialData?.invoice_number || "",
      remarks: initialData?.remarks || "",
    },
  });

  const watchedItemCode = form.watch("item_code");
  const watchedQty = form.watch("qty_received");
  const watchedUnitPrice = form.watch("unit_price");

  const { data: itemValidation } = useItemCodeValidation(watchedItemCode);

  // Auto-calculate total value
  React.useEffect(() => {
    if (watchedQty && watchedUnitPrice) {
      form.setValue("total_value", watchedQty * watchedUnitPrice);
    }
  }, [watchedQty, watchedUnitPrice, form]);

  const onSubmit = async (values: z.infer<typeof grnSchema>) => {
    try {
      await createGRN.mutateAsync(values as GRNFormData);
      form.reset();
      onSuccess?.();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create GRN",
        variant: "destructive" 
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="grn_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GRN Number</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Auto-generated" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="grn_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="item_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Item Code</FormLabel>
              <FormControl>
                <ItemCodeSelector
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Click to search and select item..."
                  error={form.formState.errors.item_code?.message}
                />
              </FormControl>
              {itemValidation && (
                <div className="text-sm text-muted-foreground">
                  {itemValidation.item_name} ({itemValidation.uom})
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="qty_received"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity Received</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="unit_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit Price (Optional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="total_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Value</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Auto-calculated"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="supplier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier (Optional)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Supplier name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="invoice_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Invoice Number (Optional)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Invoice number" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remarks (Optional)</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Additional notes..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
          >
            Reset
          </Button>
          <Button type="submit" disabled={createGRN.isPending}>
            {createGRN.isPending ? "Creating..." : "Create GRN"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
