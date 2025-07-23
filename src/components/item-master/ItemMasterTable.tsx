
import { useState, useCallback, useMemo } from "react";
import { useItemMaster, useItemMasterMutations } from "@/hooks/useItemMaster";
import { ItemMasterFilters } from "./ItemMasterFilters";
import { ItemMasterForm } from "./ItemMasterForm";
import { SafeDataReplacement } from "./SafeDataReplacement";
import { useItemMasterExport } from "@/hooks/useItemMasterExport";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Edit, Plus, Upload, Download, ExternalLink, Database } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { ItemMasterUpsert } from "./ItemMasterUpsert";

interface ItemMasterTableProps {
  onBulkUpload: () => void;
}

export function ItemMasterTable({ onBulkUpload }: ItemMasterTableProps) {
  const { toast } = useToast();
  const { exportItemMasterToCSV } = useItemMasterExport();
  
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [filters, setFilters] = useState({
    search: '',
    category_id: 'all',
    status: 'all',
    uom: 'all',
    usage_type: 'all'
  });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Memoize filters to prevent unnecessary re-renders
  const memoizedFilters = useMemo(() => {
    console.log('Memoizing filters:', filters);
    return filters;
  }, [filters.search, filters.category_id, filters.status, filters.uom, filters.usage_type]);

  const { data: itemMasterData, isLoading, error } = useItemMaster({
    page,
    pageSize,
    filters: memoizedFilters
  });

  const { deleteItem, deleteMultipleItems } = useItemMasterMutations();

  // Memoize the filters change handler to prevent infinite re-renders
  const handleFiltersChange = useCallback((newFilters: any) => {
    console.log('Filters changed:', newFilters);
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  }, []);

  const handleDelete = (id: string) => {
    setItemToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteItem.mutate(itemToDelete);
      setItemToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedItems.length > 0) {
      deleteMultipleItems.mutate(selectedItems);
      setSelectedItems([]);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(itemMasterData?.data.map(item => item.id) || []);
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, itemId]);
    } else {
      setSelectedItems(prev => prev.filter(id => id !== itemId));
    }
  };

  const handleExport = () => {
    try {
      exportItemMasterToCSV(memoizedFilters);
      toast({
        title: "Export Started",
        description: "Item master data export has been initiated.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export item master data. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Show error toast if there's an error loading data
  if (error) {
    console.error('Item master loading error:', error);
    toast({
      title: "Error",
      description: "Failed to load item master data. Please refresh the page.",
      variant: "destructive",
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Item Master Management
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.open('/specification-master', '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Specification Master
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={onBulkUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Bulk Upload
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Smart Update
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Smart Item Master Update/Insert</DialogTitle>
                  </DialogHeader>
                  <ItemMasterUpsert />
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Database className="h-4 w-4 mr-2" />
                    Replace Data
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Safe Data Replacement</DialogTitle>
                  </DialogHeader>
                  <SafeDataReplacement />
                </DialogContent>
              </Dialog>
              {selectedItems.length > 0 && (
                <Button variant="destructive" onClick={handleBulkDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedItems.length})
                </Button>
              )}
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Item</DialogTitle>
                  </DialogHeader>
                  <ItemMasterForm />
                </DialogContent>
              </Dialog>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ItemMasterFilters filters={filters} onFiltersChange={handleFiltersChange} />
          
          <div className="rounded-md border mt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedItems.length === itemMasterData?.data.length && itemMasterData?.data.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Usage Type</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : itemMasterData?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4">
                      No items found
                    </TableCell>
                  </TableRow>
                ) : (
                  itemMasterData?.data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.item_code}</TableCell>
                      <TableCell>{item.item_name}</TableCell>
                      <TableCell>
                        {item.satguru_categories?.category_name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.usage_type}</Badge>
                      </TableCell>
                      <TableCell>{item.uom || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingItem(item)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Edit Item</DialogTitle>
                              </DialogHeader>
                              <ItemMasterForm item={editingItem} />
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {itemMasterData && itemMasterData.totalPages > 1 && (
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, itemMasterData.count)} of {itemMasterData.count} items
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= itemMasterData.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Item"
        description="Are you sure you want to delete this item? This action cannot be undone."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
