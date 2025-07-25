import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQualityManagement } from "@/hooks/useQualityManagement";
import { ColorQualityPanel } from "./ColorQualityPanel";
import { Gauge, CheckCircle, XCircle, Clock, FileText, AlertTriangle, Palette } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface QualityControlPanelProps {
  uiorn: string;
  processStage?: string;
}

interface MeasurementForm {
  templateId: string;
  measuredValue: string;
  textValue: string;
  notes: string;
}

export function QualityControlPanel({ uiorn, processStage }: QualityControlPanelProps) {
  const { toast } = useToast();
  const [measurementForm, setMeasurementForm] = useState<MeasurementForm>({
    templateId: "",
    measuredValue: "",
    textValue: "",
    notes: ""
  });

  const {
    useQualityTemplates,
    useQualityMetrics,
    useQualityWorkflows,
    useQualityDashboard,
    useQualityScore,
    recordQualityMeasurement,
    approveQualityMeasurement
  } = useQualityManagement();

  // Fetch data with safe defaults
  const { data: qualityScore = 0 } = useQualityScore(uiorn);
  const { data: qualityMetrics = [] } = useQualityMetrics(uiorn, processStage);
  const { data: templates = [] } = useQualityTemplates(processStage);
  const { data: workflows = [] } = useQualityWorkflows(uiorn, processStage);
  const { data: dashboardData } = useQualityDashboard(uiorn);

  // Safely process dashboard data with type guards
  const safeQualityMetrics = Array.isArray(qualityMetrics) ? qualityMetrics : [];
  const safeTemplates = Array.isArray(templates) ? templates : [];
  const safeWorkflows = Array.isArray(workflows) ? workflows : [];

  // Process dashboard data to derive metrics
  const colorAccuracy = dashboardData?.color_accuracy || 0;
  const dimensionalAccuracy = dashboardData?.dimensional_accuracy || 0;

  // Find latest color and dimensional quality metrics (mock data for demo)
  const latestColorMetric = safeQualityMetrics.find(m => 
    m.checkpoint_id?.includes('color') || m.notes?.includes('color')
  );
  
  const latestDimensionalMetric = safeQualityMetrics.find(m => 
    m.checkpoint_id?.includes('dimensional') || m.notes?.includes('dimension')
  );

  // Handle quality measurement recording
  const handleRecordMeasurement = async () => {
    if (!measurementForm.templateId) {
      toast({
        title: "Template Required",
        description: "Please select a checkpoint template first.",
        variant: "destructive",
      });
      return;
    }

    const selectedTemplate = safeTemplates.find(t => t.id === measurementForm.templateId);
    
    try {
      await recordQualityMeasurement.mutateAsync({
        uiorn,
        quality_template_id: measurementForm.templateId,
        process_stage: selectedTemplate?.process_stage || processStage || 'PRINTING',
        measured_value: measurementForm.measuredValue ? parseFloat(measurementForm.measuredValue) : undefined,
        text_value: measurementForm.textValue || undefined,
        notes: measurementForm.notes || undefined,
      });

      toast({
        title: "Measurement Recorded",
        description: "Quality measurement has been successfully recorded.",
      });

      // Reset form
      setMeasurementForm({
        templateId: "",
        measuredValue: "",
        textValue: "",
        notes: ""
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record measurement. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle measurement approval
  const handleApproveMeasurement = async (id: string, status: 'APPROVED' | 'REJECTED' | 'REWORK') => {
    try {
      await approveQualityMeasurement.mutateAsync({ id, status });
      toast({
        title: "Measurement Updated",
        description: `Measurement has been ${status.toLowerCase()}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update measurement status.",
        variant: "destructive",
      });
    }
  };

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'text-green-600 bg-green-50';
      case 'REJECTED': return 'text-red-600 bg-red-50';
      case 'REWORK': return 'text-orange-600 bg-orange-50';
      case 'PENDING': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Render color accuracy metrics
  const renderColorAccuracy = () => {
    const deltaE = latestColorMetric?.measured_value || 0;
    const target = 2.0; // Standard target for Delta E
    const progress = Math.max(0, Math.min(100, (target - deltaE) / target * 100));

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Color Accuracy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Delta E Value</span>
              <span className="text-2xl font-bold">{deltaE.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Target</span>
              <span className="text-sm">&lt; {target}</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="text-xs text-muted-foreground text-center">
              {progress > 80 ? 'Excellent' : progress > 60 ? 'Good' : 'Needs Attention'}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render dimensional accuracy metrics
  const renderDimensionalAccuracy = () => {
    const measuredValue = latestDimensionalMetric?.measured_value || 0;
    const target = 100; // Mock target value
    const deviation = Math.abs(measuredValue - target);
    const tolerance = 2; // Mock tolerance
    const isWithinSpec = deviation <= tolerance;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Dimensional Accuracy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Measured Value</span>
              <span className="text-2xl font-bold">{measuredValue.toFixed(2)} mm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Target</span>
              <span className="text-sm">{target.toFixed(2)} mm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Deviation</span>
              <span className={`text-sm font-medium ${isWithinSpec ? 'text-green-600' : 'text-red-600'}`}>
                ±{deviation.toFixed(2)} mm
              </span>
            </div>
            <div className="text-center">
              <Badge variant={isWithinSpec ? "default" : "destructive"}>
                {isWithinSpec ? 'Within Specification' : 'Out of Specification'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-6 w-6" />
          Quality Control Dashboard - {uiorn}
        </CardTitle>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-muted-foreground">Quality Score:</span>
            <span className="text-lg font-bold text-blue-600">{qualityScore}%</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm text-muted-foreground">Checkpoints:</span>
            <span className="text-sm font-medium">
              {dashboardData?.completed_checkpoints || 0}/{dashboardData?.total_checkpoints || 0}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="metrics" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="color">Color Control</TabsTrigger>
            <TabsTrigger value="checkpoints">Checkpoints</TabsTrigger>
            <TabsTrigger value="measurement">Measurement</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderColorAccuracy()}
              {renderDimensionalAccuracy()}
            </div>

            <div className="grid gap-4">
              {/* Latest Measurements */}
              <div className="space-y-2">
                <h4 className="font-medium">Latest Measurements</h4>
                <div className="space-y-2">
                  {safeQualityMetrics.filter(m => m.measured_value !== null).slice(0, 3).map(metric => (
                    <div key={metric.id} className="flex justify-between items-center p-2 border rounded">
                      <span className="text-sm">{metric.checkpoint_id}</span>
                      <span className="text-sm font-medium">{metric.measured_value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Process Summary */}
              <div className="space-y-2">
                <h4 className="font-medium">Process Summary</h4>
                <div className="space-y-2">
                  {safeQualityMetrics.filter(m => m.status === 'APPROVED').slice(0, 3).map(metric => (
                    <div key={metric.id} className="flex justify-between items-center p-2 border rounded">
                      <span className="text-sm">{metric.checkpoint_id}</span>
                      <Badge variant="default" className="text-xs">Approved</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workflow Status */}
              <div className="space-y-2">
                <h4 className="font-medium">Active Workflows</h4>
                <div className="space-y-2">
                  {safeWorkflows.filter(w => w.status === 'ACTIVE').slice(0, 3).map(workflow => (
                    <div key={workflow.id} className="flex justify-between items-center p-2 border rounded">
                      <span className="text-sm">{workflow.workflow_name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {workflow.process_stage}
                      </Badge>
                    </div>
                  ))}
                  {safeWorkflows.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center p-4">
                      No active workflows
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="color" className="space-y-4">
            <ColorQualityPanel uiorn={uiorn} />
          </TabsContent>

          <TabsContent value="checkpoints" className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Quality Checkpoints</h3>
              
              {safeQualityMetrics.slice(0, 5).map(metric => (
                <Card key={metric.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <h4 className="font-medium">{metric.checkpoint_id}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Value:</span>
                          <span className="text-sm font-medium">
                            {metric.measured_value || metric.text_value || 'Not measured'}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {metric.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        {metric.status === 'PENDING' && (
                          <>
                            <Button 
                              size="sm" 
                              onClick={() => handleApproveMeasurement(metric.id, 'APPROVED')}
                            >
                              Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleApproveMeasurement(metric.id, 'REJECTED')}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {safeQualityMetrics.length === 0 && (
                <div className="text-center p-8 text-muted-foreground">
                  No quality measurements recorded yet.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="measurement" className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Record Quality Measurement</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Checkpoint Template</label>
                  <Select
                    value={measurementForm.templateId}
                    onValueChange={(value) => setMeasurementForm(prev => ({ ...prev, templateId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select checkpoint" />
                    </SelectTrigger>
                    <SelectContent>
                      {safeTemplates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.checkpoint_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Measured Value</label>
                  <Input
                    type="number"
                    value={measurementForm.measuredValue}
                    onChange={(e) => setMeasurementForm(prev => ({ ...prev, measuredValue: e.target.value }))}
                    placeholder="Enter measured value"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Text Value</label>
                  <Input
                    value={measurementForm.textValue}
                    onChange={(e) => setMeasurementForm(prev => ({ ...prev, textValue: e.target.value }))}
                    placeholder="Enter text value (if applicable)"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    value={measurementForm.notes}
                    onChange={(e) => setMeasurementForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any notes or observations"
                    rows={3}
                  />
                </div>
              </div>

              <Button 
                onClick={handleRecordMeasurement}
                disabled={!measurementForm.templateId || recordQualityMeasurement.isPending}
              >
                {recordQualityMeasurement.isPending ? 'Recording...' : 'Record Measurement'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Quality Control Reports</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <FileText className="h-6 w-6" />
                  <span>Quality Summary Report</span>
                </Button>
                
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <AlertTriangle className="h-6 w-6" />
                  <span>Non-Conformance Report</span>
                </Button>
                
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <CheckCircle className="h-6 w-6" />
                  <span>Compliance Report</span>
                </Button>
                
                <Button variant="outline" className="h-20 flex flex-col gap-2">
                  <Clock className="h-6 w-6" />
                  <span>Process Timeline</span>
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}