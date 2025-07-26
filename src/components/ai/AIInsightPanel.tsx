import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAIInsights } from '@/hooks/useAIInsights';
import { useToast } from '@/hooks/use-toast';
import { 
  Lightbulb, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Eye,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIInsightPanelProps {
  insightType?: string;
  className?: string;
}

export function AIInsightPanel({ insightType, className }: AIInsightPanelProps) {
  const {
    insights,
    isLoading,
    isGenerating,
    unreadCount,
    generateInsights,
    markAsRead,
  } = useAIInsights(insightType);
  
  const { toast } = useToast();

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'process_optimization':
        return TrendingUp;
      case 'quality_control':
        return AlertTriangle;
      case 'analytics':
        return Lightbulb;
      default:
        return CheckCircle;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'process_optimization':
        return 'text-blue-600 bg-blue-50';
      case 'quality_control':
        return 'text-orange-600 bg-orange-50';
      case 'analytics':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-green-600 bg-green-50';
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              AI Insights
            </CardTitle>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <Button
            onClick={generateInsights}
            disabled={isGenerating}
            size="sm"
            variant="outline"
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Generate
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading insights...</p>
          </div>
        ) : insights.length === 0 ? (
          <div className="text-center py-8">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No insights available</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Generate" to create AI-powered insights
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => {
              const IconComponent = getInsightIcon(insight.insight_type);
              const isUnread = !insight.is_read;

              return (
                <Card 
                  key={insight.id}
                  className={cn(
                    "relative transition-colors hover:bg-muted/50 cursor-pointer",
                    isUnread && "border-blue-200 bg-blue-50/30"
                  )}
                  onClick={() => insight.id && markAsRead(insight.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-full",
                        getInsightColor(insight.insight_type)
                      )}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-sm">{insight.title}</h4>
                          {isUnread && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                              New
                            </Badge>
                          )}
                        </div>
                        
                        {insight.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {insight.description}
                          </p>
                        )}
                        
                        {/* Data Display */}
                        {Object.keys(insight.data).length > 0 && (
                          <div className="space-y-2 mb-3">
                            {Object.entries(insight.data).map(([key, value]) => (
                              <div key={key} className="flex justify-between text-xs">
                                <span className="text-muted-foreground capitalize">
                                  {key.replace(/_/g, ' ')}:
                                </span>
                                <span className="font-medium">
                                  {typeof value === 'string' ? value : JSON.stringify(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs">
                              {insight.insight_type.replace(/_/g, ' ')}
                            </Badge>
                            
                            {insight.confidence_score && (
                              <span className={cn(
                                "font-medium",
                                getConfidenceColor(insight.confidence_score)
                              )}>
                                {Math.round(insight.confidence_score * 100)}% confidence
                              </span>
                            )}
                          </div>
                          
                          {insight.created_at && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimeAgo(insight.created_at)}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {isUnread && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            insight.id && markAsRead(insight.id);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {insights.length > 0 && (
          <>
            <Separator />
            <div className="text-center">
              <Button variant="outline" size="sm" className="w-full">
                View All Insights
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}