import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar as CalendarIcon, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Eye,
  Download,
  GitCompare,
  BarChart3,
  Clock,
  Target
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface HistoricalIntelligenceBrowserProps {
  className?: string;
}

interface IntelligenceSnapshot {
  id: string;
  snapshot_date: string;
  inventory_health_score: number;
  process_efficiency_score: number;
  quality_score: number;
  overall_intelligence_score: number;
  total_insights: number;
  critical_alerts: number;
  actionable_items: number;
  material_insights: Record<string, any>;
  category_analysis: Record<string, any>;
  executive_summary: {
    totalCategories: number;
    performanceTrend: string;
    keyRecommendations: string[];
  };
  outliers_detected: any[];
  cross_correlations: Record<string, any>;
}

export function HistoricalIntelligenceBrowser({ className }: HistoricalIntelligenceBrowserProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dateRange, setDateRange] = useState<{from: Date, to: Date}>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [snapshots, setSnapshots] = useState<IntelligenceSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<IntelligenceSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSnapshots, setCompareSnapshots] = useState<IntelligenceSnapshot[]>([]);
  const { toast } = useToast();

  // Load historical data
  const loadHistoricalData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_intelligence_snapshots')
        .select('*')
        .gte('snapshot_date', dateRange.from.toISOString().split('T')[0])
        .lte('snapshot_date', dateRange.to.toISOString().split('T')[0])
        .order('snapshot_date', { ascending: false });
      
      if (error) throw error;
      
      const formattedSnapshots: IntelligenceSnapshot[] = (data || []).map(snapshot => ({
        id: snapshot.id,
        snapshot_date: snapshot.snapshot_date,
        inventory_health_score: snapshot.inventory_health_score || 0,
        process_efficiency_score: snapshot.process_efficiency_score || 0,
        quality_score: snapshot.quality_score || 0,
        overall_intelligence_score: snapshot.overall_intelligence_score || 0,
        total_insights: snapshot.total_insights || 0,
        critical_alerts: snapshot.critical_alerts || 0,
        actionable_items: snapshot.actionable_items || 0,
        material_insights: (typeof snapshot.material_insights === 'object' && snapshot.material_insights !== null) 
          ? snapshot.material_insights as Record<string, any> 
          : {},
        category_analysis: (typeof snapshot.category_analysis === 'object' && snapshot.category_analysis !== null) 
          ? snapshot.category_analysis as Record<string, any> 
          : {},
        executive_summary: (typeof snapshot.executive_summary === 'object' && snapshot.executive_summary !== null) 
          ? snapshot.executive_summary as any 
          : {
              totalCategories: 0,
              performanceTrend: 'STABLE',
              keyRecommendations: []
            },
        outliers_detected: Array.isArray(snapshot.outliers_detected) 
          ? snapshot.outliers_detected 
          : [],
        cross_correlations: (typeof snapshot.cross_correlations === 'object' && snapshot.cross_correlations !== null) 
          ? snapshot.cross_correlations as Record<string, any> 
          : {}
      }));
      
      setSnapshots(formattedSnapshots);
      
      if (formattedSnapshots.length > 0 && !selectedSnapshot) {
        setSelectedSnapshot(formattedSnapshots[0]);
      }
    } catch (error) {
      console.error('Failed to load historical data:', error);
      toast({
        title: "Error",
        description: "Failed to load historical intelligence data",
        variant: "destructive",
      });
      // Fallback to empty data
      setSnapshots([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistoricalData();
  }, [dateRange]);

  // Quick date range presets
  const setQuickRange = (days: number) => {
    setDateRange({
      from: subDays(new Date(), days),
      to: new Date()
    });
  };

  // Toggle compare mode
  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    setCompareSnapshots([]);
  };

  // Add snapshot to comparison
  const addToComparison = (snapshot: IntelligenceSnapshot) => {
    if (compareSnapshots.length < 3 && !compareSnapshots.find(s => s.id === snapshot.id)) {
      setCompareSnapshots([...compareSnapshots, snapshot]);
    }
  };

  // Remove from comparison
  const removeFromComparison = (snapshotId: string) => {
    setCompareSnapshots(compareSnapshots.filter(s => s.id !== snapshotId));
  };

  // Get trend indicator
  const getTrendIndicator = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (current < previous) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header and Date Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold tracking-tight">Historical Intelligence Browser</h3>
          <p className="text-muted-foreground">
            Browse and compare historical manufacturing intelligence data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={compareMode ? "default" : "outline"}
            size="sm"
            onClick={toggleCompareMode}
          >
            <GitCompare className="h-4 w-4 mr-2" />
            Compare Mode
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Date Range Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Quick Range:</span>
              <Button variant="outline" size="sm" onClick={() => setQuickRange(7)}>
                7 Days
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickRange(30)}>
                30 Days
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickRange(90)}>
                90 Days
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Custom Range:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline and Snapshots List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Intelligence Timeline
              </CardTitle>
              <CardDescription>
                {snapshots.length} snapshots found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading historical data...
                    </div>
                  ) : snapshots.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No data available for selected range
                    </div>
                  ) : (
                    snapshots.map((snapshot, index) => {
                      const isSelected = selectedSnapshot?.id === snapshot.id;
                      const isCompareSelected = compareSnapshots.find(s => s.id === snapshot.id);
                      const previousSnapshot = snapshots[index + 1];
                      
                      return (
                        <Card 
                          key={snapshot.id}
                          className={cn(
                            "cursor-pointer transition-colors border-l-4",
                            isSelected ? "border-l-primary bg-muted/50" : "border-l-transparent",
                            isCompareSelected && "bg-blue-50 dark:bg-blue-950/20"
                          )}
                          onClick={() => setSelectedSnapshot(snapshot)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">
                                {format(new Date(snapshot.snapshot_date), 'MMM dd, yyyy')}
                              </span>
                              <div className="flex items-center gap-1">
                                {compareMode && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isCompareSelected) {
                                        removeFromComparison(snapshot.id);
                                      } else {
                                        addToComparison(snapshot);
                                      }
                                    }}
                                  >
                                    <GitCompare className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSnapshot(snapshot);
                                  }}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span>Overall Score:</span>
                                <div className="flex items-center gap-1">
                                  <span className={getScoreColor(snapshot.overall_intelligence_score)}>
                                    {snapshot.overall_intelligence_score}%
                                  </span>
                                  {previousSnapshot && getTrendIndicator(
                                    snapshot.overall_intelligence_score,
                                    previousSnapshot.overall_intelligence_score
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <span>Critical Alerts:</span>
                                <Badge variant={snapshot.critical_alerts > 0 ? "destructive" : "secondary"}>
                                  {snapshot.critical_alerts}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Detailed View */}
        <div className="lg:col-span-2">
          {compareMode && compareSnapshots.length > 0 ? (
            // Comparison View
            <Card>
              <CardHeader>
                <CardTitle>Intelligence Comparison</CardTitle>
                <CardDescription>
                  Comparing {compareSnapshots.length} snapshots
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Comparison Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                  {compareSnapshots.map((snapshot) => (
                    <Card key={snapshot.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="text-sm font-medium mb-2">
                          {format(new Date(snapshot.snapshot_date), 'MMM dd, yyyy')}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Overall:</span>
                            <span className={getScoreColor(snapshot.overall_intelligence_score)}>
                              {snapshot.overall_intelligence_score}%
                            </span>
                          </div>
                          <Progress value={snapshot.overall_intelligence_score} className="h-2" />
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Inventory:</span>
                              <span className="ml-1">{snapshot.inventory_health_score}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Quality:</span>
                              <span className="ml-1">{snapshot.quality_score}%</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Trend Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Trend Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="font-medium mb-2">Score Trends</h4>
                        <div className="space-y-2">
                          {compareSnapshots.length >= 2 && (
                            <>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Overall Performance:</span>
                                <div className="flex items-center gap-1">
                                  {getTrendIndicator(
                                    compareSnapshots[0].overall_intelligence_score,
                                    compareSnapshots[compareSnapshots.length - 1].overall_intelligence_score
                                  )}
                                  <span className="text-sm">
                                    {(compareSnapshots[0].overall_intelligence_score - compareSnapshots[compareSnapshots.length - 1].overall_intelligence_score).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Alert Trends</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Critical Alerts:</span>
                            <span className="text-sm">
                              {compareSnapshots.reduce((sum, s) => sum + s.critical_alerts, 0)} total
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          ) : selectedSnapshot ? (
            // Single Snapshot Detail View
            <div className="space-y-6">
              {/* Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Intelligence Snapshot</span>
                    <Badge variant="outline">
                      {format(new Date(selectedSnapshot.snapshot_date), 'MMMM dd, yyyy')}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Detailed manufacturing intelligence analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Key Metrics */}
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Overall Score</p>
                            <p className={cn("text-2xl font-bold", getScoreColor(selectedSnapshot.overall_intelligence_score))}>
                              {selectedSnapshot.overall_intelligence_score}%
                            </p>
                          </div>
                          <Target className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <Progress value={selectedSnapshot.overall_intelligence_score} className="mt-2" />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Inventory Health</p>
                            <p className={cn("text-2xl font-bold", getScoreColor(selectedSnapshot.inventory_health_score))}>
                              {selectedSnapshot.inventory_health_score}%
                            </p>
                          </div>
                          <BarChart3 className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <Progress value={selectedSnapshot.inventory_health_score} className="mt-2" />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Quality Score</p>
                            <p className={cn("text-2xl font-bold", getScoreColor(selectedSnapshot.quality_score))}>
                              {selectedSnapshot.quality_score}%
                            </p>
                          </div>
                          <Target className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <Progress value={selectedSnapshot.quality_score} className="mt-2" />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Critical Alerts</p>
                            <p className="text-2xl font-bold text-red-600">
                              {selectedSnapshot.critical_alerts}
                            </p>
                          </div>
                          <TrendingUp className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {selectedSnapshot.actionable_items} actionable items
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              {/* Executive Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Executive Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-medium mb-2">Key Metrics</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Total Categories:</span>
                          <span>{selectedSnapshot.executive_summary.totalCategories}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Performance Trend:</span>
                          <Badge variant="outline">{selectedSnapshot.executive_summary.performanceTrend}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Insights:</span>
                          <span>{selectedSnapshot.total_insights}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Key Recommendations</h4>
                      <div className="space-y-1">
                        {selectedSnapshot.executive_summary.keyRecommendations?.map((rec, index) => (
                          <div key={index} className="text-sm text-muted-foreground">
                            • {rec}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Material Categories Performance */}
              {selectedSnapshot.category_analysis && (
                <Card>
                  <CardHeader>
                    <CardTitle>Material Categories Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(selectedSnapshot.category_analysis).map(([category, analysis]: [string, any]) => (
                        <Card key={category}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-medium">{category}</h4>
                              <Badge variant={analysis.velocityClass === 'FAST' ? 'default' : 'secondary'}>
                                {analysis.velocityClass}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Health Score:</span>
                                <span className={getScoreColor(analysis.healthScore)}>
                                  {analysis.healthScore}%
                                </span>
                              </div>
                              <Progress value={analysis.healthScore} className="h-2" />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{analysis.activeItems} active items</span>
                                <span>{analysis.criticalItems?.length || 0} critical</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            // No Selection State
            <Card>
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">Select a Date</h3>
                  <p className="text-muted-foreground">
                    Choose a snapshot from the timeline to view detailed intelligence data
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}