import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, AlertTriangle, CheckCircle, XCircle, Filter, RefreshCw, Wrench, Info } from "lucide-react";
import { useDataValidation, ValidationFilters } from "@/hooks/useDataValidation";
import { formatCurrency } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";

interface DataValidationPanelProps {
  filters?: ValidationFilters;
  onFiltersChange?: (filters: ValidationFilters) => void;
  onFixIssue?: (issueId: string, action: string) => void;
  onRunValidation?: () => void;
}

const severityColors = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6'
};

const issueTypeLabels = {
  NEGATIVE_STOCK: 'Negative Stock',
  MISSING_REORDER_LEVEL: 'Missing Reorder Level',
  ZERO_COST: 'Zero/Missing Cost',
  ORPHANED_TRANSACTIONS: 'Orphaned Transactions',
  INCONSISTENT_UNITS: 'Inconsistent Units',
  FUTURE_DATES: 'Future Dates',
  DUPLICATE_ITEMS: 'Duplicate Items'
};

export function DataValidationPanel({ 
  filters = {}, 
  onFiltersChange,
  onFixIssue,
  onRunValidation 
}: DataValidationPanelProps) {
  const [localFilters, setLocalFilters] = useState<ValidationFilters>(filters);
  const { validationIssues, validationSummary } = useDataValidation(localFilters);

  const handleFilterChange = (key: keyof ValidationFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  if (validationIssues.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Data Validation & Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Running data validation checks...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (validationIssues.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Data Validation & Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            Error running validation checks
          </div>
        </CardContent>
      </Card>
    );
  }

  const issues = validationIssues.data || [];
  const summary = validationSummary.data;

  // Prepare chart data
  const severityDistribution = [
    { name: 'Critical', value: summary?.criticalIssues || 0, color: severityColors.CRITICAL },
    { name: 'High', value: summary?.highPriorityIssues || 0, color: severityColors.HIGH },
    { name: 'Medium', value: issues.filter(i => i.severity === 'MEDIUM').length, color: severityColors.MEDIUM },
    { name: 'Low', value: issues.filter(i => i.severity === 'LOW').length, color: severityColors.LOW }
  ];

  const issueTypeData = Object.entries(summary?.issuesByType || {}).map(([type, count]) => ({
    name: issueTypeLabels[type as keyof typeof issueTypeLabels] || type,
    value: count,
    type
  }));

  const healthScoreData = [
    { name: 'Data Consistency', score: summary?.dataConsistencyScore || 0 },
    { name: 'System Health', score: summary?.systemHealthScore || 0 }
  ];

  return (
    <div className="space-y-6" id="data-validation-panel">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Data Validation & Monitoring</h3>
          <p className="text-sm text-muted-foreground">
            Last validation: {summary?.lastValidationRun ? format(parseISO(summary.lastValidationRun), 'MMM dd, yyyy HH:mm') : 'Never'}
          </p>
        </div>
        <Button
          onClick={onRunValidation}
          className="gap-2"
          disabled={validationIssues.isLoading}
        >
          <RefreshCw className="w-4 h-4" />
          Run Validation
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Validation Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Severity</label>
              <Select
                value={localFilters.severity || ""}
                onValueChange={(value) => handleFilterChange('severity', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All severities</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Issue Type</label>
              <Select
                value={localFilters.issueType || ""}
                onValueChange={(value) => handleFilterChange('issueType', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  {Object.entries(issueTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Impact Level</label>
              <Select
                value={localFilters.impactLevel?.toString() || ""}
                onValueChange={(value) => handleFilterChange('impactLevel', value ? parseInt(value) : undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All levels</SelectItem>
                  <SelectItem value="5">Critical Impact (5)</SelectItem>
                  <SelectItem value="4">High Impact (4+)</SelectItem>
                  <SelectItem value="3">Medium Impact (3+)</SelectItem>
                  <SelectItem value="2">Low Impact (2+)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select
                value={localFilters.category || ""}
                onValueChange={(value) => handleFilterChange('category', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  <SelectItem value="Transaction">Transaction</SelectItem>
                  <SelectItem value="Inventory">Inventory</SelectItem>
                  <SelectItem value="Master Data">Master Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Total Issues</p>
                <p className="text-2xl font-bold">{summary?.totalIssues || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Critical Issues</p>
                <p className="text-2xl font-bold text-red-600">{summary?.criticalIssues || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Data Consistency</p>
                <p className="text-2xl font-bold text-green-600">{summary?.dataConsistencyScore || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-blue-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">System Health</p>
                <p className="text-2xl font-bold text-blue-600">{summary?.systemHealthScore || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Severity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Issues by Severity</CardTitle>
            <CardDescription>Distribution of validation issues by severity level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={severityDistribution.filter(d => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {severityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Issue Types */}
        <Card>
          <CardHeader>
            <CardTitle>Issues by Type</CardTitle>
            <CardDescription>Types of validation issues detected</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={issueTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Issues List */}
      <Card>
        <CardHeader>
          <CardTitle>Validation Issues - Action Required</CardTitle>
          <CardDescription>
            Detailed list of data validation issues with recommended actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {issues.slice(0, 50).map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{issue.item_code || 'System'}</p>
                      <Badge 
                        variant={
                          issue.severity === 'CRITICAL' ? 'destructive' :
                          issue.severity === 'HIGH' ? 'secondary' :
                          issue.severity === 'MEDIUM' ? 'outline' : 'default'
                        }
                        style={{
                          backgroundColor: severityColors[issue.severity],
                          color: 'white'
                        }}
                      >
                        {issue.severity}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {issueTypeLabels[issue.issue_type]}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Impact: {issue.impact_level}/5
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{issue.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Current: {typeof issue.current_value === 'number' ? issue.current_value : issue.current_value || 'N/A'}</span>
                      <span>Expected: {issue.expected_value}</span>
                      <span>Category: {issue.category}</span>
                      <span>Detected: {format(parseISO(issue.detected_at), 'MMM dd, HH:mm')}</span>
                    </div>
                    <p className="text-xs text-primary font-medium">
                      💡 {issue.recommendation}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={issue.severity === 'CRITICAL' ? 'destructive' : 'outline'}
                      onClick={() => onFixIssue?.(issue.id, 'auto_fix')}
                      className="gap-1"
                    >
                      <Wrench className="w-3 h-3" />
                      Fix
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onFixIssue?.(issue.id, 'view_details')}
                      className="gap-1"
                    >
                      <Info className="w-3 h-3" />
                      Details
                    </Button>
                  </div>
                </div>
              ))}
              {issues.length > 50 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  ... and {issues.length - 50} more issues
                </div>
              )}
              {issues.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p className="text-lg font-medium text-green-600">All Clear!</p>
                  <p>No validation issues found with current filters</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}