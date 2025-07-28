
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Building2, MapPin, Phone, Mail, CreditCard, Star, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useVendorMutations } from "@/hooks/useVendorMutations";

const vendorSchema = z.object({
  supplier_name: z.string().min(2, "Supplier name must be at least 2 characters"),
  supplier_code: z.string().optional(),
  supplier_type: z.enum(["MANUFACTURER", "DISTRIBUTOR", "VENDOR", "AGENT"]),
  category: z.enum(["PREMIUM", "STANDARD", "BACKUP"]),
  contact_person: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  gst_number: z.string().optional(),
  pan_number: z.string().optional(),
  payment_terms: z.string().optional(),
  credit_limit: z.number().optional(),
  lead_time_days: z.number().min(0, "Lead time must be positive"),
  material_categories: z.array(z.string()).min(1, "Select at least one material category"),
  performance_rating: z.number().min(0).max(100).default(75),
});

type VendorFormData = z.infer<typeof vendorSchema>;

interface VendorCreationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: any;
  mode?: 'create' | 'edit';
}

const SUPPLIER_TYPES = [
  { value: "MANUFACTURER", label: "Manufacturer" },
  { value: "DISTRIBUTOR", label: "Distributor" },
  { value: "VENDOR", label: "Vendor" },
  { value: "AGENT", label: "Agent" },
];

const CATEGORIES = [
  { value: "PREMIUM", label: "Premium", description: "High-quality, reliable suppliers" },
  { value: "STANDARD", label: "Standard", description: "Regular suppliers with good performance" },
  { value: "BACKUP", label: "Backup", description: "Alternative suppliers for contingency" },
];

const MATERIAL_CATEGORIES = [
  "Raw Materials",
  "Packaging Materials",
  "Printing Supplies",
  "Adhesives & Chemicals",
  "Consumables",
  "Spare Parts",
  "Services",
  "Equipment",
];


export function VendorCreationForm({ onSuccess, onCancel, initialData, mode = 'create' }: VendorCreationFormProps) {
  const [selectedMaterialCategories, setSelectedMaterialCategories] = useState<string[]>(
    initialData?.material_categories || []
  );
  const queryClient = useQueryClient();
  const { updateVendor } = useVendorMutations();

  // Parse address from initialData if it exists
  const parseInitialAddress = (address: any) => {
    if (typeof address === 'string') return { address };
    if (address && typeof address === 'object') {
      return {
        address: address.street || '',
        city: address.city || '',
        state: address.state || '',
        pincode: address.postal_code || '',
      };
    }
    return {};
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      supplier_name: initialData?.supplier_name || '',
      supplier_type: initialData?.supplier_type || undefined,
      category: initialData?.category || undefined,
      contact_person: initialData?.contact_person || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      ...parseInitialAddress(initialData?.address),
      gst_number: initialData?.tax_details?.gst_number || '',
      pan_number: initialData?.tax_details?.pan_number || '',
      payment_terms: initialData?.payment_terms || '',
      credit_limit: initialData?.credit_limit || undefined,
      lead_time_days: initialData?.lead_time_days || 7,
      material_categories: initialData?.material_categories || [],
      performance_rating: initialData?.performance_rating || 75,
    },
  });

  const generateSupplierCode = (supplierName: string) => {
    const prefix = supplierName.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    return `SUP-${prefix}-${timestamp}`;
  };

  const createVendorMutation = useMutation({
    mutationFn: async (data: VendorFormData) => {
      // Generate supplier code using database function
      const { data: generatedCode, error: codeError } = await supabase
        .rpc('generate_supplier_code');
      
      if (codeError) throw new Error(`Failed to generate supplier code: ${codeError.message}`);
      
      const { data: result, error } = await supabase
        .from('suppliers')
        .insert({
          supplier_code: generatedCode,
          supplier_name: data.supplier_name,
          supplier_type: data.supplier_type,
          category: data.category,
          contact_person: data.contact_person,
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          gst_number: data.gst_number,
          pan_number: data.pan_number,
          payment_terms: data.payment_terms,
          credit_limit: data.credit_limit,
          lead_time_days: data.lead_time_days,
          material_categories: selectedMaterialCategories,
          performance_rating: data.performance_rating,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success("Vendor created successfully");
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error("Failed to create vendor: " + error.message);
    },
  });

  const onSubmit = async (data: VendorFormData) => {
    try {
      console.log('Form submission data:', data);
      console.log('Selected material categories:', selectedMaterialCategories);
      
      const submitData = {
        ...data,
        material_categories: selectedMaterialCategories
      };
      
      if (mode === 'edit' && initialData?.id) {
        console.log('Updating vendor:', initialData.id);
        await updateVendor.mutateAsync({ 
          vendorId: initialData.id, 
          data: submitData
        });
        onSuccess?.();
      } else {
        console.log('Creating new vendor');
        await createVendorMutation.mutateAsync(submitData);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error(`Failed to ${mode === 'edit' ? 'update' : 'create'} vendor: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleMaterialCategoryToggle = (category: string) => {
    const newCategories = selectedMaterialCategories.includes(category)
      ? selectedMaterialCategories.filter(c => c !== category)
      : [...selectedMaterialCategories, category];
    
    setSelectedMaterialCategories(newCategories);
    setValue('material_categories', newCategories, { shouldValidate: true });
  };


  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Basic Information
          </CardTitle>
          <CardDescription>
            Essential vendor details and classification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier_name">Supplier Name *</Label>
              <Input
                id="supplier_name"
                {...register("supplier_name")}
                placeholder="Enter supplier name"
              />
              {errors.supplier_name && (
                <p className="text-sm text-destructive mt-1">{errors.supplier_name.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="supplier_code">Supplier Code</Label>
              <Input
                id="supplier_code"
                value={initialData?.supplier_code || "Auto-generated on save"}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {mode === 'edit' ? 'Supplier code cannot be changed' : 'Code will be generated automatically'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier_type">Supplier Type *</Label>
              <Select 
                value={initialData?.supplier_type || watch('supplier_type')} 
                onValueChange={(value) => setValue("supplier_type", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier type" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.supplier_type && (
                <p className="text-sm text-destructive mt-1">{errors.supplier_type.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select 
                value={initialData?.category || watch('category')} 
                onValueChange={(value) => setValue("category", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      <div className="flex flex-col">
                        <span>{category.label}</span>
                        <span className="text-xs text-muted-foreground">{category.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-destructive mt-1">{errors.category.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                {...register("contact_person")}
                placeholder="John Doe"
              />
            </div>
            
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="contact@supplier.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                {...register("phone")}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              {...register("address")}
              placeholder="Complete business address"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                {...register("city")}
                placeholder="Mumbai"
              />
            </div>
            
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                {...register("state")}
                placeholder="Maharashtra"
              />
            </div>
            
            <div>
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                {...register("pincode")}
                placeholder="400001"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Business Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="gst_number">GSTIN</Label>
              <Input
                id="gst_number"
                {...register("gst_number")}
                placeholder="27AAACH7409R1ZZ"
              />
            </div>
            
            <div>
              <Label htmlFor="pan_number">PAN</Label>
              <Input
                id="pan_number"
                {...register("pan_number")}
                placeholder="AAACH7409R"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Input
                id="payment_terms"
                {...register("payment_terms")}
                placeholder="Net 30 days"
              />
            </div>
            
            <div>
              <Label htmlFor="credit_limit">Credit Limit (₹)</Label>
              <Input
                id="credit_limit"
                type="number"
                {...register("credit_limit", { valueAsNumber: true })}
                placeholder="500000"
              />
            </div>
            
            <div>
              <Label htmlFor="lead_time_days">Lead Time (Days) *</Label>
              <Input
                id="lead_time_days"
                type="number"
                {...register("lead_time_days", { valueAsNumber: true })}
                placeholder="7"
              />
              {errors.lead_time_days && (
                <p className="text-sm text-destructive mt-1">{errors.lead_time_days.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Material Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Material Categories *
          </CardTitle>
          <CardDescription>
            Select the material categories this vendor specializes in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {MATERIAL_CATEGORIES.map((category) => (
              <div key={category} className="flex items-center space-x-2">
                <Checkbox
                  id={category}
                  checked={selectedMaterialCategories.includes(category)}
                  onCheckedChange={() => handleMaterialCategoryToggle(category)}
                />
                <Label
                  htmlFor={category}
                  className="text-sm font-normal cursor-pointer"
                >
                  {category}
                </Label>
              </div>
            ))}
          </div>
          {errors.material_categories && (
            <p className="text-sm text-destructive mt-2">{errors.material_categories.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Performance Rating
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="performance_rating">
              Performance Rating: {watch('performance_rating') || 75}%
            </Label>
            <Input
              id="performance_rating"
              type="range"
              min="0"
              max="100"
              step="5"
              {...register("performance_rating", { valueAsNumber: true })}
              className="mt-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end space-x-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button 
          type="submit" 
          disabled={mode === 'edit' ? updateVendor.isPending : createVendorMutation.isPending}
          className="min-w-[120px]"
        >
          {mode === 'edit' 
            ? (updateVendor.isPending ? "Updating..." : "Update Vendor")
            : (createVendorMutation.isPending ? "Creating..." : "Create Vendor")
          }
        </Button>
      </div>
    </form>
  );
}
