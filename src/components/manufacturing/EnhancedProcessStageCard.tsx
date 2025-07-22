
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  Pause, 
  CheckCircle, 
  AlertTriangle, 
  Settings,
  TrendingUp,
  Clock,
  Gauge
} from "lucide-react";

// Updated interface to match actual data structure
interface ProcessStageData {
  id: string;
  uiorn: string;
  stage: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  operator_id?: string;
  machine_id?: string;
  process_parameters?: Record<string, any>;
  quality_metrics?: Record<string, any>;
  notes?: string;
}

interface EnhancedProcessStageCardProps {
  stage: ProcessStageData;
  orderData: {
    uiorn: string;
    customer_name: string;
    product_type: string;
    substrate_type: string;
  };
  onStatusUpdate: (stage: string, status: string) => void;
  onParametersEdit: (stage: string) => void;
}

export function EnhancedProcessStageCard({ 
  stage, 
  orderData, 
  onStatusUpdate, 
  onParametersEdit 
}: EnhancedProcessStageCardProps) {
  const getStageIcon = (stageType: string) => {
    const icons: Record<string, string> = {
      'ARTWORK_UPLOAD': '🎨',
      'artwork_upload': '🎨',
      'GRAVURE_PRINTING': '🖨️',
      'gravure_printing': '🖨️',
      'LAMINATION_COATING': '📄',
      'LAMINATION': '📄',
      'lamination': '📄',
      'ADHESIVE_COATING': '🧪',
      'adhesive_coating': '🧪',
      'SLITTING_PACKING': '✂️',
      'SLITTING': '✂️',
      'slitting': '✂️',
      'PACKAGING': '📦',
      'packaging': '📦'
    };
    return icons[stageType] || '⚙️';
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'in_progress': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'on_hold': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getProcessEfficiency = () => {
    // Calculate efficiency based on quality metrics and parameters
    if (!stage.quality_metrics) return 85;
    
    let efficiency = 90;
    
    // Adjust based on quality metrics if available
    const qualityMetrics = stage.quality_metrics as any;
    if (qualityMetrics?.dimensional_accuracy?.width_variance_mm && 
        qualityMetrics.dimensional_accuracy.width_variance_mm > 0.5) {
      efficiency -= 10;
    }
    
    if (qualityMetrics?.color_accuracy?.delta_e && 
        qualityMetrics.color_accuracy.delta_e > 2) {
      efficiency -= 15;
    }
    
    return Math.max(efficiency, 60);
  };

  const renderQualityMetrics = () => {
    if (!stage.quality_metrics) return null;

    const qualityMetrics = stage.quality_metrics as any;
    const { color_accuracy, lamination_quality, coating_quality, dimensional_accuracy } = qualityMetrics;

    return (
      <div className="space-y-2 mt-3">
        <h5 className="text-xs font-medium text-muted-foreground">Quality Metrics</h5>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {color_accuracy && (
            <div className="p-2 bg-blue-50 rounded">
              <div className="font-medium">Color Accuracy</div>
              <div className="text-muted-foreground">ΔE: {color_accuracy.delta_e}</div>
            </div>
          )}
          
          {lamination_quality && (
            <div className="p-2 bg-green-50 rounded">
              <div className="font-medium">Bond Strength</div>
              <div className="text-muted-foreground">{lamination_quality.bond_strength_n_15mm} N/15mm</div>
            </div>
          )}
          
          {coating_quality && (
            <div className="p-2 bg-purple-50 rounded">
              <div className="font-medium">Coat Weight</div>
              <div className="text-muted-foreground">{coating_quality.coat_weight_gsm} GSM</div>
            </div>
          )}
          
          {dimensional_accuracy && (
            <div className="p-2 bg-orange-50 rounded">
              <div className="font-medium">Width Accuracy</div>
              <div className="text-muted-foreground">±{dimensional_accuracy.width_variance_mm} mm</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderProcessParameters = () => {
    if (!stage.process_parameters) return null;

    const params = stage.process_parameters as any;
    let paramDisplay = null;

    switch (stage.stage.toLowerCase()) {
      case 'gravure_printing':
        if (params.printing) {
          paramDisplay = (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>Speed: {params.printing.line_speed_mpm} m/min</div>
              <div>Temp: {params.printing.drying_temperature_c}°C</div>
              <div>Viscosity: {params.printing.ink_viscosity_sec}s</div>
            </div>
          );
        }
        break;
      
      case 'lamination':
      case 'lamination_coating':
        if (params.lamination) {
          paramDisplay = (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>Temp: {params.lamination.laminating_temperature_c}°C</div>
              <div>Speed: {params.lamination.line_speed_mpm} m/min</div>
              <div>Pressure: {params.lamination.nip_pressure_n_cm} N/cm</div>
            </div>
          );
        }
        break;
      
      case 'adhesive_coating':
        if (params.coating) {
          paramDisplay = (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>Weight: {params.coating.coating_weight_gsm} GSM</div>
              <div>Speed: {params.coating.coating_speed_mpm} m/min</div>
              <div>Temp: {params.coating.drying_temperature_c}°C</div>
            </div>
          );
        }
        break;
      
      case 'slitting':
      case 'slitting_packing':
        if (params.slitting) {
          paramDisplay = (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>Speed: {params.slitting.slitting_speed_mpm} m/min</div>
              <div>Width: {params.slitting.finished_width_mm} mm</div>
              <div>Tension: {params.slitting.rewind_tension_n} N</div>
            </div>
          );
        }
        break;
    }

    if (paramDisplay) {
      return (
        <div className="mt-3 p-2 bg-gray-50 rounded">
          <div className="text-xs font-medium text-muted-foreground mb-1">Process Parameters</div>
          {paramDisplay}
        </div>
      );
    }

    return null;
  };

  const efficiency = getProcessEfficiency();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className="text-lg">{getStageIcon(stage.stage)}</span>
            {stage.stage.replace(/_/g, ' ').toUpperCase()}
          </CardTitle>
          <Badge className={getStatusColor(stage.status)}>
            {stage.status.replace(/_/g, ' ').toUpperCase()}
          </Badge>
        </div>
        
        <div className="text-xs text-muted-foreground">
          {orderData.uiorn} • {orderData.substrate_type}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Process Efficiency */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Process Efficiency</span>
            <span className="text-muted-foreground">{efficiency}%</span>
          </div>
          <Progress value={efficiency} className="h-2" />
        </div>

        {/* Process Parameters */}
        {renderProcessParameters()}

        {/* Quality Metrics */}
        {renderQualityMetrics()}

        {/* Timing Information */}
        {(stage.started_at || stage.completed_at) && (
          <div className="text-xs text-muted-foreground space-y-1">
            {stage.started_at && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Started: {new Date(stage.started_at).toLocaleString()}
              </div>
            )}
            {stage.completed_at && (
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Completed: {new Date(stage.completed_at).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {stage.status === 'pending' && (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => onStatusUpdate(stage.stage, 'in_progress')}
            >
              <Play className="w-3 h-3 mr-1" />
              Start
            </Button>
          )}
          
          {stage.status === 'in_progress' && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onStatusUpdate(stage.stage, 'on_hold')}
              >
                <Pause className="w-3 h-3 mr-1" />
                Pause
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => onStatusUpdate(stage.stage, 'completed')}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Complete
              </Button>
            </>
          )}
          
          {stage.status === 'on_hold' && (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => onStatusUpdate(stage.stage, 'in_progress')}
            >
              <Play className="w-3 h-3 mr-1" />
              Resume
            </Button>
          )}
          
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onParametersEdit(stage.stage)}
          >
            <Settings className="w-3 h-3 mr-1" />
            Setup
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
