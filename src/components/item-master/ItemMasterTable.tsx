import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Filter, Edit, Trash2, Upload, Download, ArrowUpDown } from "lucide-react";
import { useItemMaster, useItemMasterMutations, ItemMasterFilters, ItemMasterSort } from "@/hooks/useItemMaster";
import { ItemMasterForm } from "./ItemMasterForm";
import { ArtworkImportDialog } from "./ArtworkImportDialog";
import { LoadingSpinner } from "../ui/loading-spinner";
import { ConfirmationDialog } from "../ui/confirmation-dialog";

interface ItemMasterTableProps {
  onBulkUpload?: () => void;
}

export function ItemMasterTable({ onBulkUpload }: ItemMasterTableProps) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ItemMasterFilters>({});
  const [sort, setSort] = useState<ItemMasterSort>({ column: 'created_at', direction: 'desc' });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<ItemMasterItem | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; item?: ItemMasterItem; multiple?: boolean }>({ open: false });
  const [usageTypeFilter, setUsageTypeFilter] = useState<string>("all");

interface ItemMasterItem {
  id: string;
  item_code: string;
  item_name: string;
  category_id: string;
  status: string;
  uom: string;
  gsm?: number;
  size_mm?: string;
  satguru_categories?: {
    category_name: string;
  };
}

  const { data, isLoading, error } = useItemMaster({ 
    page, 
    filters: { 
      ...filters, 
      search: searchQuery,
      usage_type: usageTypeFilter !== "all" ? usageTypeFilter : undefined
    }, 
    sort 
  });
  const { deleteItem, deleteMultipleItems } = useItemMasterMutations();

  const pageSize = 50;
  const totalPages = data?.totalPages || 0;

  const handleFilterChange = (key: keyof ItemMasterFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined }));
    setPage(1);
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

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div>Error loading items: {error.message}</div>;

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
              <Badge variant={data?.count === 128 ? "destructive" : "default"} className="text-xs">
                {data?.count || 0} total items
              </Badge>
              {data?.count === 128 && (
                <Badge variant="secondary" className="text-xs text-orange-600">
                  359 FG items ready to import
                </Badge>
              )}
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
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filters.status || "__ALL__"} onValueChange={(value) => handleFilterChange('status', value === "__ALL__" ? "" : value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.uom || "__ALL__"} onValueChange={(value) => handleFilterChange('uom', value === "__ALL__" ? "" : value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="UOM" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">All UOM</SelectItem>
                <SelectItem value="PCS">PCS</SelectItem>
                <SelectItem value="KG">KG</SelectItem>
                <SelectItem value="MTR">MTR</SelectItem>
                <SelectItem value="SQM">SQM</SelectItem>
                <SelectItem value="LTR">LTR</SelectItem>
                <SelectItem value="BOX">BOX</SelectItem>
                <SelectItem value="ROLL">ROLL</SelectItem>
              </SelectContent>
            </Select>

            <Select value={usageTypeFilter} onValueChange={setUsageTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Item Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="FG">🎨 Finished Goods (FG)</SelectItem>
                <SelectItem value="RM">📦 Raw Materials (RM)</SelectItem>
                <SelectItem value="WIP">⚙️ Work in Progress (WIP)</SelectItem>
              </SelectContent>
            </Select>

            {selectedItems.length > 0 && (
              <Button variant="destructive" onClick={handleDeleteSelected}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete {selectedItems.length}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Items ({data?.count || 0})</CardTitle>
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                <TableHead>GSM</TableHead>
                <TableHead>Size</TableHead>
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
                  <TableCell>{item.satguru_categories?.category_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.uom}</Badge>
                  </TableCell>
                  <TableCell>{item.gsm || '-'}</TableCell>
                  <TableCell>{item.size_mm || '-'}</TableCell>
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