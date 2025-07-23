
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMaterialAvailability } from "@/hooks/useMaterialAvailability";
import { useAutomatedMaterialFlow } from "@/hooks/useAutomatedMaterialFlow";
import { 
  Package, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  TrendingUp 
} from "lucide-react";

interface MaterialAvailabilityPanelProps {
  uiorn: string;
  currentProcess: string;
}

export function MaterialAvailabilityPanel({ uiorn, currentProcess }: MaterialAvailabilityPanelProps) {
  const { data: materialAvailability, isLoading } = useMaterialAvailability(uiorn, currentProcess);
  const { getUpstreamMaterials } = useAutomatedMaterialFlow(uiorn);
  const { data: upstreamMaterials } = getUpstreamMaterials(currentProcess);

  const getQualityBadge = (grade: string) => {
    const styles = {
      'GRADE_A': 'bg-green-100 text-green-800 border-green-200',
      'GRADE_B': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'REWORK': 'bg-orange-100 text-orange-800 border-orange-200',
      'WASTE': 'bg-red-100 text-red-800 border-red-200'
    };
    return styles[grade as keyof typeof styles] || styles.GRADE_A;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'TRANSFERRED': return <Clock className="h-4 w-4 text-blue-600" />;
      default: return <Package className="h-4 w-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Material Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Loading material availability...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalAvailable = materialAvailability?.reduce((sum, item) => sum + item.available_quantity, 0) || 0;
  const availableCount = materialAvailability?.filter(item => item.availability_status === 'AVAILABLE').length || 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Material Availability - {currentProcess}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {totalAvailable.toFixed(1)} KG
              </div>
              <div className="text-sm text-blue-700">Total Available</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-600">
                {availableCount}
              </div>
              <div className="text-sm text-green-700">Available Batches</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-2xl font-bold text-purple-600">
                {upstreamMaterials?.length || 0}
              </div>
              <div className="text-sm text-purple-700">Upstream Materials</div>
            </div>
          </div>

          {materialAvailability && materialAvailability.length > 0 ? (
            <div className="space-y-3">
              {materialAvailability.map((material, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(material.availability_status)}
                      <div>
                        <div className="font-medium">{material.process_stage}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(material.recorded_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getQualityBadge(material.quality_grade)}>
                        {material.quality_grade}
                      </Badge>
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          {material.available_quantity.toFixed(1)} KG
                        </div>
                        <div className="text-xs text-muted-foreground">Available</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">Availability:</span>
                    <Progress 
                      value={material.availability_status === 'AVAILABLE' ? 100 : 0} 
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">
                      {material.availability_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No materials currently available for {currentProcess}. 
                Check upstream processes or material flow continuity.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Upstream Materials Summary */}
      {upstreamMaterials && upstreamMaterials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Upstream Materials Ready for Transfer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upstreamMaterials.slice(0, 3).map((material, index) => (
                <div key={index} className="p-3 border rounded-lg bg-green-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-medium">{material.process_stage}</span>
                      <Badge className="bg-green-100 text-green-800">
                        {material.quality_grade}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">
                        {material.available_quantity.toFixed(1)} KG
                      </div>
                      <div className="text-xs text-green-700">Ready for Transfer</div>
                    </div>
                  </div>
                </div>
              ))}
              {upstreamMaterials.length > 3 && (
                <div className="text-center text-sm text-muted-foreground">
                  +{upstreamMaterials.length - 3} more materials available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
