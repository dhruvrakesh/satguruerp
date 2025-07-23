import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Save, X, Upload, Download, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { useItemPricing, useUpdateItemPrice, useAddItemPrice } from "@/hooks/useItemPricing";
import { useCostCategories } from "@/hooks/useCostCategories";
import { useCategories } from "@/hooks/useCategories";
import { ItemPricingCSVUpload } from "./ItemPricingCSVUpload";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLogging } from "@/hooks/useAuditLogging";
import { useRoleBasedAccess } from "@/hooks/useRoleBasedAccess";
import { useValuationManagement } from "@/hooks/useValuationManagement";
import { useValuationItemCodeGeneration } from "@/hooks/useValuationItemCodeGeneration";
import { format } from "date-fns";

export function EnhancedItemPricingMaster() {
  // Existing state
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCostCategory, setSelectedCostCategory] = useState("all");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showNewItemDialog, setShowNewItemDialog] = useState(false);
  
  // Enhanced new item form state
  const [newItemData, setNewItemData] = useState({
    itemCode: '',
    itemName: '',
    categoryName: '',
    usageType: 'RAW_MATERIAL',
    qualifier: '',
    sizeGsm: { size: '', gsm: '' },
    currentPrice: '',
    effectiveDate: format(new Date(), "yyyy-MM-dd"),
    costCategory: "",
    supplier: "",
    priceChangeReason: ""
  });

  // Hooks
  const { permissions, checkPermission } = useRoleBasedAccess();
  const { logPriceChange, logBulkPriceImport, logPriceExport } = useAuditLogging();
  const { 
    processBulkPriceUpdate, 
    addItemPrice, 
    exportPricingData 
  } = useValuationManagement();
  const {
    generatedCode,
    isValidating,
    isUnique,
    generateCode,
    validateManualCode,
    isGenerating
  } = useValuationItemCodeGeneration();

  // Existing hooks
  const { data: pricingEntries = [], isLoading, error, refetch } = useItemPricing({
    category: selectedCategory,
    costCategory: selectedCostCategory,
    search: searchTerm
  });
  
  const { costCategories = [] } = useCostCategories();
  const { data: categories = [] } = useCategories();
  const updatePriceMutation = useUpdateItemPrice();

  // Auto-generate item code when category or other params change
  useEffect(() => {
    if (newItemData.categoryName && newItemData.categoryName !== '') {
      generateCode({
        categoryName: newItemData.categoryName,
        usageType: newItemData.usageType,
        qualifier: newItemData.qualifier || undefined,
        size: newItemData.sizeGsm.size ? parseFloat(newItemData.sizeGsm.size) : undefined,
        gsm: newItemData.sizeGsm.gsm ? parseFloat(newItemData.sizeGsm.gsm) : undefined
      });
    }
  }, [
    newItemData.categoryName, 
    newItemData.usageType, 
    newItemData.qualifier, 
    newItemData.sizeGsm.size, 
    newItemData.sizeGsm.gsm,
    generateCode
  ]);

  const handlePriceUpdate = async (itemCode: string) => {
    if (!checkPermission('canEditPricing')) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to edit prices",
        variant: "destructive",
      });
      return;
    }

    if (!newPrice || parseFloat(newPrice) <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price greater than 0",
        variant: "destructive",
      });
      return;
    }

    const oldPrice = pricingEntries.find(entry => entry.item_code === itemCode)?.current_price || 0;

    updatePriceMutation.mutate({
      itemCode,
      newPrice: parseFloat(newPrice),
      reason: "Manual price update"
    }, {
      onSuccess: async () => {
        await logPriceChange(itemCode, oldPrice, parseFloat(newPrice), "Manual price update");
        setEditingItem(null);
        setNewPrice("");
      }
    });
  };

  const handleImportPrices = async (csvData: any[]) => {
    if (!checkPermission('canBulkImport')) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to import data",
        variant: "destructive",
      });
      return;
    }

    console.log('Importing prices:', csvData);
    
    // Transform CSV data to expected format
    const transformedData = csvData.map(row => ({
      item_code: row.item_code || row.ItemCode || row['Item Code'],
      new_price: parseFloat(row.new_price || row.NewPrice || row['New Price'] || row.price || row.Price),
      reason: row.reason || row.Reason || 'Bulk import',
      effective_date: row.effective_date || row.EffectiveDate || row['Effective Date']
    })).filter(item => item.item_code && !isNaN(item.new_price));

    if (transformedData.length === 0) {
      toast({
        title: "Import Failed",
        description: "No valid price data found in CSV",
        variant: "destructive",
      });
      return;
    }

    try {
      await processBulkPriceUpdate.mutateAsync(transformedData);
      await logBulkPriceImport({ recordCount: transformedData.length });
      setShowBulkUpload(false);
      refetch(); // Refresh the data
    } catch (error) {
      console.error('Import failed:', error);
    }
  };

  const handleExportPrices = async () => {
    if (!checkPermission('canExportData')) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to export data",
        variant: "destructive",
      });
      return;
    }

    try {
      await exportPricingData.mutateAsync({
        valuation_method: 'WEIGHTED_AVG',
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        item_code: searchTerm || undefined
      });
      
      await logPriceExport({ 
        category: selectedCategory, 
        costCategory: selectedCostCategory, 
        searchTerm 
      }, pricingEntries.length);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleAddItemPrice = async () => {
    if (!checkPermission('canEditPricing')) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to add new prices",
        variant: "destructive",
      });
      return;
    }

    const price = parseFloat(newItemData.currentPrice);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price greater than 0",
        variant: "destructive",
      });
      return;
    }

    const itemCode = generatedCode || newItemData.itemCode;
    if (!itemCode) {
      toast({
        title: "Missing Item Code",
        description: "Please generate or enter a valid item code",
        variant: "destructive",
      });
      return;
    }

    try {
      // Use the new valuation system for adding prices
      await addItemPrice.mutateAsync({
        item_code: itemCode,
        new_price: price,
        change_reason: newItemData.priceChangeReason || 'New item pricing',
        effective_date: newItemData.effectiveDate
      });
      
      await logPriceChange(itemCode, 0, price, 'New item pricing');
      
      // Reset form
      setNewItemData({
        itemCode: '',
        itemName: '',
        categoryName: '',
        usageType: 'RAW_MATERIAL',
        qualifier: '',
        sizeGsm: { size: '', gsm: '' },
        currentPrice: '',
        effectiveDate: format(new Date(), "yyyy-MM-dd"),
        costCategory: "",
        supplier: "",
        priceChangeReason: ""
      });
      setShowNewItemDialog(false);
      refetch(); // Refresh the data
    } catch (error) {
      console.error('Failed to add item price:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Error loading pricing data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Enhanced Item Pricing Master</h2>
          <p className="text-muted-foreground">Manage item prices with enterprise-grade features</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          {checkPermission('canBulkImport') && (
            <Button 
              variant="outline" 
              onClick={() => setShowBulkUpload(!showBulkUpload)}
              disabled={processBulkPriceUpdate.isPending}
            >
              <Upload className="w-4 h-4 mr-2" />
              {processBulkPriceUpdate.isPending ? 'Importing...' : 'Import Prices'}
            </Button>
          )}
          
          {checkPermission('canExportData') && (
            <Button 
              variant="outline" 
              onClick={handleExportPrices}
              disabled={exportPricingData.isPending}
            >
              <Download className="w-4 h-4 mr-2" />
              {exportPricingData.isPending ? 'Exporting...' : 'Export Prices'}
            </Button>
          )}
          
          {checkPermission('canEditPricing') && (
            <Dialog open={showNewItemDialog} onOpenChange={setShowNewItemDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item Price
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Item Price</DialogTitle>
                  <DialogDescription>
                    Create a new item with enhanced code generation and pricing
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-96 overflow-y-auto">
                  {/* Item Code Generation Section */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h4 className="font-medium">Item Code Generation</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="categoryName">Category Name *</Label>
                        <Select 
                          value={newItemData.categoryName}
                          onValueChange={(value) => setNewItemData(prev => ({ ...prev, categoryName: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.category_name}>
                                {category.category_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="usageType">Usage Type</Label>
                        <Select 
                          value={newItemData.usageType}
                          onValueChange={(value) => setNewItemData(prev => ({ ...prev, usageType: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="RAW_MATERIAL">Raw Material</SelectItem>
                            <SelectItem value="FINISHED_GOOD">Finished Good</SelectItem>
                            <SelectItem value="WIP">Work in Progress</SelectItem>
                            <SelectItem value="PACKAGING">Packaging</SelectItem>
                            <SelectItem value="CONSUMABLE">Consumable</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="qualifier">Qualifier</Label>
                        <Input 
                          id="qualifier"
                          placeholder="e.g., MILKY, CLEAR"
                          value={newItemData.qualifier}
                          onChange={(e) => setNewItemData(prev => ({ ...prev, qualifier: e.target.value }))}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="size">Size (mm)</Label>
                        <Input 
                          id="size"
                          type="number"
                          placeholder="680"
                          value={newItemData.sizeGsm.size}
                          onChange={(e) => setNewItemData(prev => ({ 
                            ...prev, 
                            sizeGsm: { ...prev.sizeGsm, size: e.target.value }
                          }))}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="gsm">GSM</Label>
                        <Input 
                          id="gsm"
                          type="number"
                          placeholder="75"
                          value={newItemData.sizeGsm.gsm}
                          onChange={(e) => setNewItemData(prev => ({ 
                            ...prev, 
                            sizeGsm: { ...prev.sizeGsm, gsm: e.target.value }
                          }))}
                        />
                      </div>
                    </div>

                    {/* Generated Code Display */}
                    <div>
                      <Label>Generated Item Code</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          value={generatedCode || newItemData.itemCode}
                          onChange={(e) => {
                            setNewItemData(prev => ({ ...prev, itemCode: e.target.value }));
                            validateManualCode(e.target.value);
                          }}
                          placeholder="Item code will be generated"
                          className={`font-mono ${
                            isUnique === false ? 'border-destructive' : 
                            isUnique === true ? 'border-success' : ''
                          }`}
                        />
                        {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isValidating && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isUnique === true && (
                          <Badge variant="outline" className="text-green-600">Unique</Badge>
                        )}
                        {isUnique === false && (
                          <Badge variant="destructive">Exists</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pricing Information */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h4 className="font-medium">Pricing Information</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="currentPrice">Current Price *</Label>
                        <Input 
                          id="currentPrice"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={newItemData.currentPrice}
                          onChange={(e) => setNewItemData(prev => ({ ...prev, currentPrice: e.target.value }))}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="effectiveDate">Effective Date</Label>
                        <Input 
                          id="effectiveDate"
                          type="date"
                          value={newItemData.effectiveDate}
                          onChange={(e) => setNewItemData(prev => ({ ...prev, effectiveDate: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="costCategory">Cost Category</Label>
                        <Select 
                          value={newItemData.costCategory}
                          onValueChange={(value) => setNewItemData(prev => ({ ...prev, costCategory: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select cost category" />
                          </SelectTrigger>
                          <SelectContent>
                            {costCategories.map((category) => (
                              <SelectItem key={category.id} value={category.category_name}>
                                {category.category_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="supplier">Supplier</Label>
                        <Input 
                          id="supplier"
                          placeholder="Supplier code"
                          value={newItemData.supplier}
                          onChange={(e) => setNewItemData(prev => ({ ...prev, supplier: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="reason">Reason for Pricing</Label>
                      <Input 
                        id="reason"
                        placeholder="New item pricing"
                        value={newItemData.priceChangeReason}
                        onChange={(e) => setNewItemData(prev => ({ ...prev, priceChangeReason: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button 
                    onClick={handleAddItemPrice}
                    disabled={
                      !newItemData.currentPrice || 
                      (!generatedCode && !newItemData.itemCode) ||
                      addItemPrice.isPending ||
                      isUnique === false
                    }
                    className="w-full"
                  >
                    {addItemPrice.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding Price...
                      </>
                    ) : (
                      'Add Item Price'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Bulk Upload Section */}
      {showBulkUpload && (
        <Card>
          <CardHeader>
            <CardTitle>Bulk Price Import</CardTitle>
            <CardDescription>
              Upload CSV file with item codes and prices for bulk processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ItemPricingCSVUpload 
              onUploadComplete={() => {
                // Refresh data after upload
                window.location.reload();
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Search Items</Label>
              <Input 
                placeholder="Search by code or name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.category_name}>
                      {category.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cost Category</Label>
              <Select value={selectedCostCategory} onValueChange={setSelectedCostCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cost Categories</SelectItem>
                  {costCategories.map((category) => (
                    <SelectItem key={category.id} value={category.category_name}>
                      {category.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setSelectedCategory("all");
                  setSelectedCostCategory("all");
                  setSearchTerm("");
                }}
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Table */}
      <Card>
        <CardHeader>
          <CardTitle>Current Pricing Data</CardTitle>
          <CardDescription>
            Enhanced pricing management with enterprise-grade features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead>Current Price</TableHead>
                <TableHead>Previous Price</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Cost Category</TableHead>
                <TableHead>Approval Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricingEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No pricing data available. Add some items to get started.
                  </TableCell>
                </TableRow>
              ) : (
                pricingEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-sm">{entry.item_code}</TableCell>
                    <TableCell>{entry.item_name}</TableCell>
                    <TableCell>{entry.category}</TableCell>
                    <TableCell>{entry.uom}</TableCell>
                    <TableCell>
                      {editingItem === entry.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value)}
                            className="w-24"
                            placeholder={entry.current_price.toString()}
                          />
                          <Button
                            size="sm"
                            onClick={() => handlePriceUpdate(entry.item_code)}
                            disabled={updatePriceMutation.isPending}
                          >
                            {updatePriceMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingItem(null);
                              setNewPrice("");
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span>₹{entry.current_price.toFixed(2)}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>₹{(entry.previous_price || 0).toFixed(2)}</TableCell>
                    <TableCell>{entry.effective_date}</TableCell>
                    <TableCell>{entry.cost_category}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          entry.approval_status === 'APPROVED' ? 'default' :
                          entry.approval_status === 'PENDING' ? 'secondary' :
                          'destructive'
                        }
                      >
                        {entry.approval_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {editingItem !== entry.id && checkPermission('canEditPricing') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingItem(entry.id);
                            setNewPrice(entry.current_price.toString());
                          }}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
