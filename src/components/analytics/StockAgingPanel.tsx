import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Clock, AlertTriangle, TrendingDown, Shield, DollarSign, Calendar } from "lucide-react";
import { useStockAging, useStockAgingSummary, StockAgingFilters } from "@/hooks/useStockAging";
import { useState } from "react";
import { useCategories } from "@/hooks/useCategories";
import { format } from "date-fns";

interface StockAgingPanelProps {
  onTakeAction?: (itemCode: string, action: string) => void;
}

const RISK_COLORS = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#dc2626'
};

const AGING_COLORS = {
  '0-30': '#22c55e',
  '31-60': '#84cc16',
  '61-90': '#f59e0b',
  '91-180': '#ef4444',
  '181-365': '#dc2626',
  '365+': '#7f1d1d'
};

export function StockAgingPanel({ onTakeAction }: StockAgingPanelProps) {
  const [filters, setFilters] = useState<StockAgingFilters>({});

  const { data: categories } = useCategories();
  const { data: agingData, isLoading } = useStockAging(filters);
  const { data: agingSummary } = useStockAgingSummary(filters);

  const getRiskBadge = (risk: string) => {
    const variants = {
      low: 'default',
      medium: 'secondary',
      high: 'destructive',
      critical: 'destructive'
    } as const;

    const colors = {
      low: 'text-green-700 bg-green-50',
      medium: 'text-yellow-700 bg-yellow-50',
      high: 'text-red-700 bg-red-50',
      critical: 'text-red-900 bg-red-100'
    };

    return (
      <Badge 
        variant={variants[risk as keyof typeof variants] || 'default'}
        className={colors[risk as keyof typeof colors]}
      >
        {risk.toUpperCase()}
      </Badge>
    );
  };

  const getActionBadge = (action: string) => {
    const variants = {
      monitor: 'outline',
      review: 'secondary',
      liquidate: 'destructive',
      writeoff: 'destructive'
    } as const;

    return (
      <Badge variant={variants[action as keyof typeof variants] || 'outline'}>
        {action}
      </Badge>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Prepare chart data
  const agingDistributionChart = agingSummary?.aging_distribution.map(item => ({
    ...item,
    fill: AGING_COLORS[item.bracket as keyof typeof AGING_COLORS] || '#8884d8'
  })) || [];

  const riskDistributionChart = Object.entries(agingSummary?.risk_summary || {}).map(([risk, data]) => ({
    risk,
    items: data.items,
    value: data.value,
    fill: RISK_COLORS[risk.replace('_risk', '') as keyof typeof RISK_COLORS] || '#8884d8'
  }));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Aging Analysis</CardTitle>
          <CardDescription>
            Analyze inventory age, identify slow-moving items, and assess valuation risks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select
                value={filters.category || "all"}
                onValueChange={(value) => setFilters({ ...filters, category: value === "all" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map(cat => (
                    <SelectItem key={cat.id} value={cat.category_name}>
                      {cat.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Risk Level</label>
              <Select
                value={filters.riskLevel || "all"}
                onValueChange={(value) => setFilters({ ...filters, riskLevel: value === "all" ? undefined : value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="low">Low Risk</SelectItem>
                  <SelectItem value="medium">Medium Risk</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                  <SelectItem value="critical">Critical Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Aging Bracket</label>
              <Select
                value={filters.agingBracket || "all"}
                onValueChange={(value) => setFilters({ ...filters, agingBracket: value === "all" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brackets</SelectItem>
                  <SelectItem value="0-30">0-30 days</SelectItem>
                  <SelectItem value="31-60">31-60 days</SelectItem>
                  <SelectItem value="61-90">61-90 days</SelectItem>
                  <SelectItem value="91-180">91-180 days</SelectItem>
                  <SelectItem value="181-365">181-365 days</SelectItem>
                  <SelectItem value="365+">365+ days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Min Value</label>
              <Input
                type="number"
                placeholder="0"
                value={filters.minValue || ""}
                onChange={(e) => setFilters({ ...filters, minValue: parseInt(e.target.value) || undefined })}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Max Value</label>
              <Input
                type="number"
                placeholder="No limit"
                value={filters.maxValue || ""}
                onChange={(e) => setFilters({ ...filters, maxValue: parseInt(e.target.value) || undefined })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{agingSummary?.total_items || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrency(agingSummary?.total_value || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">High Risk Items</p>
                <p className="text-2xl font-bold">
                  {(agingSummary?.risk_summary.high_risk.items || 0) + (agingSummary?.risk_summary.critical_risk.items || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Valuation Risk</p>
                <p className="text-2xl font-bold">
                  {formatCurrency((agingSummary?.risk_summary.high_risk.value || 0) + (agingSummary?.risk_summary.critical_risk.value || 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="aging" className="space-y-4">
        <TabsList>
          <TabsTrigger value="aging">Aging Analysis</TabsTrigger>
          <TabsTrigger value="risk">Risk Assessment</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="details">Detailed View</TabsTrigger>
        </TabsList>

        <TabsContent value="aging" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Aging Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Aging Distribution (by Count)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={agingDistributionChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bracket" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="item_count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Aging Distribution by Value */}
            <Card>
              <CardHeader>
                <CardTitle>Aging Distribution (by Value)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={agingDistributionChart}
                      dataKey="total_value"
                      nameKey="bracket"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ bracket, percentage }) => `${bracket}: ${percentage.toFixed(1)}%`}
                    >
                      {agingDistributionChart.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={riskDistributionChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="risk" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="items" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Risk Value Impact */}
            <Card>
              <CardHeader>
                <CardTitle>Value at Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={riskDistributionChart}
                      dataKey="value"
                      nameKey="risk"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {riskDistributionChart.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Action Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Days Since Last Transaction</TableHead>
                    <TableHead>Value at Risk</TableHead>
                    <TableHead>Recommended Action</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agingData?.filter(item => item.recommended_action !== 'monitor').slice(0, 20).map((item) => (
                    <TableRow key={item.item_code}>
                      <TableCell className="font-mono">{item.item_code}</TableCell>
                      <TableCell>{item.days_since_last_transaction} days</TableCell>
                      <TableCell>{formatCurrency(item.valuation_impact)}</TableCell>
                      <TableCell>{getActionBadge(item.recommended_action)}</TableCell>
                      <TableCell>{getRiskBadge(item.risk_level)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onTakeAction?.(item.item_code, item.recommended_action)}
                        >
                          Take Action
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Aging Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading aging analysis...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Current Qty</TableHead>
                      <TableHead>Total Value</TableHead>
                      <TableHead>Last Transaction</TableHead>
                      <TableHead>Days Aging</TableHead>
                      <TableHead>Aging Bracket</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>Value Impact</TableHead>
                      <TableHead>Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agingData?.slice(0, 30).map((item) => (
                      <TableRow key={item.item_code}>
                        <TableCell className="font-mono">{item.item_code}</TableCell>
                        <TableCell>{item.item_name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.current_qty}</TableCell>
                        <TableCell>{formatCurrency(item.total_value)}</TableCell>
                        <TableCell>
                          {item.last_transaction_date 
                            ? format(new Date(item.last_transaction_date), "MMM dd, yyyy")
                            : "No transactions"
                          }
                        </TableCell>
                        <TableCell>{item.days_since_last_transaction}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            style={{ 
                              backgroundColor: AGING_COLORS[item.aging_bracket as keyof typeof AGING_COLORS] + '20',
                              borderColor: AGING_COLORS[item.aging_bracket as keyof typeof AGING_COLORS]
                            }}
                          >
                            {item.aging_bracket}
                          </Badge>
                        </TableCell>
                        <TableCell>{getRiskBadge(item.risk_level)}</TableCell>
                        <TableCell>{formatCurrency(item.valuation_impact)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            item.aging_trend === 'improving' ? 'default' :
                            item.aging_trend === 'stable' ? 'secondary' : 'destructive'
                          }>
                            {item.aging_trend}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}