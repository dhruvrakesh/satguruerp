
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMaterialAvailability } from "@/hooks/useMaterialAvailability";
import { useAutomatedMaterialFlow } from "@/hooks/useAutomatedMaterialFlow";
import { 
  ArrowRight, 
  Package, 
  CheckCircle,
  AlertTriangle,
  Clock,
  Zap,
  RefreshCw,
  Workflow
} from "lucide-react";

interface MaterialFlowContinuityProps {
  uiorn: string;
  currentProcess: string;
  onMaterialReceived?: (materialData: any) => void;
}

const PROCESS_SEQUENCE = [
  'GRAVURE_PRINTING',
  'LAMINATION', 
  'ADHESIVE_COATING',
  'SLITTING',
  'PACKAGING'
];

interface AvailableMaterial {
  id: string;
  fromProcess: string;
  materialType: string;
  quantity: number;
  qualityGrade: string;
  recordedAt: string;
  transferStatus: 'AVAILABLE' | 'RESERVED' | 'TRANSFERRED';
}

export function MaterialFlowContinuity({ 
  uiorn, 
  currentProcess, 
  onMaterialReceived 
}: MaterialFlowContinuityProps) {
  const [availableMaterials, setAvailableMaterials] = useState<AvailableMaterial[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get previous process in sequence
  const currentProcessIndex = PROCESS_SEQUENCE.indexOf(currentProcess);
  const previousProcess = currentProcessIndex > 0 ? PROCESS_SEQUENCE[currentProcessIndex - 1] : null;

  // Enhanced automated material flow
  const { 
    getUpstreamMaterials, 
    autoTransferMutation, 
    validateMaterialFlowQuery, 
    materialFlowContinuityQuery 
  } = useAutomatedMaterialFlow(uiorn);

  // Get upstream materials using new automated system
  const { data: upstreamMaterials = [], isLoading: isLoadingUpstream } = getUpstreamMaterials(currentProcess);
  
  // Material flow validation
  const { data: flowValidation } = validateMaterialFlowQuery;

  // Use the new material availability hook for real-time data (fallback)
  const { data: materialAvailabilityData, isLoading } = useMaterialAvailability(
    uiorn, 
    previousProcess || undefined
  );

  // Check for existing transfers
  const { data: existingTransfers } = useQuery({
    queryKey: ['existing-transfers', uiorn, currentProcess],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('process_transfers')
        .select('*')
        .eq('uiorn', uiorn)
        .eq('to_process', currentProcess);
      
      if (error) throw error;
      return data || [];
    },
    enabled: true
  });

  // Process material availability
  useEffect(() => {
    if (materialAvailabilityData && existingTransfers) {
      const available = materialAvailabilityData
        .filter(material => material.availability_status === 'AVAILABLE')
        .map(material => ({
          id: material.uiorn + '_' + material.process_stage,
          fromProcess: material.process_stage,
          materialType: 'Material', // Default type, can be enhanced later
          quantity: material.available_quantity,
          qualityGrade: material.quality_grade,
          recordedAt: material.recorded_at,
          transferStatus: 'AVAILABLE' as const
        }));

      setAvailableMaterials(available);
    }
  }, [materialAvailabilityData, existingTransfers]);

  // Create material transfer mutation
  const createTransferMutation = useMutation({
    mutationFn: async (materialIds: string[]) => {
      const transfers = materialIds.map(async (materialId) => {
        const material = availableMaterials.find(m => m.id === materialId);
        if (!material) throw new Error(`Material ${materialId} not found`);

        const { data, error } = await supabase
          .from('process_transfers')
          .insert({
            uiorn,
            from_process: material.fromProcess,
            to_process: currentProcess,
            material_type: material.materialType,
            quantity_sent: material.quantity,
            quality_notes: `Grade ${material.qualityGrade}`,
            transfer_status: 'SENT',
            sent_at: new Date().toISOString(),
            unit_of_measure: 'KG'
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      });

      return Promise.all(transfers);
    },
    onSuccess: (transfers) => {
      toast({
        title: "Material Transfer Initiated",
        description: `${transfers.length} material(s) transferred from ${previousProcess} to ${currentProcess}`,
      });
      
      // Clear selections
      setSelectedMaterials([]);
      
      // Refetch data
      queryClient.invalidateQueries({ queryKey: ['available-materials'] });
      queryClient.invalidateQueries({ queryKey: ['existing-transfers'] });
      
      // Notify parent component
      onMaterialReceived?.(transfers);
    },
    onError: (error) => {
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Receive material mutation
  const receiveMaterialMutation = useMutation({
    mutationFn: async (transferId: string) => {
      // First get the transfer record to get quantity_sent
      const { data: transfer, error: fetchError } = await supabase
        .from('process_transfers')
        .select('quantity_sent')
        .eq('id', transferId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Then update the transfer with received status
      const { data, error } = await supabase
        .from('process_transfers')
        .update({
          transfer_status: 'RECEIVED',
          received_at: new Date().toISOString(),
          quantity_received: transfer.quantity_sent || 0
        })
        .eq('id', transferId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Material Received",
        description: "Material successfully received and ready for processing",
      });
      queryClient.invalidateQueries({ queryKey: ['existing-transfers'] });
    }
  });

  const handleMaterialSelection = (materialId: string) => {
    setSelectedMaterials(prev => 
      prev.includes(materialId) 
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    );
  };

  const handleTransferMaterials = () => {
    if (selectedMaterials.length === 0) return;
    createTransferMutation.mutate(selectedMaterials);
  };

  const getQualityGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-100 text-green-800 border-green-200';
      case 'B': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'REWORK': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!previousProcess) {
    return (
      <Card>
        <CardContent className="text-center p-6">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">First Process Stage</h3>
          <p className="text-muted-foreground">
            {currentProcess} is the first process in the chain. Use RM Consumption to track raw material usage.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Material Flow Status with Validation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            Enhanced Material Flow Continuity: {previousProcess} → {currentProcess}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {upstreamMaterials.length || availableMaterials.length}
              </div>
              <div className="text-sm text-muted-foreground">Available Materials</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {(upstreamMaterials.reduce((sum, m) => sum + m.available_quantity, 0) || 
                  availableMaterials.reduce((sum, m) => sum + m.quantity, 0)).toFixed(1)} KG
              </div>
              <div className="text-sm text-muted-foreground">Total Quantity</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {existingTransfers?.filter(t => t.transfer_status === 'SENT').length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Pending Transfers</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {flowValidation?.is_valid ? '✓' : flowValidation?.gaps_found || '?'}
              </div>
              <div className="text-sm text-muted-foreground">Flow Validation</div>
            </div>
          </div>

          {/* Flow validation status */}
          {flowValidation && !flowValidation.is_valid && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Material flow validation found {flowValidation.gaps_found} issue(s). 
                <Button 
                  variant="link" 
                  size="sm" 
                  className="p-0 h-auto ml-2"
                  onClick={() => console.log('Flow gaps:', flowValidation.process_gaps)}
                >
                  View Details
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Auto-transfer all materials button */}
          {upstreamMaterials.length > 0 && (
            <div className="mt-4 p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-primary">🚀 Smart Material Flow Active</h4>
                  <p className="text-sm text-muted-foreground">
                    {upstreamMaterials.length} upstream materials detected with automated transfer capability
                  </p>
                </div>
                <Button
                  onClick={() => autoTransferMutation.mutate({
                    fromProcess: previousProcess!,
                    toProcess: currentProcess,
                  })}
                  disabled={autoTransferMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  {autoTransferMutation.isPending ? 'Transferring...' : 'Auto-Transfer All'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Available Materials for Transfer */}
      {(upstreamMaterials.length > 0 || availableMaterials.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Enhanced Materials from {previousProcess}
              <Badge variant="secondary">{upstreamMaterials.length || availableMaterials.length} available</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Render upstream materials first (enhanced) */}
              {upstreamMaterials.map((material, index) => (
                <div
                  key={`upstream-${index}`}
                  className="p-4 border-2 border-primary/20 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded border-2 border-primary bg-primary/20">
                        <Zap className="w-3 h-3 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-primary">{material.material_type}</div>
                        <div className="text-sm text-muted-foreground">
                          Auto-detected • Recorded: {new Date(material.recorded_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        Grade {material.quality_grade}
                      </Badge>
                      <div className="text-right">
                        <div className="font-bold text-lg text-primary">{material.available_quantity.toFixed(1)} KG</div>
                        <div className="text-sm text-muted-foreground">Auto-transferable</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Fallback to legacy materials if no upstream detected */}
              {upstreamMaterials.length === 0 && availableMaterials.map((material) => (
                <div
                  key={material.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedMaterials.includes(material.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleMaterialSelection(material.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded border-2 ${
                        selectedMaterials.includes(material.id)
                          ? 'bg-primary border-primary'
                          : 'border-gray-300'
                      }`}>
                        {selectedMaterials.includes(material.id) && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{material.materialType}</div>
                        <div className="text-sm text-muted-foreground">
                          Recorded: {new Date(material.recordedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getQualityGradeColor(material.qualityGrade)}>
                        Grade {material.qualityGrade}
                      </Badge>
                      <div className="text-right">
                        <div className="font-bold text-lg">{material.quantity.toFixed(1)} KG</div>
                        <div className="text-sm text-muted-foreground">Available</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
              {selectedMaterials.length > 0 && upstreamMaterials.length === 0 && (
                <div className="mt-4 p-4 bg-primary/5 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Selected: {selectedMaterials.length} materials</div>
                      <div className="text-sm text-muted-foreground">
                        Total: {availableMaterials
                          .filter(m => selectedMaterials.includes(m.id))
                          .reduce((sum, m) => sum + m.quantity, 0).toFixed(1)} KG
                      </div>
                    </div>
                    <Button 
                      onClick={handleTransferMaterials}
                      disabled={createTransferMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      <Zap className="h-4 w-4" />
                      {createTransferMutation.isPending ? 'Transferring...' : 'Transfer Materials'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Enhanced info for automated materials */}
              {upstreamMaterials.length > 0 && (
                <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-green-800 mb-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Enhanced Material Flow Active</span>
                  </div>
                  <div className="text-sm text-green-700">
                    Materials are automatically validated and ready for seamless transfer. 
                    Use the "Auto-Transfer All" button above for instant processing.
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* Pending Transfers */}
      {existingTransfers && existingTransfers.filter(t => t.transfer_status === 'SENT').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Pending Material Transfers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {existingTransfers
                .filter(t => t.transfer_status === 'SENT')
                .map((transfer) => (
                  <div key={transfer.id} className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{transfer.material_type}</div>
                        <div className="text-sm text-muted-foreground">
                          From: {transfer.from_process} • Sent: {new Date(transfer.sent_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-bold">{transfer.quantity_sent?.toFixed(1)} KG</div>
                          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                            {transfer.quality_notes || 'Grade A'}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => receiveMaterialMutation.mutate(transfer.id)}
                          disabled={receiveMaterialMutation.isPending}
                        >
                          Receive
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Materials Available - Enhanced */}
      {!isLoading && !isLoadingUpstream && upstreamMaterials.length === 0 && availableMaterials.length === 0 && !existingTransfers?.some(t => t.transfer_status === 'SENT') && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No materials available from {previousProcess} for UIORN {uiorn}. 
            <br />
            • Ensure the previous process ({previousProcess}) has been completed
            • Verify materials are recorded with good output quantity greater than 0
            • Check that quality grade is GRADE_A or GRADE_B
            <Button 
              variant="link" 
              size="sm" 
              className="p-0 h-auto ml-2"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
