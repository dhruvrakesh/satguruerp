import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateOrder } from "@/hooks/useManufacturingOrders";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, Package, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const orderSchema = z.object({
  customer_name: z.string().min(1, "Customer name is required"),
  product_description: z.string().min(1, "Product description is required"),
  order_quantity: z.number().min(1, "Quantity must be at least 1"),
  substrate_type: z.string().min(1, "Substrate selection is required"),
  priority_level: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  delivery_date: z.string().optional(),
  special_instructions: z.string().optional(),
  specifications: z.object({
    width_mm: z.number().optional(),
    colors: z.number().optional(),
    finish: z.string().optional(),
  }).optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

interface Substrate {
  id: string;
  substrate_name: string;
  substrate_type: string;
  width_mm: number;
  supplier: string;
}

export function EnhancedOrderCreationDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const { mutate: createOrder, isPending } = useCreateOrder();
  const { toast } = useToast();

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_name: "",
      product_description: "",
      order_quantity: 1,
      substrate_type: "",
      priority_level: "NORMAL",
      delivery_date: "",
      special_instructions: "",
      specifications: {
        width_mm: 1000,
        colors: 4,
        finish: "GLOSSY",
      },
    },
  });

  // Fetch substrates
  const { data: substrates = [] } = useQuery({
    queryKey: ["substrates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("substrate_catalog")
        .select("id, substrate_name, substrate_type, width_mm, supplier")
        .eq("is_active", true)
        .order("substrate_name");
      if (error) throw error;
      return data as Substrate[];
    },
  });

  const onSubmit = async (data: OrderFormData) => {
    createOrder(
      {
        customer_name: data.customer_name,
        product_description: data.product_description,
        order_quantity: data.order_quantity,
        priority_level: data.priority_level,
        delivery_date: data.delivery_date,
        special_instructions: data.special_instructions,
        order_date: new Date().toISOString().split('T')[0],
        status: "PENDING",
      },
      {
        onSuccess: () => {
          toast({
            title: "Success",
            description: "Order created successfully",
          });
          setIsOpen(false);
          setCurrentStep(1);
          form.reset();
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: "Failed to create order: " + error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const selectedSubstrate = substrates.find(
    (s) => s.substrate_name === form.watch("substrate_type")
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Enhanced Order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Manufacturing Order</DialogTitle>
          <DialogDescription>
            Step {currentStep} of 3: {currentStep === 1 ? "Basic Information" : currentStep === 2 ? "Technical Specifications" : "Review & Submit"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex mb-6">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`flex-1 h-2 rounded-full mx-1 ${
                step <= currentStep ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {currentStep === 1 && (
              <div className="space-y-4">
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
                        <FormLabel>Priority Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="LOW">
                              <Badge variant="secondary">Low</Badge>
                            </SelectItem>
                            <SelectItem value="NORMAL">
                              <Badge variant="outline">Normal</Badge>
                            </SelectItem>
                            <SelectItem value="HIGH">
                              <Badge variant="default">High</Badge>
                            </SelectItem>
                            <SelectItem value="URGENT">
                              <Badge variant="destructive">Urgent</Badge>
                            </SelectItem>
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
                        <Textarea
                          placeholder="Detailed product description"
                          className="h-20"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="order_quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity (Meters)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1000"
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
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Substrate Selection
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="substrate_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Substrate Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select substrate" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {substrates.map((substrate) => (
                                <SelectItem key={substrate.id} value={substrate.substrate_name}>
                                  <div className="flex items-center justify-between w-full">
                                    <span>{substrate.substrate_name}</span>
                                    <Badge variant="outline" className="ml-2">
                                      {substrate.width_mm}mm
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedSubstrate && (
                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <h4 className="font-medium mb-2">Substrate Details</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>Type: {selectedSubstrate.substrate_type}</div>
                          <div>Width: {selectedSubstrate.width_mm}mm</div>
                          <div>Supplier: {selectedSubstrate.supplier}</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Technical Specifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="specifications.width_mm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Width (mm)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="1000"
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
                        name="specifications.colors"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Colors</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="4"
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
                        name="specifications.finish"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Finish</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select finish" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="MATTE">Matte</SelectItem>
                                <SelectItem value="GLOSSY">Glossy</SelectItem>
                                <SelectItem value="SATIN">Satin</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <strong>Customer:</strong> {form.getValues("customer_name")}
                      </div>
                      <div>
                        <strong>Priority:</strong>{" "}
                        <Badge
                          variant={
                            form.getValues("priority_level") === "URGENT"
                              ? "destructive"
                              : form.getValues("priority_level") === "HIGH"
                              ? "default"
                              : "outline"
                          }
                        >
                          {form.getValues("priority_level")}
                        </Badge>
                      </div>
                      <div>
                        <strong>Quantity:</strong> {form.getValues("order_quantity")} meters
                      </div>
                      <div>
                        <strong>Substrate:</strong> {form.getValues("substrate_type")}
                      </div>
                    </div>
                    <div>
                      <strong>Product:</strong> {form.getValues("product_description")}
                    </div>
                  </CardContent>
                </Card>

                <FormField
                  control={form.control}
                  name="special_instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Instructions (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any special requirements or notes..."
                          className="h-20"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="flex justify-between pt-6 border-t">
              <div className="flex gap-2">
                {currentStep > 1 && (
                  <Button type="button" variant="outline" onClick={prevStep}>
                    Previous
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {currentStep < 3 ? (
                  <Button type="button" onClick={nextStep}>
                    Next
                  </Button>
                ) : (
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Creating..." : "Create Order"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsOpen(false);
                    setCurrentStep(1);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}