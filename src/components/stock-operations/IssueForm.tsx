
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { AlertTriangle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useStockIssueMutations, StockIssueFormData } from "@/hooks/useStockIssues";
import { useStockValidation, useItemCodeValidation } from "@/hooks/useStockValidation";
import { StockValidationAlert } from "./StockValidationAlert";
import { ItemCodeSelector } from "@/components/shared/ItemCodeSelector";
import { toast } from "@/hooks/use-toast";

const issueSchema = z.object({
  date: z.string().min(1, "Date is required"),
  item_code: z.string().min(1, "Item code is required"),
  qty_issued: z.number().positive("Quantity must be positive"),
  purpose: z.string().optional(),
  total_issued_qty: z.number().optional(),
  remarks: z.string().optional(),
});

const PURPOSE_OPTIONS = [
  "Manufacturing",
  "Sampling", 
  "R&D",
  "Quality Testing",
  "Maintenance",
  "Sales Sample",
  "Trial Run",
  "Wastage",
  "Other"
];

interface IssueFormProps {
  onSuccess?: () => void;
  initialData?: Partial<StockIssueFormData>;
}

export function IssueForm({ onSuccess, initialData }: IssueFormProps) {
  const { createIssue } = useStockIssueMutations();

  const form = useForm<z.infer<typeof issueSchema>>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      date: initialData?.date || format(new Date(), "yyyy-MM-dd"),
      item_code: initialData?.item_code || "",
      qty_issued: initialData?.qty_issued || 0,
      purpose: initialData?.purpose || "",
      total_issued_qty: initialData?.total_issued_qty || undefined,
      remarks: initialData?.remarks || "",
    },
  });

  const watchedItemCode = form.watch("item_code");
  const watchedQtyIssued = form.watch("qty_issued");

  const { data: itemValidation } = useItemCodeValidation(watchedItemCode);
  const { data: stockData } = useStockValidation(watchedItemCode);

  const hasInsufficientStock = stockData && watchedQtyIssued > stockData.available;
  const availableStock = stockData?.available || 0;

  const onSubmit = async (values: z.infer<typeof issueSchema>) => {
    if (hasInsufficientStock) {
      return;
    }

    try {
      await createIssue.mutateAsync(values as StockIssueFormData);
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create issue",
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
            name="date"
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

          <FormField
            control={form.control}
            name="purpose"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purpose</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select purpose" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PURPOSE_OPTIONS.map((purpose) => (
                      <SelectItem key={purpose} value={purpose}>
                        {purpose}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  {stockData && (
                    <div className="text-sm font-medium mt-1">
                      Available Stock: {stockData.available} {itemValidation.uom}
                    </div>
                  )}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {hasInsufficientStock && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Insufficient stock! Available: {availableStock}, Required: {watchedQtyIssued}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="qty_issued"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity to Issue</FormLabel>
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
            name="total_issued_qty"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Issued Qty (Optional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Running total"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                  />
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

        {watchedItemCode && watchedQtyIssued > 0 && (
          <StockValidationAlert 
            itemCode={watchedItemCode}
            requestedQuantity={watchedQtyIssued}
          />
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
          >
            Reset
          </Button>
          <Button 
            type="submit" 
            disabled={createIssue.isPending || hasInsufficientStock}
          >
            {createIssue.isPending ? "Creating..." : "Issue Stock"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
