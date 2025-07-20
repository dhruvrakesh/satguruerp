
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, AlertTriangle, ArrowRight, Package, Zap } from "lucide-react";

interface MaterialFlowTestProps {
  uiorn: string;
}

export function MaterialFlowTest({ uiorn }: MaterialFlowTestProps) {
  const [testResults, setTestResults] = useState<any[]>([]);

  // Fetch complete material flow chain for testing
  const { data: materialFlowChain, isLoading } = useQuery({
    queryKey: ['material-flow-test', uiorn],
    queryFn: async () => {
      // Get all material flow records for this UIORN
      const { data: flowData, error: flowError } = await supabase
        .from('material_flow_tracking')
        .select('*')
        .eq('uiorn', uiorn)
        .order('recorded_at', { ascending: true });

      if (flowError) throw flowError;

      // Get all process transfers for this UIORN
      const { data: transferData, error: transferError } = await supabase
        .from('process_transfers')
        .select('*')
        .eq('uiorn', uiorn)
        .order('sent_at', { ascending: true });

      if (transferError) throw transferError;

      return {
        materialFlow: flowData || [],
        processTransfers: transferData || []
      };
    },
    enabled: !!uiorn
  });

  const runMaterialFlowTest = () => {
    if (!materialFlowChain) return;

    const processes = ['GRAVURE_PRINTING', 'LAMINATION', 'ADHESIVE_COATING', 'SLITTING', 'PACKAGING'];
    const results = [];

    processes.forEach((process, index) => {
      const processData = materialFlowChain.materialFlow.filter(flow => flow.process_stage === process);
      const incomingTransfers = materialFlowChain.processTransfers.filter(
        transfer => transfer.to_process === process && transfer.transfer_status === 'RECEIVED'
      );
      const outgoingTransfers = materialFlowChain.processTransfers.filter(
        transfer => transfer.from_process === process && transfer.transfer_status === 'SENT'
      );

      const result = {
        process,
        processIndex: index,
        hasData: processData.length > 0,
        materialRecords: processData.length,
        incomingMaterials: incomingTransfers.length,
        outgoingMaterials: outgoingTransfers.length,
        totalInput: processData.reduce((sum, item) => sum + (item.input_quantity || 0), 0),
        totalOutput: processData.reduce((sum, item) => sum + (item.output_good_quantity || 0), 0),
        totalWaste: processData.reduce((sum, item) => sum + (item.output_waste_quantity || 0), 0),
        yieldPercentage: processData.length > 0 ? 
          (processData.reduce((sum, item) => sum + (item.output_good_quantity || 0), 0) / 
           processData.reduce((sum, item) => sum + (item.input_quantity || 0), 0) * 100) : 0,
        continuityScore: 0,
        issues: []
      };

      // Check material flow continuity
      if (index > 0) {
        const previousProcess = processes[index - 1];
        const previousProcessData = materialFlowChain.materialFlow.filter(flow => flow.process_stage === previousProcess);
        const previousOutput = previousProcessData.reduce((sum, item) => sum + (item.output_good_quantity || 0), 0);
        
        if (previousOutput > 0 && result.incomingMaterials === 0) {
          result.issues.push(`No material transfer from ${previousProcess}`);
        }
      }

      // Calculate continuity score
      let score = 0;
      if (result.hasData) score += 25;
      if (result.yieldPercentage > 90) score += 25;
      if (index === 0 || result.incomingMaterials > 0) score += 25;
      if (result.totalWaste / result.totalInput < 0.1) score += 25;
      
      result.continuityScore = score;

      results.push(result);
    });

    setTestResults(results);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 70) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getStatusIcon = (score: number) => {
    if (score >= 70) return <CheckCircle className="h-4 w-4 text-green-600" />;
    return <AlertTriangle className="h-4 w-4 text-red-600" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Loading material flow test data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Material Flow Continuity Test - {uiorn}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button onClick={runMaterialFlowTest} disabled={!materialFlowChain}>
              <Package className="h-4 w-4 mr-2" />
              Run Flow Test
            </Button>
            
            {materialFlowChain && (
              <div className="text-sm text-muted-foreground">
                Found: {materialFlowChain.materialFlow.length} material records, {materialFlowChain.processTransfers.length} transfers
              </div>
            )}
          </div>

          {testResults.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Test Results:</h4>
              {testResults.map((result, index) => (
                <div key={result.process} className="relative">
                  <div className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(result.continuityScore)}
                      <div>
                        <h5 className="font-medium">{result.process.replace('_', ' ')}</h5>
                        <div className="text-sm text-muted-foreground">
                          {result.materialRecords} records • {result.incomingMaterials} incoming • {result.outgoingMaterials} outgoing
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-blue-600">
                          {result.totalInput.toFixed(1)} KG
                        </div>
                        <div className="text-muted-foreground">Input</div>
                      </div>
                      <div>
                        <div className="font-medium text-green-600">
                          {result.totalOutput.toFixed(1)} KG
                        </div>
                        <div className="text-muted-foreground">Output</div>
                      </div>
                      <div>
                        <div className="font-medium text-orange-600">
                          {result.yieldPercentage.toFixed(1)}%
                        </div>
                        <div className="text-muted-foreground">Yield</div>
                      </div>
                    </div>
                    
                    <Badge className={getScoreColor(result.continuityScore)}>
                      {result.continuityScore}% Flow Score
                    </Badge>
                  </div>
                  
                  {result.issues.length > 0 && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                      Issues: {result.issues.join(', ')}
                    </div>
                  )}
                  
                  {index < testResults.length - 1 && (
                    <div className="flex justify-center my-2">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h5 className="font-medium text-blue-800 mb-2">Overall Assessment:</h5>
                <div className="text-sm text-blue-700">
                  Average Flow Score: {(testResults.reduce((sum, r) => sum + r.continuityScore, 0) / testResults.length).toFixed(1)}%
                  <br />
                  Material Flow Continuity: {testResults.filter(r => r.continuityScore >= 70).length}/{testResults.length} processes passing
                  <br />
                  Total Issues: {testResults.reduce((sum, r) => sum + r.issues.length, 0)}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
