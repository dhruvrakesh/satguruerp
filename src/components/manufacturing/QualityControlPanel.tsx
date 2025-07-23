
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp,
  Eye,
  Palette,
  Ruler,
  Activity,
  FileText,
  Plus,
  Clock,
  CheckCircle2
} from "lucide-react";
import { useQualityManagement } from "@/hooks/useQualityManagement";
import { useState } from "react";

interface QualityControlPanelProps {
  uiorn: string;
  processStage?: string;
}

export function QualityControlPanel({ uiorn, processStage }: QualityControlPanelProps) {
  const { toast } = useToast();
  const [measurementForm, setMeasurementForm] = useState({
    templateId: '',
    measuredValue: '',
    textValue: '',
    notes: ''
  });

  // Use real quality data instead of mock data
  const { 
    useQualityScore, 
    useQualityMetrics, 
    useQualityTemplates,
    useQualityWorkflows,
    useQualityDashboard,
    recordQualityMeasurement,
    approveQualityMeasurement
  } = useQualityManagement();

  const { data: qualityScore = 0 } = useQualityScore(uiorn);
  const { data: qualityMetrics = [] } = useQualityMetrics(uiorn, processStage);
  const { data: qualityTemplates = [] } = useQualityTemplates(processStage);
  const { data: qualityWorkflows = [] } = useQualityWorkflows(uiorn, processStage);
  const { data: dashboardData = [] } = useQualityDashboard(uiorn);
  // Calculate real-time metrics from actual data
  const processedMetrics = dashboardData.reduce((acc, item) => {
    if (item.process_stage === 'GRAVURE_PRINTING') {
      acc.colorAccuracy = {
        compliance: item.compliance_percentage,
        total: item.total_measurements,
        passed: item.passed_measurements,
        failed: item.failed_measurements
      };
    } else if (item.process_stage === 'LAMINATION') {
      acc.dimensionalAccuracy = {
        compliance: item.compliance_percentage,
        total: item.total_measurements,
        passed: item.passed_measurements,
        failed: item.failed_measurements
      };
    }
    return acc;
  }, {} as any);

  // Get latest measurements for each metric type
  const latestColorMetric = qualityMetrics.find(m => 
    m.quality_templates?.measurement_type === 'MEASUREMENT' && 
    m.measurement_unit === 'delta_e'
  );
  
  const latestDimensionalMetric = qualityMetrics.find(m => 
    m.quality_templates?.measurement_type === 'MEASUREMENT' && 
    m.measurement_unit === 'mm'
  );

  // Handle quality measurement recording
  const handleRecordMeasurement = async () => {
    if (!measurementForm.templateId) {
      toast({
        title: "Template Required",
        description: "Please select a quality checkpoint template.",
        variant: "destructive",
      });
      return;
    }

    try {
      const template = qualityTemplates.find(t => t.id === measurementForm.templateId);
      if (!template) return;

      await recordQualityMeasurement.mutateAsync({
        uiorn,
        quality_template_id: measurementForm.templateId,
        process_stage: template.process_stage,
        measured_value: measurementForm.measuredValue ? parseFloat(measurementForm.measuredValue) : undefined,
        text_value: measurementForm.textValue || undefined,
        notes: measurementForm.notes || undefined,
        measurement_unit: template.measurement_type === 'MEASUREMENT' ? 'units' : undefined,
      });

      setMeasurementForm({ templateId: '', measuredValue: '', textValue: '', notes: '' });
      
      toast({
        title: "Measurement Recorded",
        description: `Quality measurement for ${template.checkpoint_name} has been recorded.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record measurement. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle quality measurement approval
  const handleApproveMeasurement = async (measurementId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await approveQualityMeasurement.mutateAsync({
        id: measurementId,
        status,
      });

      toast({
        title: `Measurement ${status}`,
        description: `Quality measurement has been ${status.toLowerCase()}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update measurement status.",
        variant: "destructive",
      });
    }
  };

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
              <div className="font-medium">{latestColorMetric?.measured_value?.toFixed(2) || 'N/A'}</div>
              <div className="text-xs text-muted-foreground">
                Target: ≤{latestColorMetric?.specification_target || '2.0'}
              </div>
            </div>
          </div>
          
          {latestColorMetric?.measured_value && latestColorMetric?.specification_target && (
            <Progress 
              value={Math.max(0, Math.min(100, 
                ((latestColorMetric.specification_target - latestColorMetric.measured_value) / latestColorMetric.specification_target) * 100
              ))} 
              className="h-2" 
            />
          )}
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="font-medium">Measured</div>
              <div>{latestColorMetric?.measured_value?.toFixed(2) || 'N/A'}</div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="font-medium">Within Spec</div>
              <div>{latestColorMetric?.within_specification ? 'Yes' : 'No'}</div>
            </div>
          </div>
          
          <Badge className={getStatusColor(latestColorMetric?.within_specification ? 'passed' : 'failed')}>
            {latestColorMetric?.within_specification ? 'PASSED' : 'FAILED'}
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
              <span>Measured Value</span>
              <div className="text-right">
                <div className="font-medium">{latestDimensionalMetric?.measured_value || 'N/A'} {latestDimensionalMetric?.measurement_unit || ''}</div>
                <div className="text-xs text-muted-foreground">
                  Target: {latestDimensionalMetric?.specification_target || 'N/A'} {latestDimensionalMetric?.measurement_unit || ''}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between">
              <span>Deviation</span>
              <div className="text-right">
                <div className="font-medium">{latestDimensionalMetric?.deviation_percentage?.toFixed(1) || 'N/A'}%</div>
              </div>
            </div>
            
            <div className="flex justify-between">
              <span>Within Specification</span>
              <div className="text-right">
                <div className="font-medium">{latestDimensionalMetric?.within_specification ? 'Yes' : 'No'}</div>
              </div>
            </div>
          </div>
          
          <Badge className={getStatusColor(latestDimensionalMetric?.within_specification ? 'passed' : 'failed')}>
            {latestDimensionalMetric?.within_specification ? 'PASSED' : 'FAILED'}
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
              <div className="text-3xl font-bold text-green-600">{Math.round(qualityScore)}%</div>
              <div className="text-sm text-muted-foreground">Overall Score</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {qualityMetrics.filter(m => m.status === 'APPROVED').length}
              </div>
              <div className="text-sm text-muted-foreground">Approved Measurements</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">
                {qualityWorkflows.filter(w => w.status === 'IN_PROGRESS').length}
              </div>
              <div className="text-sm text-muted-foreground">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {qualityMetrics.filter(m => m.within_specification === false).length}
              </div>
              <div className="text-sm text-muted-foreground">Out of Spec</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quality Metrics Tabs */}
      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="metrics">Quality Metrics</TabsTrigger>
          <TabsTrigger value="checkpoints">Quality Checkpoints</TabsTrigger>
          <TabsTrigger value="measurement">Record Measurement</TabsTrigger>
          <TabsTrigger value="reports">QC Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {renderColorAccuracy()}
            {renderDimensionalAccuracy()}
            
            {/* Live Quality Metrics Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Latest Measurements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {qualityMetrics.slice(0, 3).map((metric) => (
                    <div key={metric.id} className="flex justify-between items-center">
                      <span className="text-sm">{metric.quality_templates?.checkpoint_name}</span>
                      <div className="text-right">
                        <div className="font-medium text-sm">
                          {metric.measured_value || metric.text_value || 'N/A'}
                          {metric.measurement_unit && ` ${metric.measurement_unit}`}
                        </div>
                        <Badge 
                          size="sm" 
                          className={getStatusColor(metric.within_specification ? 'passed' : 'failed')}
                        >
                          {metric.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {qualityMetrics.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      No measurements recorded yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quality Dashboard Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Process Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData.map((summary) => (
                    <div key={summary.process_stage} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">{summary.process_stage}</span>
                        <span className="text-sm">{summary.compliance_percentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={summary.compliance_percentage} className="h-2" />
                      <div className="text-xs text-muted-foreground">
                        {summary.passed_measurements}/{summary.total_measurements} passed
                      </div>
                    </div>
                  ))}
                  {dashboardData.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      No quality data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="checkpoints" className="space-y-4">
          <div className="space-y-4">
            {qualityMetrics.map((metric) => (
              <Card key={metric.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {metric.status === 'APPROVED' && <CheckCircle className="h-5 w-5 text-green-600" />}
                      {metric.status === 'MEASURED' && <Clock className="h-5 w-5 text-blue-600" />}
                      {metric.status === 'REJECTED' && <AlertTriangle className="h-5 w-5 text-red-600" />}
                      
                      <div>
                        <div className="font-medium">{metric.quality_templates?.checkpoint_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {metric.process_stage} • {metric.quality_templates?.test_method}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right space-y-1">
                      <Badge className={getStatusColor(metric.status.toLowerCase())}>
                        {metric.status}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        {new Date(metric.measurement_timestamp).toLocaleString()}
                      </div>
                      {metric.status === 'MEASURED' && (
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleApproveMeasurement(metric.id, 'APPROVED')}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleApproveMeasurement(metric.id, 'REJECTED')}
                          >
                            <AlertTriangle className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Measured Value: </span>
                      <span className="font-medium">
                        {metric.measured_value || metric.text_value || 'N/A'}
                        {metric.measurement_unit && ` ${metric.measurement_unit}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Within Spec: </span>
                      <span className={`font-medium ${metric.within_specification ? 'text-green-600' : 'text-red-600'}`}>
                        {metric.within_specification === null ? 'N/A' : metric.within_specification ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                  
                  {metric.notes && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium">Notes: </span>
                      {metric.notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            
            {qualityMetrics.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-muted-foreground">
                    No quality measurements recorded for this order yet.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="measurement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Record Quality Measurement
              </CardTitle>
              <CardDescription>
                Record new quality measurements for the selected checkpoint
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Quality Checkpoint</label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    value={measurementForm.templateId}
                    onChange={(e) => setMeasurementForm({...measurementForm, templateId: e.target.value})}
                  >
                    <option value="">Select a checkpoint...</option>
                    {qualityTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.checkpoint_name} ({template.process_stage})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Measured Value</label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={measurementForm.measuredValue}
                      onChange={(e) => setMeasurementForm({...measurementForm, measuredValue: e.target.value})}
                      placeholder="Enter numeric value"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Text Value</label>
                    <Input 
                      value={measurementForm.textValue}
                      onChange={(e) => setMeasurementForm({...measurementForm, textValue: e.target.value})}
                      placeholder="Enter text value"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Notes</label>
                  <Input 
                    value={measurementForm.notes}
                    onChange={(e) => setMeasurementForm({...measurementForm, notes: e.target.value})}
                    placeholder="Additional notes or observations"
                  />
                </div>
                
                <Button 
                  onClick={handleRecordMeasurement}
                  disabled={recordQualityMeasurement.isPending || !measurementForm.templateId}
                  className="w-full"
                >
                  {recordQualityMeasurement.isPending ? "Recording..." : "Record Measurement"}
                </Button>
              </div>
            </CardContent>
          </Card>
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
