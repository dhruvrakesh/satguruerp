
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRecentTransactions } from "@/hooks/useRecentTransactions";
import { ExternalLink, TrendingDown, TrendingUp, Loader2 } from "lucide-react";
import { format } from "date-fns";

export function RecentActivityFeed() {
  // For dashboard, we still want to limit to recent items for performance
  const { recentGRN, recentIssues } = useRecentTransactions(5, false);

  if (recentGRN.isLoading || recentIssues.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM dd, yyyy');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Recent GRN */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Latest GRN Entries
            </CardTitle>
            <Button variant="outline" size="sm">
              View All
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentGRN.data?.map((grn) => (
              <div 
                key={grn.grn_number} 
                className="flex items-center justify-between p-3 border border-green-200/50 bg-green-50/50 rounded-lg hover:bg-green-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-medium text-foreground">{grn.grn_number}</span>
                    <Badge className="bg-green-500 text-white">
                      GRN
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">{grn.item_code}</p>
                  <p className="text-sm text-muted-foreground">
                    From: {grn.vendor || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-700">{grn.qty_received} units</p>
                  <p className="text-sm text-green-600">
                    {grn.amount_inr ? formatCurrency(grn.amount_inr) : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(grn.date)}</p>
                </div>
              </div>
            ))}
            {(!recentGRN.data || recentGRN.data.length === 0) && (
              <p className="text-muted-foreground text-center py-4">No recent GRN entries</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Issues */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingDown className="w-5 h-5 text-red-600" />
              Recent Issues
            </CardTitle>
            <Button variant="outline" size="sm">
              View All
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentIssues.data?.map((issue) => (
              <div 
                key={issue.id} 
                className="flex items-center justify-between p-3 border border-red-200/50 bg-red-50/50 rounded-lg hover:bg-red-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-medium text-foreground">{issue.id.substring(0, 8)}...</span>
                    <Badge className="bg-red-500 text-white">
                      Issue
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">{issue.item_code}</p>
                  <p className="text-xs text-muted-foreground">
                    Purpose: {issue.purpose || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-red-700">{issue.qty_issued} units</p>
                  <p className="text-sm text-red-600">
                    Total: {issue.total_issued_qty} units
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(issue.date)}</p>
                </div>
              </div>
            ))}
            {(!recentIssues.data || recentIssues.data.length === 0) && (
              <p className="text-muted-foreground text-center py-4">No recent issues</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
