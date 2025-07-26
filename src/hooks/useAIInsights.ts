import { useState, useEffect } from 'react';
import { AIService, AIInsight } from '@/services/aiService';
import { useToast } from '@/hooks/use-toast';

export function useAIInsights(insightType?: string) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadInsights();
  }, [insightType]);

  const loadInsights = async () => {
    try {
      setIsLoading(true);
      const data = await AIService.getInsights(insightType);
      setInsights(data);
    } catch (error) {
      console.error('Failed to load insights:', error);
      toast({
        title: "Error",
        description: "Failed to load AI insights",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateInsights = async () => {
    try {
      setIsGenerating(true);
      const newInsights = await AIService.generateManufacturingInsights();
      setInsights(prev => [...newInsights, ...prev]);
      
      toast({
        title: "Success",
        description: `Generated ${newInsights.length} new insights`,
      });
    } catch (error) {
      console.error('Failed to generate insights:', error);
      toast({
        title: "Error",
        description: "Failed to generate insights",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const markAsRead = async (insightId: string) => {
    try {
      await AIService.markInsightAsRead(insightId);
      setInsights(prev => 
        prev.map(insight => 
          insight.id === insightId 
            ? { ...insight, is_read: true }
            : insight
        )
      );
    } catch (error) {
      console.error('Failed to mark insight as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark insight as read",
        variant: "destructive",
      });
    }
  };

  const unreadCount = insights.filter(insight => !insight.is_read).length;

  return {
    insights,
    isLoading,
    isGenerating,
    unreadCount,
    loadInsights,
    generateInsights,
    markAsRead,
  };
}