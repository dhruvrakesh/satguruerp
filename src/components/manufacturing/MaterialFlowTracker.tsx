
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRawMaterials, RawMaterial } from "@/hooks/useRawMaterials";
import { useAutomatedMaterialFlow } from "@/hooks/useAutomatedMaterialFlow";
import { 
  ArrowRight, 
  Package, 
  RotateCcw, 
  Trash2, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  RefreshCw
} from "lucide-react";

interface MaterialFlowData {
  id?: string;
  uiorn: string;
  process_stage: string;
  input_material_type: string;
  input_quantity: number;
  input_unit: string;
  input_source_process?: string;
  output_good_quantity: number;
  output_rework_quantity: number;
  output_waste_quantity: number;
  waste_classification: 'SETUP_WASTE' | 'EDGE_TRIM' | 'DEFECTIVE' | 'CONTAMINATED' | 'OTHER';
  rework_reason?: string;
  yield_percentage: number;
  material_cost_per_unit: number;
  total_input_cost: number;
  waste_cost_impact: number;
  quality_grade: 'GRADE_A' | 'GRADE_B' | 'REWORK' | 'WASTE';
  operator_id?: string;
  recorded_at: string;
  notes?: string;
}

interface MaterialFlowTrackerProps {
  uiorn: string;
  processStage: string;
  previousProcessStage?: string;
  onFlowUpdate?: (flowData: MaterialFlowData[]) => void;
}

export function MaterialFlowTracker({ 
  uiorn, 
  processStage, 
  previousProcessStage, 
  onFlowUpdate 
}: MaterialFlowTrackerProps) {
  const [flowData, setFlowData] = useState<MaterialFlowData[]>([]);
  const [currentFlow, setCurrentFlow] = useState<Partial<MaterialFlowData>>({
    uiorn,
    process_stage: processStage,
    input_material_type: '',
    input_quantity: 0,
    input_unit: 'KG',
    output_good_quantity: 0,
    output_rework_quantity: 0,
    output_waste_quantity: 0,
    waste_classification: 'OTHER',
    yield_percentage: 0,
    material_cost_per_unit: 0,
    total_input_cost: 0,
    waste_cost_impact: 0,
    quality_grade: 'GRADE_A',
    recorded_at: new Date().toISOString()
  });
  const [availableInputs, setAvailableInputs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  // Fetch raw materials for dropdown
  const { data: rawMaterials = [], isLoading: isLoadingMaterials, error: rawMaterialsError } = useRawMaterials();
  
  // Enhanced automated material flow
  const { 
    getUpstreamMaterials, 
    autoTransferMutation, 
    validateMaterialFlowQuery, 
    materialFlowContinuityQuery 
  } = useAutomatedMaterialFlow(uiorn);
  
  // Get upstream materials using new automated system
  const { data: upstreamMaterials = [], isLoading: isLoadingUpstream } = getUpstreamMaterials(processStage);
  
  // Material flow validation
  const { data: flowValidation } = validateMaterialFlowQuery;

  useEffect(() => {
    if (uiorn && processStage) {
      loadExistingFlow();
      if (previousProcessStage) {
        loadAvailableInputs();
      }
    }
  }, [uiorn, processStage, previousProcessStage]);

  useEffect(() => {
    calculateYieldAndCosts();
  }, [
    currentFlow.input_quantity, 
    currentFlow.output_good_quantity, 
    currentFlow.output_rework_quantity, 
    currentFlow.output_waste_quantity,
    currentFlow.material_cost_per_unit
  ]);

  const loadExistingFlow = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('material_flow_tracking')
        .select('*')
        .eq('uiorn', uiorn)
        .eq('process_stage', processStage)
        .order('recorded_at', { ascending: false });

      if (error) throw error;
      setFlowData(data || []);
    } catch (error) {
      console.error('Error loading material flow:', error);
    }
  };

  const loadAvailableInputs = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('material_flow_tracking')
        .select('*')
        .eq('uiorn', uiorn)
        .eq('process_stage', previousProcessStage)
        .gt('output_good_quantity', 0);

      if (error) throw error;
      setAvailableInputs(data || []);
    } catch (error) {
      console.error('Error loading available inputs:', error);
    }
  };

  // Auto-populate from upstream materials
  const handleAutoPopulateFromUpstream = (upstreamMaterial: any) => {
    setCurrentFlow(prev => ({
      ...prev,
      input_material_type: upstreamMaterial.material_type,
      input_quantity: upstreamMaterial.available_quantity,
      input_unit: 'KG',
      input_source_process: upstreamMaterial.process_stage,
      material_cost_per_unit: 0 // Will be calculated based on BOM if available
    }));
    
    toast({
      title: "Auto-populated from upstream",
      description: `Material from ${upstreamMaterial.process_stage} has been loaded automatically.`,
    });
  };

  // Auto-transfer materials function
  const handleAutoTransfer = async () => {
    if (!previousProcessStage) return;
    
    try {
      const result = await autoTransferMutation.mutateAsync({
        fromProcess: previousProcessStage,
        toProcess: processStage,
      });
      
      toast({
        title: "Auto-transfer completed",
        description: `Transferred ${result.transferred_count} materials (${result.total_quantity.toFixed(1)} KG)`,
      });
    } catch (error) {
      console.error('Auto-transfer failed:', error);
    }
  };

  const calculateYieldAndCosts = () => {
    const totalOutput = (currentFlow.output_good_quantity || 0) + 
                       (currentFlow.output_rework_quantity || 0) + 
                       (currentFlow.output_waste_quantity || 0);
    
    const inputQty = currentFlow.input_quantity || 0;
    const yieldPercentage = inputQty > 0 ? (currentFlow.output_good_quantity || 0) / inputQty * 100 : 0;
    const totalInputCost = inputQty * (currentFlow.material_cost_per_unit || 0);
    const wasteCostImpact = (currentFlow.output_waste_quantity || 0) * (currentFlow.material_cost_per_unit || 0);

    setCurrentFlow(prev => ({
      ...prev,
      yield_percentage: yieldPercentage,
      total_input_cost: totalInputCost,
      waste_cost_impact: wasteCostImpact
    }));
  };

  const updateFlow = (field: keyof MaterialFlowData, value: any) => {
    setCurrentFlow(prev => ({ ...prev, [field]: value }));
  };

  const saveFlowData = async () => {
    setIsLoading(true);
    try {
      const user = await supabase.auth.getUser();
      const dataToSave = {
        ...currentFlow,
        operator_id: user.data.user?.id,
        recorded_at: new Date().toISOString()
      };

      const { error } = await (supabase as any)
        .from('material_flow_tracking')
        .insert([dataToSave]);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Material flow data saved for ${processStage}.`
      });

      await loadExistingFlow();
      resetCurrentFlow();
      onFlowUpdate?.(flowData);

    } catch (error) {
      console.error('Error saving material flow:', error);
      toast({
        title: "Error",
        description: "Failed to save material flow data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetCurrentFlow = () => {
    setCurrentFlow({
      uiorn,
      process_stage: processStage,
      input_material_type: '',
      input_quantity: 0,
      input_unit: 'KG',
      output_good_quantity: 0,
      output_rework_quantity: 0,
      output_waste_quantity: 0,
      waste_classification: 'OTHER',
      yield_percentage: 0,
      material_cost_per_unit: 0,
      total_input_cost: 0,
      waste_cost_impact: 0,
      quality_grade: 'GRADE_A',
      recorded_at: new Date().toISOString()
    });
  };

  const handleMaterialSelect = (itemCode: string) => {
    const selectedMaterial = rawMaterials.find(m => m.item_code === itemCode);
    if (selectedMaterial) {
      updateFlow('input_material_type', selectedMaterial.item_code);
      updateFlow('input_unit', selectedMaterial.uom || 'KG');
    }
  };

  const getYieldColor = (yield_pct: number) => {
    if (yield_pct >= 95) return 'text-green-600';
    if (yield_pct >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityGradeBadge = (grade: string) => {
    const colors = {
      'GRADE_A': 'bg-green-100 text-green-800 border-green-200',
      'GRADE_B': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'REWORK': 'bg-orange-100 text-orange-800 border-orange-200',
      'WASTE': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[grade as keyof typeof colors] || colors.GRADE_A;
  };

  // Group materials by type for better organization
  const groupedMaterials = rawMaterials.reduce((groups, material) => {
    const type = material.category_name || 'Other';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(material);
    return groups;
  }, {} as { [key: string]: RawMaterial[] });

  // Show error state if raw materials failed to load
  if (rawMaterialsError) {
    console.error('Error loading raw materials:', rawMaterialsError);
  }

  return (
    <div className="space-y-6">
      {/* Process Flow Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Material Flow - {processStage}
            </CardTitle>
            {previousProcessStage && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{previousProcessStage}</span>
                <ArrowRight className="h-4 w-4" />
                <span>{processStage}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="input" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="input">Material Input</TabsTrigger>
              <TabsTrigger value="output">Output & Quality</TabsTrigger>
              <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
              <TabsTrigger value="history">Flow History</TabsTrigger>
            </TabsList>

            <TabsContent value="input" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Material Type</label>
                  <Select
                    value={currentFlow.input_material_type || ''}
                    onValueChange={handleMaterialSelect}
                    disabled={isLoadingMaterials}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        isLoadingMaterials ? "Loading materials..." : 
                        rawMaterialsError ? "Error loading materials" :
                        "Select material type"
                      } />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {rawMaterialsError ? (
                        <div className="p-2 text-sm text-red-600">
                          Error loading materials. Please try again.
                        </div>
                      ) : Object.entries(groupedMaterials).map(([type, materials]) => (
                        <div key={type}>
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">
                            {type}
                          </div>
                          {materials.map((material) => (
                            <SelectItem key={material.item_code} value={material.item_code}>
                              <div className="flex flex-col">
                                <span className="font-medium">{material.display_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  UOM: {material.uom}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Input Quantity</label>
                  <Input
                    type="number"
                    value={currentFlow.input_quantity || ''}
                    onChange={(e) => updateFlow('input_quantity', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Unit</label>
                  <select
                    className="w-full px-3 py-2 border rounded-md"
                    value={currentFlow.input_unit || 'KG'}
                    onChange={(e) => updateFlow('input_unit', e.target.value)}
                  >
                    <option value="KG">KG</option>
                    <option value="METERS">METERS</option>
                    <option value="ROLLS">ROLLS</option>
                    <option value="SHEETS">SHEETS</option>
                  </select>
                </div>
              </div>

              {/* Show selected material details */}
              {currentFlow.input_material_type && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-800 mb-1">
                    <Package className="h-4 w-4" />
                    <span className="font-medium">Selected Material</span>
                  </div>
                  <div className="text-sm text-blue-700">
                    {rawMaterials.find(m => m.item_code === currentFlow.input_material_type)?.display_name}
                  </div>
                </div>
              )}

              {/* Enhanced Upstream Material Detection */}
              {upstreamMaterials.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">🚀 Available from Upstream Processes</label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAutoTransfer}
                        disabled={autoTransferMutation.isPending}
                        className="flex items-center gap-1"
                      >
                        <Zap className="h-3 w-3" />
                        {autoTransferMutation.isPending ? 'Transferring...' : 'Auto-Transfer All'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Refresh
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {upstreamMaterials.map((material, index) => (
                      <div 
                        key={index} 
                        className="p-4 border-2 border-primary/20 rounded-lg cursor-pointer hover:border-primary/40 bg-gradient-to-r from-primary/5 to-primary/10"
                        onClick={() => handleAutoPopulateFromUpstream(material)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-primary">{material.material_type}</div>
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            Grade {material.quality_grade}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div>Available: {material.available_quantity.toFixed(1)} KG</div>
                          <div>From: {material.process_stage}</div>
                          <div>Recorded: {new Date(material.recorded_at).toLocaleString()}</div>
                        </div>
                        <div className="mt-2 text-xs text-primary font-medium">
                          👆 Click to auto-populate input fields
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legacy available inputs (fallback) */}
              {previousProcessStage && availableInputs.length > 0 && upstreamMaterials.length === 0 && (
                <div>
                  <label className="text-sm font-medium">Available from {previousProcessStage}</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {availableInputs.map((input, index) => (
                      <div key={index} className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                           onClick={() => {
                             updateFlow('input_material_type', input.input_material_type);
                             updateFlow('input_quantity', input.output_good_quantity);
                             updateFlow('input_unit', input.input_unit);
                             updateFlow('input_source_process', previousProcessStage);
                           }}>
                        <div className="font-medium">{input.input_material_type}</div>
                        <div className="text-sm text-muted-foreground">
                          Available: {input.output_good_quantity} {input.input_unit}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No upstream materials available message */}
              {previousProcessStage && upstreamMaterials.length === 0 && availableInputs.length === 0 && !isLoadingUpstream && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No materials available from {previousProcessStage}. Ensure the previous process has been completed and materials are recorded with good output quantity greater than 0.
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <label className="text-sm font-medium">Material Cost per Unit (₹)</label>
                <Input
                  type="number"
                  value={currentFlow.material_cost_per_unit || ''}
                  onChange={(e) => updateFlow('material_cost_per_unit', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </TabsContent>

            <TabsContent value="output" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Good Output Quantity
                  </label>
                  <Input
                    type="number"
                    value={currentFlow.output_good_quantity || ''}
                    onChange={(e) => updateFlow('output_good_quantity', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-orange-500" />
                    Rework Quantity
                  </label>
                  <Input
                    type="number"
                    value={currentFlow.output_rework_quantity || ''}
                    onChange={(e) => updateFlow('output_rework_quantity', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-red-500" />
                    Waste Quantity
                  </label>
                  <Input
                    type="number"
                    value={currentFlow.output_waste_quantity || ''}
                    onChange={(e) => updateFlow('output_waste_quantity', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Waste Classification</label>
                  <select
                    className="w-full px-3 py-2 border rounded-md"
                    value={currentFlow.waste_classification || 'OTHER'}
                    onChange={(e) => updateFlow('waste_classification', e.target.value)}
                  >
                    <option value="SETUP_WASTE">Setup Waste</option>
                    <option value="EDGE_TRIM">Edge Trim</option>
                    <option value="DEFECTIVE">Defective Material</option>
                    <option value="CONTAMINATED">Contaminated</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Quality Grade</label>
                  <select
                    className="w-full px-3 py-2 border rounded-md"
                    value={currentFlow.quality_grade || 'GRADE_A'}
                    onChange={(e) => updateFlow('quality_grade', e.target.value)}
                  >
                    <option value="GRADE_A">Grade A (Customer Ready)</option>
                    <option value="GRADE_B">Grade B (Alternative Use)</option>
                    <option value="REWORK">Rework Required</option>
                    <option value="WASTE">Waste/Disposal</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Rework Reason</label>
                  <Input
                    value={currentFlow.rework_reason || ''}
                    onChange={(e) => updateFlow('rework_reason', e.target.value)}
                    placeholder="Reason for rework (if applicable)"
                  />
                </div>
              </div>

              {/* Yield Calculation Display */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Process Yield</span>
                  <span className={`font-bold ${getYieldColor(currentFlow.yield_percentage || 0)}`}>
                    {(currentFlow.yield_percentage || 0).toFixed(1)}%
                  </span>
                </div>
                <Progress value={currentFlow.yield_percentage || 0} className="h-2" />
                <div className="text-xs text-muted-foreground mt-1">
                  Good Output: {currentFlow.output_good_quantity || 0} / Input: {currentFlow.input_quantity || 0}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="costs" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-600">
                      ₹{(currentFlow.total_input_cost || 0).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">Total Input Cost</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-red-600">
                      ₹{(currentFlow.waste_cost_impact || 0).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">Waste Cost Impact</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">
                      ₹{((currentFlow.total_input_cost || 0) - (currentFlow.waste_cost_impact || 0)).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">Net Material Value</p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <label className="text-sm font-medium">Additional Notes</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md mt-1"
                  rows={3}
                  value={currentFlow.notes || ''}
                  onChange={(e) => updateFlow('notes', e.target.value)}
                  placeholder="Additional observations, quality notes, or process remarks..."
                />
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="space-y-3">
                {flowData.map((flow, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{flow.input_material_type}</span>
                        <Badge className={getQualityGradeBadge(flow.quality_grade)}>
                          {flow.quality_grade}
                        </Badge>
                        <div className={`font-bold ${getYieldColor(flow.yield_percentage)}`}>
                          {flow.yield_percentage.toFixed(1)}% Yield
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(flow.recorded_at).toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Input:</span> {flow.input_quantity} {flow.input_unit}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Good:</span> {flow.output_good_quantity}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Rework:</span> {flow.output_rework_quantity}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Waste:</span> {flow.output_waste_quantity}
                      </div>
                    </div>
                    
                    {flow.notes && (
                      <div className="text-sm text-muted-foreground mt-2 p-2 bg-gray-50 rounded">
                        {flow.notes}
                      </div>
                    )}
                  </div>
                ))}
                {flowData.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No material flow recorded yet
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 mt-6">
            <Button onClick={saveFlowData} disabled={isLoading} className="flex-1">
              {isLoading ? 'Saving...' : 'Save Flow Data'}
            </Button>
            <Button variant="outline" onClick={resetCurrentFlow}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
