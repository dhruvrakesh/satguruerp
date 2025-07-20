import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, CheckCircle, AlertTriangle } from 'lucide-react';
import { useBOMVarianceAnalysis } from '@/hooks/useMaterialAvailability';

interface BOMVariancePanelProps {
  uiorn: string;
  processStage: string;
}

export const BOMVariancePanel: React.FC<BOMVariancePanelProps> = ({
  uiorn,
  processStage
}) => {
  const { data: bomVariance, isLoading } = useBOMVarianceAnalysis(uiorn, processStage);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>BOM Variance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading variance data...</div>
        </CardContent>
      </Card>
    );
  }

  if (!bomVariance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>BOM Variance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">No BOM data available</div>
        </CardContent>
      </Card>
    );
  }

  const getVarianceIcon = (status: string) => {
    switch (status) {
      case 'WITHIN_TOLERANCE':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'OVER_CONSUMPTION':
        return <TrendingUp className="h-4 w-4 text-red-600" />;
      case 'UNDER_CONSUMPTION':
        return <TrendingDown className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getVarianceBadgeColor = (status: string) => {
    switch (status) {
      case 'WITHIN_TOLERANCE':
        return 'bg-green-100 text-green-800';
      case 'OVER_CONSUMPTION':
        return 'bg-red-100 text-red-800';
      case 'UNDER_CONSUMPTION':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getVarianceIcon(bomVariance.status)}
          BOM Variance Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Planned Consumption
            </label>
            <div className="text-lg font-semibold">
              {bomVariance.planned_consumption.toFixed(2)} KG
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Actual Consumption
            </label>
            <div className="text-lg font-semibold">
              {bomVariance.actual_consumption.toFixed(2)} KG
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Variance
            </label>
            <div className="text-lg font-semibold">
              {bomVariance.variance_percentage.toFixed(1)}%
            </div>
          </div>
          <Badge className={getVarianceBadgeColor(bomVariance.status)}>
            {bomVariance.status.replace('_', ' ')}
          </Badge>
        </div>

        {bomVariance.status !== 'WITHIN_TOLERANCE' && (
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-sm font-medium text-yellow-800">
              {bomVariance.status === 'OVER_CONSUMPTION' 
                ? 'Material overconsumption detected. Review process efficiency.'
                : 'Material underconsumption detected. Verify quantity accuracy.'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};