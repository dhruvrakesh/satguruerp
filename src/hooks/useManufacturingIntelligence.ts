import { useState, useEffect } from 'react';
import { ManufacturingIntelligenceService, ManufacturingInsight } from '@/services/manufacturingIntelligence';
import { useToast } from '@/hooks/use-toast';

interface UseManufacturingIntelligenceResult {
  insights: ManufacturingInsight[];
  analysisResults: any;
  summary: any;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  refreshInsights: () => Promise<void>;
  runInventoryAnalysis: () => Promise<void>;
  runProcessAnalysis: () => Promise<void>;
  runPredictiveAnalysis: () => Promise<void>;
  generateReport: (timeframe: '24h' | '7d' | '30d') => Promise<any>;
}

export function useManufacturingIntelligence(): UseManufacturingIntelligenceResult {
  const [insights, setInsights] = useState<ManufacturingInsight[]>([]);
  const [analysisResults, setAnalysisResults] = useState<any>({});
  const [summary, setSummary] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const { toast } = useToast();

  const refreshInsights = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await ManufacturingIntelligenceService.getRealTimeInsights();
      
      setInsights(data.insights);
      setAnalysisResults(data.analysisResults);
      setSummary(data.summary);
      setLastUpdated(data.timestamp);

      if (data.error) {
        setError(data.error);
        console.warn('Partial insights loaded with errors:', data.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load insights';
      setError(errorMessage);
      console.error('Failed to load manufacturing intelligence:', err);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runInventoryAnalysis = async () => {
    try {
      setIsLoading(true);
      const result = await ManufacturingIntelligenceService.analyzeInventory('comprehensive');
      
      toast({
        title: "Inventory Analysis Complete",
        description: `Generated ${result.insights.length} insights in ${result.executionTime}ms`,
      });

      await refreshInsights();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Inventory analysis failed';
      setError(errorMessage);
      console.error('Inventory analysis failed:', err);
      
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runProcessAnalysis = async () => {
    try {
      setIsLoading(true);
      const result = await ManufacturingIntelligenceService.analyzeProcessOptimization();
      
      toast({
        title: "Process Analysis Complete",
        description: `Generated ${result.insights.length} insights in ${result.executionTime}ms`,
      });

      await refreshInsights();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Process analysis failed';
      setError(errorMessage);
      console.error('Process analysis failed:', err);
      
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runPredictiveAnalysis = async () => {
    try {
      setIsLoading(true);
      const result = await ManufacturingIntelligenceService.generatePredictiveAnalytics();
      
      toast({
        title: "Predictive Analysis Complete",
        description: `Generated ${result.insights.length} insights in ${result.executionTime}ms`,
      });

      await refreshInsights();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Predictive analysis failed';
      setError(errorMessage);
      console.error('Predictive analysis failed:', err);
      
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateReport = async (timeframe: '24h' | '7d' | '30d') => {
    try {
      setIsLoading(true);
      const report = await ManufacturingIntelligenceService.generateIntelligenceReport(timeframe);
      
      toast({
        title: "Report Generated",
        description: `Manufacturing intelligence report for ${timeframe} generated successfully`,
      });

      return report;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Report generation failed';
      setError(errorMessage);
      console.error('Report generation failed:', err);
      
      toast({
        title: "Report Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh insights every 5 minutes
  useEffect(() => {
    refreshInsights();
    
    const interval = setInterval(refreshInsights, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    insights,
    analysisResults,
    summary,
    isLoading,
    error,
    lastUpdated,
    refreshInsights,
    runInventoryAnalysis,
    runProcessAnalysis,
    runPredictiveAnalysis,
    generateReport
  };
}