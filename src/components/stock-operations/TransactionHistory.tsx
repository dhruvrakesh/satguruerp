
import { useState } from "react";
import { format } from "date-fns";
import { Search, ArrowUp, ArrowDown, Filter, Eye, EyeOff, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRecentTransactions } from "@/hooks/useRecentTransactions";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface Transaction {
  id: string;
  type: 'GRN' | 'ISSUE';
  date: string;
  item_code: string;
  quantity: number;
  reference?: string;
  purpose?: string;
  supplier?: string;
  amount?: number;
  created_at: string;
}

const ITEMS_PER_PAGE = 50;

export function TransactionHistory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [showAll, setShowAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);

  // Use the hook with proper parameters for database-level filtering
  const { recentGRN, recentIssues } = useRecentTransactions(
    showAll ? undefined : 100, // Default to 100 for performance, unlimited when showAll is true
    showAll,
    searchQuery,
    typeFilter,
    dateRange
  );

  // Combine and transform data with proper composite keys to prevent React key duplication
  const allTransactions: Transaction[] = [
    ...(recentGRN.data || []).map(grn => ({
      id: `GRN-${grn.id || grn.grn_number}-${grn.item_code}-${grn.created_at}`, // Unique composite key
      type: 'GRN' as const,
      date: grn.date,
      item_code: grn.item_code,
      quantity: grn.qty_received,
      reference: grn.grn_number,
      supplier: grn.vendor,
      amount: grn.amount_inr,
      created_at: grn.created_at || grn.date,
    })),
    ...(recentIssues.data || []).map(issue => ({
      id: `ISSUE-${issue.id}-${issue.item_code}-${issue.created_at}`, // Unique composite key
      type: 'ISSUE' as const,
      date: issue.date,
      item_code: issue.item_code,
      quantity: issue.qty_issued,
      purpose: issue.purpose,
      created_at: issue.created_at || issue.date,
    }))
  ];

  // Apply type filter on frontend (since this is a simple filter)
  const filteredTransactions = allTransactions.filter(transaction => {
    const matchesType = typeFilter === "" || transaction.type === typeFilter;
    return matchesType;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Client-side pagination for better performance
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTransactions = showAll && filteredTransactions.length > ITEMS_PER_PAGE 
    ? filteredTransactions.slice(startIndex, endIndex)
    : filteredTransactions;

  const isLoading = recentGRN.isLoading || recentIssues.isLoading;

  const handleRefresh = () => {
    recentGRN.refetch();
    recentIssues.refetch();
  };

  const handleShowAllToggle = () => {
    setShowAll(!showAll);
    setCurrentPage(1); // Reset to first page when toggling
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="lg" />
        </div>
        <div className="text-center text-muted-foreground">
          Loading transaction history...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by item code, reference, or purpose..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={typeFilter || "__ALL__"} onValueChange={(value) => setTypeFilter(value === "__ALL__" ? "" : value)}>
          <SelectTrigger className="w-auto">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__ALL__">All types</SelectItem>
            <SelectItem value="GRN">GRN Only</SelectItem>
            <SelectItem value="ISSUE">Issues Only</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          placeholder="From date"
          value={dateRange.from}
          onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
          className="w-auto"
        />
        
        <Input
          type="date"
          placeholder="To date"
          value={dateRange.to}
          onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
          className="w-auto"
        />

        <Button
          variant={showAll ? "default" : "outline"}
          onClick={handleShowAllToggle}
          className="gap-2"
        >
          {showAll ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showAll ? "Showing All" : "Show All Records"}
        </Button>

        <Button
          variant="outline"
          onClick={handleRefresh}
          className="gap-2"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Transactions</div>
          <div className="text-2xl font-bold">{filteredTransactions.length}</div>
          {!showAll && filteredTransactions.length >= 100 && (
            <div className="text-xs text-orange-600">
              Limited view - click "Show All Records" for complete history
            </div>
          )}
          {showAll && (
            <div className="text-xs text-green-600">
              Complete transaction history loaded
            </div>
          )}
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">GRNs</div>
          <div className="text-2xl font-bold text-green-600">
            {filteredTransactions.filter(t => t.type === 'GRN').length}
          </div>
          <div className="text-xs text-muted-foreground">
            Raw data: {recentGRN.data?.length || 0} records
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Issues</div>
          <div className="text-2xl font-bold text-red-600">
            {filteredTransactions.filter(t => t.type === 'ISSUE').length}
          </div>
          <div className="text-xs text-muted-foreground">
            Raw data: {recentIssues.data?.length || 0} records
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Value</div>
          <div className="text-2xl font-bold">
            ₹{filteredTransactions
              .filter(t => t.amount)
              .reduce((sum, t) => sum + (t.amount || 0), 0)
              .toLocaleString()}
          </div>
        </div>
      </div>

      {/* Debug Info */}
      {(searchQuery || showAll) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm text-blue-800">
            <strong>Debug Info:</strong> Search: "{searchQuery}" | 
            <strong> Results:</strong> {filteredTransactions.length} transactions |
            <strong> Mode:</strong> {showAll ? 'All Records' : 'Limited View'} |
            <strong> GRN Raw:</strong> {recentGRN.data?.length || 0} |
            <strong> Issues Raw:</strong> {recentIssues.data?.length || 0}
            {showAll && totalPages > 1 && (
              <span> | <strong>Page:</strong> {currentPage} of {totalPages}</span>
            )}
          </div>
        </div>
      )}

      {/* Pagination Controls for Large Datasets */}
      {showAll && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredTransactions.length)} of {filteredTransactions.length} results
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="flex items-center px-3 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Toggle for Large Datasets */}
      {showAll && filteredTransactions.length > ITEMS_PER_PAGE && (
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-2"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {isExpanded ? 'Show Paginated View' : 'Show All Records (No Pagination)'}
          </Button>
        </div>
      )}

      {/* Transactions Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Item Code</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Reference/Purpose</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(isExpanded ? filteredTransactions : paginatedTransactions).map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>
                  <Badge 
                    variant={transaction.type === 'GRN' ? 'default' : 'destructive'}
                    className="gap-1"
                  >
                    {transaction.type === 'GRN' ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )}
                    {transaction.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(transaction.date), "dd/MM/yyyy")}
                </TableCell>
                <TableCell className="font-medium">
                  {transaction.item_code}
                </TableCell>
                <TableCell>
                  <span className={transaction.type === 'GRN' ? 'text-green-600' : 'text-red-600'}>
                    {transaction.type === 'GRN' ? '+' : '-'}{transaction.quantity}
                  </span>
                </TableCell>
                <TableCell>
                  {transaction.reference || transaction.purpose || "-"}
                </TableCell>
                <TableCell>
                  {transaction.supplier || "-"}
                </TableCell>
                <TableCell>
                  {transaction.amount ? `₹${transaction.amount.toLocaleString()}` : "-"}
                </TableCell>
              </TableRow>
            ))}
            {(isExpanded ? filteredTransactions : paginatedTransactions).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 
                    `No transactions found matching "${searchQuery}"` : 
                    "No transactions found matching your criteria"
                  }
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bottom Pagination for Large Datasets */}
      {showAll && totalPages > 1 && !isExpanded && (
        <div className="flex items-center justify-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            First
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </Button>
        </div>
      )}
    </div>
  );
}
