
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Filter, Download } from "lucide-react";
import { useDataValidation } from "@/hooks/useDataValidation";
import { useState } from "react";

interface DataValidationPanelProps {
  onFixIssue?: (issueId: string, action: string) => void;
  onRunValidation?: () => void;
}

export function DataValidationPanel({ onFixIssue, onRunValidation }: DataValidationPanelProps) {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  
  const { 
    validationResults, 
    validationSummary, 
    isValidating,
    runValidation 
  } = useDataValidation();

  const handleRunValidation = () => {
    runValidation();
    onRunValidation?.();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info': return <CheckCircle className="w-4 h-4 text-blue-500" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const filteredResults = validationResults.data?.filter(result => {
    const severityMatch = severityFilter === "all" || result.severity === severityFilter;
    const typeMatch = typeFilter === "all" || result.type === typeFilter;
    return severityMatch && typeMatch;
  }) || [];

  if (validationResults.isLoading || isValidating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Data Validation
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

  return (
    <div className="space-y-6">
      {/* Validation Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Data Validation
              </CardTitle>
              <CardDescription>
                Automated checks for data quality and integrity issues
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleRunValidation}
                disabled={isValidating}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
                Run Validation
              </Button>
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Export Report
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Severity Filter</label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Type Filter</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                  <SelectItem value="warning">Warnings</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Critical Issues</p>
                <p className="text-2xl font-bold text-red-500">
                  {validationSummary.data?.criticalIssues || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Warnings</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {validationSummary.data?.warnings || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Passed Checks</p>
                <p className="text-2xl font-bold text-green-500">
                  {validationSummary.data?.passedChecks || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Last Run</p>
                <p className="text-sm text-muted-foreground">
                  {validationSummary.data?.lastRun ? 
                    new Date(validationSummary.data.lastRun).toLocaleString() : 
                    'Never'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Validation Results */}
      <Card>
        <CardHeader>
          <CardTitle>Validation Results</CardTitle>
          <CardDescription>
            {filteredResults.length} issues found {severityFilter !== "all" && `(${severityFilter} severity)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {validationResults.data?.length === 0 ? 
                    "No validation issues found!" : 
                    "No issues match the current filters"
                  }
                </div>
              ) : (
                filteredResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(result.type)}
                        <p className="font-medium">{result.title}</p>
                        <Badge className={`${getSeverityColor(result.severity)} text-white`}>
                          {result.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{result.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Table: {result.table}</span>
                        <span>Field: {result.field}</span>
                        <span>Count: {result.affectedRecords}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.canAutoFix && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onFixIssue?.(result.id, 'auto-fix')}
                          className="gap-1"
                        >
                          Auto Fix
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onFixIssue?.(result.id, 'view-details')}
                        className="gap-1"
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
