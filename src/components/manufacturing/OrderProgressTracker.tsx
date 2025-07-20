import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useOrderMaterialProgress } from '@/hooks/useMaterialAvailability';
import { CheckCircle, Clock, Play, Package } from 'lucide-react';

interface OrderProgressTrackerProps {
  uiorn: string;
}

export const OrderProgressTracker: React.FC<OrderProgressTrackerProps> = ({
  uiorn
}) => {
  const { data: progress, isLoading } = useOrderMaterialProgress(uiorn);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Order Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading progress data...</div>
        </CardContent>
      </Card>
    );
  }

  if (!progress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Order Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">No progress data available</div>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'IN_PROGRESS':
        return <Play className="h-4 w-4 text-blue-600" />;
      case 'NOT_STARTED':
        return <Clock className="h-4 w-4 text-gray-600" />;
      default:
        return <Package className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'NOT_STARTED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {getStatusIcon(progress.status)}
            Order Progress - {uiorn}
          </span>
          <Badge className={getStatusBadgeColor(progress.status)}>
            {progress.status.replace('_', ' ')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Process Completion</span>
            <span>{progress.progress_percentage.toFixed(1)}%</span>
          </div>
          <Progress value={progress.progress_percentage} className="w-full" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Completed Processes
            </label>
            <div className="text-lg font-semibold">
              {progress.completed_processes} / {progress.total_processes}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Current Stage
            </label>
            <div className="text-lg font-semibold">
              {progress.current_stage || 'Not Started'}
            </div>
          </div>
        </div>

        {progress.status === 'IN_PROGRESS' && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm font-medium text-blue-800">
              Order is currently in progress at {progress.current_stage} stage.
            </div>
          </div>
        )}

        {progress.status === 'COMPLETED' && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm font-medium text-green-800">
              Order has completed all material flow processes successfully.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};