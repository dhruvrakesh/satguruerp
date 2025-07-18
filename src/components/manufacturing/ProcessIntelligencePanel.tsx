import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain, TrendingUp, Target, AlertTriangle, CheckCircle2, Zap } from "lucide-react";
import { useProcessParameters, useOptimalParameters, useProcessQualityAlerts } from "@/hooks/useProcessIntelligence";
import type { Database } from "@/integrations/supabase/types";

type ProcessStage = Database["public"]["Enums"]["process_stage"];

interface ProcessIntelligencePanelProps {
  stage: ProcessStage;
  currentItemCode?: string;
  onApplyRecommendations?: (parameters: any[]) => void;
}

export function ProcessIntelligencePanel({ 
  stage, 
  currentItemCode, 
  onApplyRecommendations 
}: ProcessIntelligencePanelProps) {
  const { data: parameters = [] } = useProcessParameters(stage);
  const { data: optimal } = useOptimalParameters(currentItemCode || "", stage);
  const { data: alerts = [] } = useProcessQualityAlerts(stage);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600 bg-green-50";
    if (confidence >= 0.5) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'high': return "border-red-500 bg-red-50";
      case 'medium': return "border-yellow-500 bg-yellow-50";
      default: return "border-blue-500 bg-blue-50";
    }
  };

  return (
    <div className="space-y-6">
      {/* Quality Alerts */}
      {alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-5 h-5" />
              Quality Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.slice(0, 3).map((alert, index) => (
                <Alert key={index} className={getAlertColor(alert.severity)}>
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span>{alert.message}</span>
                      <Badge variant={alert.severity === 'high' ? 'destructive' : 'secondary'}>
                        {alert.severity}
                      </Badge>
                    </div>
                    <div className="text-xs mt-1 text-muted-foreground">
                      Expected range: {alert.expected_range}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Process Intelligence Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Process Intelligence
          </CardTitle>
          <CardDescription>
            AI-powered recommendations based on {parameters.reduce((sum, p) => sum + p.records, 0)} historical records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-green-900">
                  {parameters.filter(p => p.variance < p.avg_value * 0.1).length}
                </div>
                <div className="text-sm text-green-700">Stable Parameters</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <div>
                <div className="font-medium text-blue-900">{parameters.length}</div>
                <div className="text-sm text-blue-700">Tracked Metrics</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50">
              <Target className="w-5 h-5 text-purple-600" />
              <div>
                <div className="font-medium text-purple-900">
                  {optimal?.recommendations.filter(r => r.confidence > 0.7).length || 0}
                </div>
                <div className="text-sm text-purple-700">High Confidence</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optimal Parameters */}
      {optimal && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Recommended Parameters
            </CardTitle>
            <CardDescription>
              For {optimal.artwork.item_name} ({optimal.artwork.item_code})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-3 rounded-lg border">
                  <div className="text-sm text-muted-foreground">Product</div>
                  <div className="font-medium">{optimal.artwork.item_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {optimal.artwork.customer_name} • {optimal.artwork.dimensions}
                  </div>
                </div>
                <div className="p-3 rounded-lg border">
                  <div className="text-sm text-muted-foreground">Specifications</div>
                  <div className="font-medium">{optimal.artwork.no_of_colours}</div>
                  <div className="text-sm text-muted-foreground">
                    {optimal.artwork.ups ? `${optimal.artwork.ups} UPS` : 'Standard layout'}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {optimal.recommendations.slice(0, 5).map((rec, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium capitalize">
                          {rec.metric.replace(/_/g, ' ')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Based on {rec.sample_size} similar jobs
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          {rec.recommended_value.toFixed(1)}
                        </div>
                        <Badge className={getConfidenceColor(rec.confidence)}>
                          {Math.round(rec.confidence * 100)}% confidence
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {onApplyRecommendations && (
                <Button 
                  onClick={() => onApplyRecommendations(optimal.recommendations)}
                  className="w-full"
                >
                  Apply Recommended Parameters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Historical Performance</CardTitle>
          <CardDescription>Parameter stability and trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {parameters.slice(0, 6).map((param, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium capitalize">
                    {param.metric.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {param.records} records • Avg: {param.avg_value.toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm">
                    ±{param.variance.toFixed(2)}
                  </div>
                  <Badge 
                    className={param.variance < param.avg_value * 0.1 ? 
                      "text-green-600 bg-green-50" : 
                      "text-yellow-600 bg-yellow-50"
                    }
                  >
                    {param.variance < param.avg_value * 0.1 ? 'Stable' : 'Variable'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}