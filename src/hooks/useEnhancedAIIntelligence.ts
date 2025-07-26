import { useState, useEffect } from 'react';
import { ManufacturingIntelligenceService } from '@/services/manufacturingIntelligence';
import type { ManufacturingInsight } from '@/services/manufacturingIntelligence';

interface UseEnhancedAIIntelligenceReturn {
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

export function useEnhancedAIIntelligence(): UseEnhancedAIIntelligenceReturn {
  const [insights, setInsights] = useState<ManufacturingInsight[]>([]);
  const [analysisResults, setAnalysisResults] = useState<any>({});
  const [summary, setSummary] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Enhanced refresh function with comprehensive data loading
  const refreshInsights = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await ManufacturingIntelligenceService.getRealTimeInsights();
      
      if (results.insights) {
        setInsights(results.insights || []);
        setAnalysisResults(results.analysisResults || {});
        setSummary(results.summary || {});
        setLastUpdated(new Date().toISOString());
      } else {
        setError('Failed to load insights');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced inventory analysis
  const runInventoryAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await ManufacturingIntelligenceService.analyzeInventory('comprehensive');
      
      if (results.success) {
        setAnalysisResults(prev => ({
          ...prev,
          inventory_intelligence: results.results
        }));
        
        // Add insights from analysis
        if (results.insights) {
          setInsights(prev => [...prev, ...results.insights]);
        }
      } else {
        setError('Inventory analysis failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inventory analysis error');
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced process analysis
  const runProcessAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await ManufacturingIntelligenceService.analyzeProcessOptimization();
      
      if (results.success) {
        setAnalysisResults(prev => ({
          ...prev,
          process_efficiency: results.results
        }));
        
        if (results.insights) {
          setInsights(prev => [...prev, ...results.insights]);
        }
      } else {
        setError('Process analysis failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Process analysis error');
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced predictive analysis
  const runPredictiveAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await ManufacturingIntelligenceService.generatePredictiveAnalytics('comprehensive');
      
      if (results.success) {
        setAnalysisResults(prev => ({
          ...prev,
          predictive_insights: results.results
        }));
        
        if (results.insights) {
          setInsights(prev => [...prev, ...results.insights]);
        }
      } else {
        setError('Predictive analysis failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Predictive analysis error');
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced report generation
  const generateReport = async (timeframe: '24h' | '7d' | '30d') => {
    setIsLoading(true);
    setError(null);
    
    try {
      const report = await ManufacturingIntelligenceService.generateIntelligenceReport(timeframe);
      
      if (report) {
        return report;
      } else {
        setError('Report generation failed');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report generation error');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh every 5 minutes
  useEffect(() => {
    refreshInsights();
    
    const interval = setInterval(() => {
      refreshInsights();
    }, 5 * 60 * 1000); // 5 minutes
    
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