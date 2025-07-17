import { useState } from "react";
import { format } from "date-fns";
import { Search, ArrowUp, ArrowDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRecentTransactions } from "@/hooks/useRecentTransactions";

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
}

export function TransactionHistory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const { recentGRN, recentIssues } = useRecentTransactions(100);

  // Combine and transform data
  const allTransactions: Transaction[] = [
    ...(recentGRN.data || []).map(grn => ({
      id: grn.grn_number,
      type: 'GRN' as const,
      date: grn.date,
      item_code: grn.item_code,
      quantity: grn.qty_received,
      reference: grn.grn_number,
      supplier: grn.vendor,
      amount: grn.amount_inr,
    })),
    ...(recentIssues.data || []).map(issue => ({
      id: issue.id,
      type: 'ISSUE' as const,
      date: issue.date,
      item_code: issue.item_code,
      quantity: issue.qty_issued,
      purpose: issue.purpose,
    }))
  ];

  // Filter transactions
  const filteredTransactions = allTransactions.filter(transaction => {
    const matchesSearch = searchQuery === "" || 
      transaction.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.purpose?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === "" || transaction.type === typeFilter;
    
    const matchesDateRange = 
      (dateRange.from === "" || transaction.date >= dateRange.from) &&
      (dateRange.to === "" || transaction.date <= dateRange.to);

    return matchesSearch && matchesType && matchesDateRange;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const isLoading = recentGRN.isLoading || recentIssues.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
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
            placeholder="Search by item code, reference, or purpose..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-auto">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All types</SelectItem>
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
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Transactions</div>
          <div className="text-2xl font-bold">{filteredTransactions.length}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">GRNs</div>
          <div className="text-2xl font-bold text-green-600">
            {filteredTransactions.filter(t => t.type === 'GRN').length}
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Issues</div>
          <div className="text-2xl font-bold text-red-600">
            {filteredTransactions.filter(t => t.type === 'ISSUE').length}
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
            {filteredTransactions.map((transaction) => (
              <TableRow key={`${transaction.type}-${transaction.id}`}>
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
            {filteredTransactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No transactions found matching your criteria
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}