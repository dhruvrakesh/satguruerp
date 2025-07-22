
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp,
  Eye,
  Palette,
  Ruler,
  Activity,
  FileText
} from "lucide-react";

interface QualityControlPanelProps {
  uiorn: string;
}

export function QualityControlPanel({ uiorn }: QualityControlPanelProps) {
  // Mock quality data
  const overallQualityScore = 94;
  
  const qualityMetrics = {
    color_accuracy: {
      delta_e: 1.2,
      target_delta_e: 2.0,
      l_value: 45.2,
      a_value: 12.8,
      b_value: -8.4,
      status: 'passed'
    },
    dimensional_accuracy: {
      width_variance_mm: 0.3,
      target_variance_mm: 0.5,
      thickness_variance_microns: 2,
      length_accuracy_percentage: 99.8,
      status: 'passed'
    },
    surface_quality: {
      gloss_units: 85,
      target_gloss: 80,
      smoothness_rating: 4.2,
      contamination_count: 0,
      status: 'passed'
    },
    lamination_quality: {
      bond_strength_n_15mm: 4.2,
      target_bond_strength: 3.5,
      bubble_count_per_sqm: 0,
      delamination_force_n: 5.8,
      status: 'passed'
    }
  };

  const qualityChecks = [
    {
      id: 1,
      checkpoint: 'Incoming Substrate Inspection',
      stage: 'Pre-Production',
      status: 'completed',
      inspector: 'QC001 - Rajesh Kumar',
      timestamp: '2024-01-15T08:30:00Z',
      results: { passed: 8, failed: 0, warnings: 1 }
    },
    {
      id: 2,
      checkpoint: 'Color Matching Verification',
      stage: 'Gravure Printing',
      status: 'in_progress',
      inspector: 'QC002 - Priya Sharma',
      timestamp: '2024-01-15T10:15:00Z',
      results: { passed: 5, failed: 0, warnings: 0 }
    },
    {
      id: 3,
      checkpoint: 'Print Registration Check',
      stage: 'Gravure Printing',
      status: 'pending',
      inspector: 'QC001 - Rajesh Kumar',
      results: { passed: 0, failed: 0, warnings: 0 }
    },
    {
      id: 4,
      checkpoint: 'Lamination Bond Test',
      stage: 'Lamination',
      status: 'pending',
      inspector: 'QC003 - Amit Patel',
      results: { passed: 0, failed: 0, warnings: 0 }
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'failed': return 'text-red-600 bg-red-50 border-red-200';
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'in_progress': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'pending': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const renderColorAccuracy = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Color Accuracy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Delta E Value</span>
            <div className="text-right">
              <div className="font-medium">{qualityMetrics.color_accuracy.delta_e}</div>
              <div className="text-xs text-muted-foreground">
                Target: ≤{qualityMetrics.color_accuracy.target_delta_e}
              </div>
            </div>
          </div>
          
          <Progress 
            value={(qualityMetrics.color_accuracy.target_delta_e - qualityMetrics.color_accuracy.delta_e) / qualityMetrics.color_accuracy.target_delta_e * 100} 
            className="h-2" 
          />
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="font-medium">L*</div>
              <div>{qualityMetrics.color_accuracy.l_value}</div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="font-medium">a*</div>
              <div>{qualityMetrics.color_accuracy.a_value}</div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="font-medium">b*</div>
              <div>{qualityMetrics.color_accuracy.b_value}</div>
            </div>
          </div>
          
          <Badge className={getStatusColor(qualityMetrics.color_accuracy.status)}>
            {qualityMetrics.color_accuracy.status.toUpperCase()}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  const renderDimensionalAccuracy = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ruler className="h-5 w-5" />
          Dimensional Accuracy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-3">
            <div className="flex justify-between">
              <span>Width Variance</span>
              <div className="text-right">
                <div className="font-medium">±{qualityMetrics.dimensional_accuracy.width_variance_mm} mm</div>
                <div className="text-xs text-muted-foreground">
                  Target: ±{qualityMetrics.dimensional_accuracy.target_variance_mm} mm
                </div>
              </div>
            </div>
            
            <div className="flex justify-between">
              <span>Thickness Variance</span>
              <div className="text-right">
                <div className="font-medium">±{qualityMetrics.dimensional_accuracy.thickness_variance_microns} μm</div>
              </div>
            </div>
            
            <div className="flex justify-between">
              <span>Length Accuracy</span>
              <div className="text-right">
                <div className="font-medium">{qualityMetrics.dimensional_accuracy.length_accuracy_percentage}%</div>
              </div>
            </div>
          </div>
          
          <Badge className={getStatusColor(qualityMetrics.dimensional_accuracy.status)}>
            {qualityMetrics.dimensional_accuracy.status.toUpperCase()}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Quality Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Quality Control Dashboard - {uiorn}
          </CardTitle>
          <CardDescription>
            Real-time quality monitoring and control for flexible packaging production
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{overallQualityScore}%</div>
              <div className="text-sm text-muted-foreground">Overall Score</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {qualityChecks.filter(q => q.status === 'completed').length}
              </div>
              <div className="text-sm text-muted-foreground">Completed Checks</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">1</div>
              <div className="text-sm text-muted-foreground">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">0</div>
              <div className="text-sm text-muted-foreground">Failures</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quality Metrics Tabs */}
      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="metrics">Quality Metrics</TabsTrigger>
          <TabsTrigger value="checkpoints">Quality Checkpoints</TabsTrigger>
          <TabsTrigger value="reports">QC Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {renderColorAccuracy()}
            {renderDimensionalAccuracy()}
            
            {/* Surface Quality */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Surface Quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Gloss Level</span>
                    <span className="font-medium">{qualityMetrics.surface_quality.gloss_units} GU</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Smoothness</span>
                    <span className="font-medium">{qualityMetrics.surface_quality.smoothness_rating}/5</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Contamination</span>
                    <span className="font-medium">{qualityMetrics.surface_quality.contamination_count} defects</span>
                  </div>
                  <Badge className={getStatusColor(qualityMetrics.surface_quality.status)}>
                    {qualityMetrics.surface_quality.status.toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Lamination Quality */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Lamination Quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Bond Strength</span>
                    <span className="font-medium">{qualityMetrics.lamination_quality.bond_strength_n_15mm} N/15mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bubble Count</span>
                    <span className="font-medium">{qualityMetrics.lamination_quality.bubble_count_per_sqm}/m²</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delamination Force</span>
                    <span className="font-medium">{qualityMetrics.lamination_quality.delamination_force_n} N</span>
                  </div>
                  <Badge className={getStatusColor(qualityMetrics.lamination_quality.status)}>
                    {qualityMetrics.lamination_quality.status.toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="checkpoints" className="space-y-4">
          <div className="space-y-4">
            {qualityChecks.map((check) => (
              <Card key={check.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {check.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-600" />}
                      {check.status === 'in_progress' && <Activity className="h-5 w-5 text-blue-600" />}
                      {check.status === 'pending' && <AlertTriangle className="h-5 w-5 text-gray-400" />}
                      
                      <div>
                        <div className="font-medium">{check.checkpoint}</div>
                        <div className="text-sm text-muted-foreground">
                          {check.stage} • {check.inspector}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <Badge className={getStatusColor(check.status)}>
                        {check.status.toUpperCase()}
                      </Badge>
                      {check.timestamp && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(check.timestamp).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {check.results && (check.results.passed > 0 || check.results.failed > 0 || check.results.warnings > 0) && (
                    <div className="mt-3 flex gap-4 text-sm">
                      <span className="text-green-600">✓ {check.results.passed} Passed</span>
                      <span className="text-orange-600">⚠ {check.results.warnings} Warnings</span>
                      <span className="text-red-600">✗ {check.results.failed} Failed</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Quality Control Reports
              </CardTitle>
              <CardDescription>
                Generate and view quality control reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-2 md:grid-cols-3">
                  <Button variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    Daily QC Report
                  </Button>
                  <Button variant="outline">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Quality Trends
                  </Button>
                  <Button variant="outline">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Non-Conformance Report
                  </Button>
                </div>
                
                <div className="text-center text-muted-foreground py-8">
                  Select a report type to generate detailed quality control documentation
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
