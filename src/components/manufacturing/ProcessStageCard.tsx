
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, CheckCircle, Settings, Clock } from "lucide-react";
import { MANUFACTURING_CONFIG } from "@/config/manufacturing";
import type { ProcessStage, ProcessStatus } from "@/config/manufacturing";

interface ProcessStageCardProps {
  stage: ProcessStage;
  status: ProcessStatus;
  orderId: string;
  progress?: number;
  onStatusUpdate: (stage: ProcessStage, status: ProcessStatus) => void;
  onParametersEdit: (stage: ProcessStage) => void;
  children?: React.ReactNode;
}

export function ProcessStageCard({ 
  stage, 
  status, 
  orderId,
  progress = 0,
  onStatusUpdate, 
  onParametersEdit,
  children
}: ProcessStageCardProps) {
  const getStageIcon = (stageType: ProcessStage) => {
    const icons = {
      [MANUFACTURING_CONFIG.PROCESS_STAGES.ARTWORK_UPLOAD]: '🎨',
      [MANUFACTURING_CONFIG.PROCESS_STAGES.GRAVURE_PRINTING]: '🖨️',
      [MANUFACTURING_CONFIG.PROCESS_STAGES.LAMINATION]: '📄',
      [MANUFACTURING_CONFIG.PROCESS_STAGES.ADHESIVE_COATING]: '🧪',
      [MANUFACTURING_CONFIG.PROCESS_STAGES.SLITTING]: '✂️',
      [MANUFACTURING_CONFIG.PROCESS_STAGES.PACKAGING]: '📦'
    };
    return icons[stageType] || '⚙️';
  };

  const getStatusColor = (status: ProcessStatus) => {
    switch (status) {
      case MANUFACTURING_CONFIG.PROCESS_STATUS.COMPLETED: return 'text-green-600 bg-green-50 border-green-200';
      case MANUFACTURING_CONFIG.PROCESS_STATUS.IN_PROGRESS: return 'text-blue-600 bg-blue-50 border-blue-200';
      case MANUFACTURING_CONFIG.PROCESS_STATUS.ON_HOLD: return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusActions = () => {
    switch (status) {
      case MANUFACTURING_CONFIG.PROCESS_STATUS.PENDING:
        return (
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => onStatusUpdate(stage, MANUFACTURING_CONFIG.PROCESS_STATUS.IN_PROGRESS)}
          >
            <Play className="w-3 h-3 mr-1" />
            Start
          </Button>
        );
      
      case MANUFACTURING_CONFIG.PROCESS_STATUS.IN_PROGRESS:
        return (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onStatusUpdate(stage, MANUFACTURING_CONFIG.PROCESS_STATUS.ON_HOLD)}
            >
              <Pause className="w-3 h-3 mr-1" />
              Pause
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => onStatusUpdate(stage, MANUFACTURING_CONFIG.PROCESS_STATUS.COMPLETED)}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Complete
            </Button>
          </>
        );
      
      case MANUFACTURING_CONFIG.PROCESS_STATUS.ON_HOLD:
        return (
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => onStatusUpdate(stage, MANUFACTURING_CONFIG.PROCESS_STATUS.IN_PROGRESS)}
          >
            <Play className="w-3 h-3 mr-1" />
            Resume
          </Button>
        );
      
      default:
        return null;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className="text-lg">{getStageIcon(stage)}</span>
            {stage.replace('_', ' ').toUpperCase()}
          </CardTitle>
          <Badge className={getStatusColor(status)}>
            {status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
        
        <div className="text-xs text-muted-foreground">
          Order: {orderId}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {progress > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Progress</span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Custom Content */}
        {children}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {getStatusActions()}
          
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onParametersEdit(stage)}
          >
            <Settings className="w-3 h-3 mr-1" />
            Setup
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
