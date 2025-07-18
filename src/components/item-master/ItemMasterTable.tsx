
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Upload, ArrowUpDown } from "lucide-react";
import { useItemMaster, useItemMasterMutations, ItemMasterFilters, ItemMasterSort } from "@/hooks/useItemMaster";
import { ItemMasterForm } from "./ItemMasterForm";
import { ItemMasterFilters as FiltersComponent } from "./ItemMasterFilters";
import { ArtworkImportDialog } from "./ArtworkImportDialog";
import { LoadingSpinner } from "../ui/loading-spinner";
import { ConfirmationDialog } from "../ui/confirmation-dialog";

interface ItemMasterTableProps {
  onBulkUpload?: () => void;
}

interface ItemMasterItem {
  id: string;
  item_code: string;
  item_name: string;
  category_id: string;
  status: string;
  uom: string;
  qualifier?: string;
  gsm?: number;
  size_mm?: string;
  specifications?: any;
  customer_name?: string;
  dimensions?: string;
  no_of_colours?: string;
  usage_type?: string;
  categories?: {
    category_name: string;
  };
}

export function ItemMasterTable({ onBulkUpload }: ItemMasterTableProps) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ItemMasterFilters>({});
  const [sort, setSort] = useState<ItemMasterSort>({ column: 'created_at', direction: 'desc' });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<ItemMasterItem | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; item?: ItemMasterItem; multiple?: boolean }>({ open: false });

  const pageSize = 50;
  
  const { data, isLoading, error } = useItemMaster({ 
    page, 
    filters, 
    sort 
  });
  
  const { deleteItem, deleteMultipleItems } = useItemMasterMutations();

  const totalPages = data?.totalPages || 0;

  const handleFiltersChange = (newFilters: ItemMasterFilters) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  const handleSort = (column: string) => {
    setSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    setSelectedItems(prev => 
      checked 
        ? [...prev, itemId]
        : prev.filter(id => id !== itemId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedItems(checked ? data?.data?.map(item => item.id) || [] : []);
  };

  const handleDeleteSelected = () => {
    if (selectedItems.length > 0) {
      setDeleteConfirm({ open: true, multiple: true });
    }
  };

  const confirmDelete = () => {
    if (deleteConfirm.multiple) {
      deleteMultipleItems.mutate(selectedItems);
      setSelectedItems([]);
    } else if (deleteConfirm.item) {
      deleteItem.mutate(deleteConfirm.item.id);
    }
    setDeleteConfirm({ open: false });
  };

  if (error) {
    console.error('Error loading items:', error);
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <p>Error loading items: {error.message}</p>
              <Button 
                onClick={() => window.location.reload()} 
                className="mt-2"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Item Master</h2>
          <div className="flex items-center gap-4">
            <p className="text-muted-foreground">Manage your inventory catalog</p>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">
                {data?.data?.length || 0} items displayed
              </Badge>
              <Badge variant="default" className="text-xs">
                {data?.count || 0} total items
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <ArtworkImportDialog />
          <Button variant="outline" onClick={onBulkUpload}>
            <Upload className="w-4 h-4 mr-2" />
            Bulk Upload
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Add New Item</DialogTitle>
              </DialogHeader>
              <ItemMasterForm onSuccess={() => setIsAddDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filters */}
      <FiltersComponent 
        filters={filters}
        onFiltersChange={handleFiltersChange}
        isLoading={isLoading}
      />

      {/* Items Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Items ({data?.count || 0})</CardTitle>
            <div className="flex items-center gap-4">
              {selectedItems.length > 0 && (
                <Button variant="destructive" onClick={handleDeleteSelected} size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete {selectedItems.length}
                </Button>
              )}
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
              <span className="ml-2">Loading items...</span>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedItems.length === data?.data?.length && data?.data?.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer" 
                      onClick={() => handleSort('item_code')}
                    >
                      Item Code
                      <ArrowUpDown className="w-4 h-4 ml-1 inline" />
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer" 
                      onClick={() => handleSort('item_name')}
                    >
                      Item Name
                      <ArrowUpDown className="w-4 h-4 ml-1 inline" />
                    </TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Usage Type</TableHead>
                    <TableHead>GSM</TableHead>
                    <TableHead>Dimensions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.item_code}</TableCell>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell>{item.categories?.category_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.uom}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.usage_type === 'FINISHED_GOOD' ? 'default' : 'secondary'}>
                          {item.usage_type || 'RM'}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.gsm || item.size_mm || '-'}</TableCell>
                      <TableCell>{item.dimensions || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingItem(item)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteConfirm({ open: true, item })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {Math.min((page - 1) * pageSize + 1, data?.count || 0)} to {Math.min(page * pageSize, data?.count || 0)} of {data?.count || 0} items
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingItem && (
        <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Edit Item: {editingItem.item_name}</DialogTitle>
            </DialogHeader>
            <ItemMasterForm 
              item={editingItem} 
              onSuccess={() => setEditingItem(null)} 
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open })}
        title={deleteConfirm.multiple ? "Delete Selected Items" : "Delete Item"}
        description={
          deleteConfirm.multiple 
            ? `Are you sure you want to delete ${selectedItems.length} selected items? This action cannot be undone.`
            : `Are you sure you want to delete "${deleteConfirm.item?.item_name}"? This action cannot be undone.`
        }
        confirmText="Delete"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
