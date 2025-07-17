import { useState } from "react";
import { format } from "date-fns";
import { MoreHorizontal, Search, Filter, Edit, Trash2, ChevronUp, ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGRN, useGRNMutations, GRNSort, GRNFilters } from "@/hooks/useGRN";
import { useGRNExport } from "@/hooks/useDataExport";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { toast } from "@/hooks/use-toast";

interface GRNRecord {
  id: string;
  grn_number: string;
  date: string;
  item_code: string;
  qty_received: number;
  vendor?: string;
  amount_inr?: number;
  remarks?: string;
}

interface GRNTableProps {
  onEdit?: (grn: GRNRecord) => void;
}

export function GRNTable({ onEdit }: GRNTableProps) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<GRNSort>({ column: 'created_at', direction: 'desc' });
  const [filters, setFilters] = useState<GRNFilters>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useGRN({ page, pageSize: 50, filters, sort });
  const { updateGRN, deleteGRN } = useGRNMutations();
  const exportGRN = useGRNExport();

  const handleSort = (column: string) => {
    setSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleEdit = (id: string, currentValues: GRNRecord) => {
    setEditingId(id);
    setEditValues(currentValues);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateGRN.mutateAsync({ id, updates: editValues });
      setEditingId(null);
      setEditValues({});
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update GRN",
        variant: "destructive" 
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGRN.mutateAsync(id);
      setDeleteId(null);
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete GRN",
        variant: "destructive" 
      });
    }
  };

  const SortableHeader = ({ column, children }: { column: string; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sort.column === column && (
          sort.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
        )}
      </div>
    </TableHead>
  );

  const EditableCell = ({ 
    id, 
    field, 
    value, 
    type = "text" 
  }: { 
    id: string; 
    field: string; 
    value: string | number; 
    type?: string;
  }) => {
    if (editingId === id) {
      return (
        <Input
          type={type}
          value={editValues[field] ?? value}
          onChange={(e) => setEditValues(prev => ({
            ...prev,
            [field]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value
          }))}
          className="h-8"
        />
      );
    }
    
    return <span>{value}</span>;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Export */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {data?.count || 0} total records
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportGRN.mutate(filters)}
          disabled={exportGRN.isPending}
        >
          <Download className="w-4 h-4 mr-2" />
          {exportGRN.isPending ? "Exporting..." : "Export to Excel"}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search GRN number, item code, or supplier..."
            value={filters.search || ""}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="pl-10"
          />
        </div>
        <Input
          type="date"
          placeholder="From date"
          value={filters.dateFrom || ""}
          onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
          className="w-auto"
        />
        <Input
          type="date"
          placeholder="To date"
          value={filters.dateTo || ""}
          onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
          className="w-auto"
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader column="grn_number">GRN Number</SortableHeader>
              <SortableHeader column="grn_date">Date</SortableHeader>
              <SortableHeader column="item_code">Item Code</SortableHeader>
              <TableHead>Item Name</TableHead>
              <SortableHeader column="qty_received">Qty Received</SortableHeader>
              <SortableHeader column="unit_price">Unit Price</SortableHeader>
              <SortableHeader column="total_value">Total Value</SortableHeader>
              <SortableHeader column="supplier">Supplier</SortableHeader>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.data.map((grn) => (
              <TableRow key={grn.id}>
                <TableCell className="font-medium">{grn.grn_number}</TableCell>
                <TableCell>
                  {editingId === grn.id ? (
                    <Input
                      type="date"
                      value={editValues.date ?? grn.date}
                      onChange={(e) => setEditValues(prev => ({ ...prev, date: e.target.value }))}
                      className="h-8"
                    />
                  ) : (
                    format(new Date(grn.date), "dd/MM/yyyy")
                  )}
                </TableCell>
                <TableCell>{grn.item_code}</TableCell>
                <TableCell>{grn.satguru_item_master?.item_name || "-"}</TableCell>
                <TableCell>
                  <EditableCell
                    id={grn.id}
                    field="qty_received"
                    value={grn.qty_received}
                    type="number"
                  />
                </TableCell>
                <TableCell>-</TableCell>
                <TableCell>
                  <EditableCell
                    id={grn.id}
                    field="amount_inr"
                    value={grn.amount_inr || "-"}
                    type="number"
                  />
                </TableCell>
                <TableCell>
                  <EditableCell
                    id={grn.id}
                    field="vendor"
                    value={grn.vendor || "-"}
                  />
                </TableCell>
                <TableCell>
                  {editingId === grn.id ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(grn.id)}
                        disabled={updateGRN.isPending}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(grn.id, grn)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeleteId(grn.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="px-3 py-2 text-sm">
            Page {page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete GRN"
        description="Are you sure you want to delete this GRN? This action cannot be undone and will affect stock levels."
        onConfirm={() => deleteId && handleDelete(deleteId)}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}