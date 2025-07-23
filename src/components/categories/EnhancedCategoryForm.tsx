
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { AlertCircle, Save, X, Loader2 } from "lucide-react";
import { useEnhancedCategoryMutations, EnhancedCategory } from "@/hooks/useEnhancedCategories";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

const categorySchema = z.object({
  category_name: z.string().min(2, "Category name must be at least 2 characters").max(100, "Category name must be less than 100 characters"),
  description: z.string().optional(),
  category_code: z.string().optional().refine((val) => !val || /^[A-Z0-9_-]+$/.test(val), "Category code must contain only uppercase letters, numbers, underscores, and hyphens"),
  parent_category_id: z.string().optional(),
  category_type: z.enum(["STANDARD", "SYSTEM", "TEMPORARY"]).default("STANDARD"),
  is_active: z.boolean().default(true),
  sort_order: z.number().default(0),
  business_rules: z.record(z.any()).default({}),
  metadata: z.record(z.any()).default({})
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface EnhancedCategoryFormProps {
  category?: EnhancedCategory;
  parentCategories?: EnhancedCategory[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function EnhancedCategoryForm({ 
  category, 
  parentCategories = [], 
  onClose, 
  onSuccess 
}: EnhancedCategoryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { createCategory, updateCategory } = useEnhancedCategoryMutations();
  
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      category_name: category?.category_name || "",
      description: category?.description || "",
      category_code: category?.category_code || "",
      parent_category_id: category?.parent_category_id || "",
      category_type: category?.category_type || "STANDARD",
      is_active: category?.is_active ?? true,
      sort_order: category?.sort_order || 0,
      business_rules: category?.business_rules || {},
      metadata: category?.metadata || {}
    }
  });

  const isEditing = !!category;

  const onSubmit = async (data: CategoryFormData) => {
    setIsSubmitting(true);
    setValidationErrors([]);

    try {
      if (isEditing) {
        await updateCategory.mutateAsync({
          id: category.id,
          updates: {
            ...data,
            parent_category_id: data.parent_category_id || null
          }
        });
      } else {
        await createCategory.mutateAsync({
          ...data,
          parent_category_id: data.parent_category_id || null
        });
      }

      toast({
        title: "Success",
        description: `Category ${isEditing ? 'updated' : 'created'} successfully`,
      });

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Category form error:", error);
      
      // Handle validation errors from backend
      if (error.message?.includes('validation')) {
        setValidationErrors([error.message]);
      } else {
        toast({
          title: "Error",
          description: error.message || `Failed to ${isEditing ? 'update' : 'create'} category`,
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter parent categories to prevent circular references
  const availableParentCategories = parentCategories.filter(cat => 
    cat.id !== category?.id && cat.parent_category_id !== category?.id
  );

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {isEditing ? 'Edit Category' : 'Create New Category'}
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {validationErrors.length > 0 && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {validationErrors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter category name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Code</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="AUTO_GENERATED" 
                        {...field}
                        style={{ textTransform: 'uppercase' }}
                      />
                    </FormControl>
                    <FormDescription>
                      Leave empty for auto-generation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter category description" 
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="parent_category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No Parent</SelectItem>
                        {availableParentCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.category_name}
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
                name="category_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="STANDARD">Standard</SelectItem>
                        <SelectItem value="SYSTEM">System</SelectItem>
                        <SelectItem value="TEMPORARY">Temporary</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sort_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort Order</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <FormDescription>
                      Inactive categories won't appear in new item creation
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {isEditing ? 'Update' : 'Create'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
