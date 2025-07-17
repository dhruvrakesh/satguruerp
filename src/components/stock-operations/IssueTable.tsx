import { useState } from "react";
import { format } from "date-fns";
import { MoreHorizontal, Search, Edit, Trash2, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useStockIssues, useStockIssueMutations, StockIssueSort, StockIssueFilters } from "@/hooks/useStockIssues";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

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

interface IssueTableProps {
  onEdit?: (issue: any) => void;
}

export function IssueTable({ onEdit }: IssueTableProps) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<StockIssueSort>({ column: 'created_at', direction: 'desc' });
  const [filters, setFilters] = useState<StockIssueFilters>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useStockIssues({ page, pageSize: 50, filters, sort });
  const { updateIssue, deleteIssue } = useStockIssueMutations();

  const handleSort = (column: string) => {
    setSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleEdit = (id: string, currentValues: any) => {
    setEditingId(id);
    setEditValues(currentValues);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateIssue.mutateAsync({ id, updates: editValues });
      setEditingId(null);
      setEditValues({});
    } catch (error) {
      console.error("Failed to update issue:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteIssue.mutateAsync(id);
      setDeleteId(null);
    } catch (error) {
      console.error("Failed to delete issue:", error);
    }
  };

  const getIssueTypeColor = (qty: number) => {
    if (qty > 100) return "destructive";
    if (qty > 50) return "secondary";
    return "default";
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
    type = "text",
    options
  }: { 
    id: string; 
    field: string; 
    value: any; 
    type?: string;
    options?: string[];
  }) => {
    if (editingId === id) {
      if (options) {
        return (
          <Select
            value={editValues[field] ?? value}
            onValueChange={(newValue) => setEditValues(prev => ({ ...prev, [field]: newValue }))}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      
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
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search item code or purpose..."
            value={filters.search || ""}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="pl-10"
          />
        </div>
        <Select
          value={filters.purpose || ""}
          onValueChange={(value) => setFilters(prev => ({ ...prev, purpose: value || undefined }))}
        >
          <SelectTrigger className="w-auto">
            <SelectValue placeholder="All purposes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All purposes</SelectItem>
            {PURPOSE_OPTIONS.map((purpose) => (
              <SelectItem key={purpose} value={purpose}>
                {purpose}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <SortableHeader column="date">Date</SortableHeader>
              <SortableHeader column="item_code">Item Code</SortableHeader>
              <TableHead>Item Name</TableHead>
              <SortableHeader column="qty_issued">Qty Issued</SortableHeader>
              <TableHead>Impact</TableHead>
              <SortableHeader column="purpose">Purpose</SortableHeader>
              <SortableHeader column="total_issued_qty">Total Issued</SortableHeader>
              <TableHead>Remarks</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.data.map((issue) => (
              <TableRow key={issue.id}>
                <TableCell>
                  {editingId === issue.id ? (
                    <Input
                      type="date"
                      value={editValues.date ?? issue.date}
                      onChange={(e) => setEditValues(prev => ({ ...prev, date: e.target.value }))}
                      className="h-8"
                    />
                  ) : (
                    format(new Date(issue.date), "dd/MM/yyyy")
                  )}
                </TableCell>
                <TableCell className="font-medium">{issue.item_code}</TableCell>
                <TableCell>{issue.satguru_item_master?.item_name || "-"}</TableCell>
                <TableCell>
                  <EditableCell
                    id={issue.id}
                    field="qty_issued"
                    value={issue.qty_issued}
                    type="number"
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={getIssueTypeColor(issue.qty_issued)}>
                    {issue.qty_issued > 100 ? "Large" : issue.qty_issued > 50 ? "Medium" : "Small"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <EditableCell
                    id={issue.id}
                    field="purpose"
                    value={issue.purpose || "-"}
                    options={PURPOSE_OPTIONS}
                  />
                </TableCell>
                <TableCell>
                  <EditableCell
                    id={issue.id}
                    field="total_issued_qty"
                    value={issue.total_issued_qty || "-"}
                    type="number"
                  />
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  <EditableCell
                    id={issue.id}
                    field="remarks"
                    value={issue.remarks || "-"}
                  />
                </TableCell>
                <TableCell>
                  {editingId === issue.id ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(issue.id)}
                        disabled={updateIssue.isPending}
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
                        <DropdownMenuItem onClick={() => handleEdit(issue.id, issue)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeleteId(issue.id)}
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
        title="Delete Stock Issue"
        description="Are you sure you want to delete this stock issue? This action cannot be undone and will affect stock levels."
        onConfirm={() => deleteId && handleDelete(deleteId)}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}