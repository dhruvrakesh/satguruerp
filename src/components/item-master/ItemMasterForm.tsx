import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { itemMasterSchema, ItemMasterFormData } from "@/schemas/itemMasterSchema";
import { useItemMasterMutations } from "@/hooks/useItemMaster";
import { useItemCodeGeneration } from "@/hooks/useItemCodeGeneration";
import { useCategories } from "@/hooks/useCategories";
import { Wand2, Check, X, Loader2 } from "lucide-react";

interface ItemMasterItem {
  id: string;
  item_code: string;
  item_name: string;
  category_id: string;
  qualifier?: string;
  gsm?: number;
  size_mm?: string;
  uom: string;
  usage_type?: string;
  status: string;
}

interface ItemMasterFormProps {
  item?: ItemMasterItem;
  onSuccess?: () => void;
}

export function ItemMasterForm({ item, onSuccess }: ItemMasterFormProps) {
  const isEditing = !!item;
  const { createItem, updateItem } = useItemMasterMutations();
  const { generatedCode, isValidating, isUnique, updateCode, validateManualCode, isGenerating } = useItemCodeGeneration();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const categoriesArray = Array.isArray(categories) ? categories : [];

  const form = useForm<ItemMasterFormData>({
    resolver: zodResolver(itemMasterSchema),
    defaultValues: {
      item_code: item?.item_code || "",
      item_name: item?.item_name || "",
      category_id: item?.category_id || "",
      qualifier: item?.qualifier || "",
      gsm: item?.gsm || undefined,
      size_mm: item?.size_mm || "",
      uom: (item?.uom as "PCS" | "KG" | "MTR" | "SQM" | "LTR" | "BOX" | "ROLL") || "PCS",
      usage_type: (item?.usage_type as "RAW_MATERIAL" | "FINISHED_GOOD" | "PACKAGING" | "CONSUMABLE") || undefined,
      status: (item?.status as "active" | "inactive") || "active"
    }
  });

  const categoryId = form.watch('category_id');
  const qualifier = form.watch('qualifier');
  const sizeMm = form.watch('size_mm');
  const gsm = form.watch('gsm');

  useEffect(() => {
    if (!isEditing && categoryId) {
      const selectedCategory = categoriesArray.find(c => c.id === categoryId);
      if (selectedCategory) {
        updateCode({
          categoryName: selectedCategory.category_name,
          qualifier,
          size: sizeMm,
          gsm
        });
      }
    }
  }, [categoryId, qualifier, sizeMm, gsm, isEditing, updateCode, categories]);

  useEffect(() => {
    if (generatedCode && !isEditing) {
      form.setValue('item_code', generatedCode);
    }
  }, [generatedCode, form, isEditing]);

  const onSubmit = async (data: ItemMasterFormData) => {
    try {
      if (isEditing && item) {
        await updateItem.mutateAsync({ id: item.id, updates: data });
      } else {
        await createItem.mutateAsync(data);
      }
      onSuccess?.();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to submit form",
        variant: "destructive" 
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="item_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter item name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoriesLoading ? (
                            <SelectItem value="__LOADING__" disabled>Loading categories...</SelectItem>
                          ) : (
                            categoriesArray.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.category_name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="qualifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qualifier</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Sample, Premium, Standard" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Specifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gsm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GSM</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="80" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="size_mm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Size (mm)</FormLabel>
                        <FormControl>
                          <Input placeholder="100x150" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="uom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit of Measure *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PCS">PCS</SelectItem>
                            <SelectItem value="KG">KG</SelectItem>
                            <SelectItem value="MTR">MTR</SelectItem>
                            <SelectItem value="SQM">SQM</SelectItem>
                            <SelectItem value="LTR">LTR</SelectItem>
                            <SelectItem value="BOX">BOX</SelectItem>
                            <SelectItem value="ROLL">ROLL</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="usage_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usage Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="RAW_MATERIAL">Raw Material</SelectItem>
                            <SelectItem value="FINISHED_GOOD">Finished Good</SelectItem>
                            <SelectItem value="PACKAGING">Packaging</SelectItem>
                            <SelectItem value="CONSUMABLE">Consumable</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wand2 className="w-5 h-5" />
                  Item Code Generation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="item_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Code *</FormLabel>
                      <div className="space-y-2">
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Auto-generated or manual entry"
                            onChange={(e) => {
                              field.onChange(e);
                              if (isEditing) {
                                validateManualCode(e.target.value);
                              }
                            }}
                          />
                        </FormControl>
                        
                        {!isEditing && (
                          <div className="text-sm text-muted-foreground">
                            {isGenerating ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generating code...
                              </div>
                            ) : generatedCode ? (
                              <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-500" />
                                Auto-generated from category + specifications
                              </div>
                            ) : (
                              "Fill category and specifications to generate code"
                            )}
                          </div>
                        )}

                        {field.value && (
                          <div className="flex items-center gap-2">
                            {isValidating ? (
                              <div className="flex items-center gap-2 text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Checking availability...
                              </div>
                            ) : isUnique === true ? (
                              <Badge variant="default" className="text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                Available
                              </Badge>
                            ) : isUnique === false ? (
                              <Badge variant="destructive" className="text-xs">
                                <X className="w-3 h-3 mr-1" />
                                Already exists
                              </Badge>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isEditing && (
                  <div className="p-3 bg-muted rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Code Format Preview:</h4>
                    <div className="text-sm font-mono text-muted-foreground">
                      [CATEGORY]_[QUALIFIER]_[SIZE]_[GSM]
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Example: RAW_SAMPLE_100x150_80
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onSuccess}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={createItem.isPending || updateItem.isPending || (isUnique === false)}
          >
            {createItem.isPending || updateItem.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEditing ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              isEditing ? 'Update Item' : 'Create Item'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}