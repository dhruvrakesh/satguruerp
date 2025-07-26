import { supabase } from '@/integrations/supabase/client';

export interface ManufacturingInsight {
  type: 'critical_alert' | 'predictive_alert' | 'process_optimization' | 'quality_concern' | 'process_efficiency';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionable: boolean;
  recommendation: string;
  timestamp?: string;
}

export interface IntelligenceAnalysis {
  success: boolean;
  analysisType: string;
  queryType: string;
  executionTime: number;
  results: any;
  insights: ManufacturingInsight[];
  metadata: {
    timestamp: string;
    user_id: string;
    organization: string;
  };
}

export class ManufacturingIntelligenceService {
  /**
   * Run advanced inventory analysis with AI insights
   */
  static async analyzeInventory(analysisType: string = 'comprehensive'): Promise<IntelligenceAnalysis> {
    const { data, error } = await supabase.functions.invoke('manufacturing-intelligence', {
      body: {
        queryType: 'inventory_analysis',
        analysisType
      }
    });

    if (error) {
      throw new Error(`Inventory analysis failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Generate predictive analytics and forecasts
   */
  static async generatePredictiveAnalytics(predictionType: string = 'demand_forecast'): Promise<IntelligenceAnalysis> {
    const { data, error } = await supabase.functions.invoke('manufacturing-intelligence', {
      body: {
        queryType: 'predictive_analytics',
        analysisType: predictionType
      }
    });

    if (error) {
      throw new Error(`Predictive analysis failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Analyze process optimization opportunities
   */
  static async analyzeProcessOptimization(): Promise<IntelligenceAnalysis> {
    const { data, error } = await supabase.functions.invoke('manufacturing-intelligence', {
      body: {
        queryType: 'process_optimization',
        analysisType: 'real_time'
      }
    });

    if (error) {
      throw new Error(`Process optimization analysis failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all recent intelligence queries for dashboard
   */
  static async getRecentIntelligenceQueries(limit: number = 10) {
    const { data, error } = await supabase
      .from('satguru_ai_intelligence_queries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch intelligence queries: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get real-time manufacturing insights
   */
  static async getRealTimeInsights() {
    try {
      // Run multiple analyses in parallel for comprehensive insights
      const [inventoryAnalysis, processAnalysis, predictiveAnalysis] = await Promise.allSettled([
        this.analyzeInventory('real_time'),
        this.analyzeProcessOptimization(),
        this.generatePredictiveAnalytics('immediate_forecast')
      ]);

      const allInsights: ManufacturingInsight[] = [];
      const analysisResults = {
        inventory: null as any,
        process: null as any,
        predictive: null as any
      };

      // Collect insights from successful analyses
      if (inventoryAnalysis.status === 'fulfilled') {
        allInsights.push(...inventoryAnalysis.value.insights);
        analysisResults.inventory = inventoryAnalysis.value.results;
      }

      if (processAnalysis.status === 'fulfilled') {
        allInsights.push(...processAnalysis.value.insights);
        analysisResults.process = processAnalysis.value.results;
      }

      if (predictiveAnalysis.status === 'fulfilled') {
        allInsights.push(...predictiveAnalysis.value.insights);
        analysisResults.predictive = predictiveAnalysis.value.results;
      }

      // Sort insights by priority and timestamp
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      allInsights.sort((a, b) => {
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        const timestampA = new Date(a.timestamp || 0).getTime();
        const timestampB = new Date(b.timestamp || 0).getTime();
        return timestampB - timestampA;
      });

      return {
        insights: allInsights,
        analysisResults,
        timestamp: new Date().toISOString(),
        summary: {
          totalInsights: allInsights.length,
          criticalAlerts: allInsights.filter(i => i.priority === 'critical').length,
          highPriority: allInsights.filter(i => i.priority === 'high').length,
          actionableItems: allInsights.filter(i => i.actionable).length
        }
      };
    } catch (error) {
      console.error('Failed to get real-time insights:', error);
      return {
        insights: [],
        analysisResults: {},
        timestamp: new Date().toISOString(),
        summary: {
          totalInsights: 0,
          criticalAlerts: 0,
          highPriority: 0,
          actionableItems: 0
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate manufacturing intelligence report
   */
  static async generateIntelligenceReport(timeframe: '24h' | '7d' | '30d' = '7d') {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
      case '24h':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
    }

    const { data: queries, error } = await supabase
      .from('satguru_ai_intelligence_queries')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to generate intelligence report: ${error.message}`);
    }

    // Aggregate insights and analytics
    const report = {
      timeframe,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      summary: {
        totalQueries: queries?.length || 0,
        avgExecutionTime: queries?.reduce((sum, q) => sum + (q.execution_time_ms || 0), 0) / (queries?.length || 1),
        queryTypes: {} as Record<string, number>,
        insightTypes: {} as Record<string, number>
      },
      insights: queries?.flatMap(q => q.insights || []) || [],
      trends: this.analyzeTrends(queries || []),
      recommendations: this.generateRecommendations(queries || [])
    };

    // Aggregate query types
    queries?.forEach(query => {
      report.summary.queryTypes[query.query_type] = (report.summary.queryTypes[query.query_type] || 0) + 1;
      
      const insights = Array.isArray(query.insights) ? query.insights : [];
      insights.forEach((insight: any) => {
        if (insight && insight.type) {
          report.summary.insightTypes[insight.type] = (report.summary.insightTypes[insight.type] || 0) + 1;
        }
      });
    });

    return report;
  }

  private static analyzeTrends(queries: any[]): any {
    // Simple trend analysis
    const dailyQueries = queries.reduce((acc, query) => {
      const date = new Date(query.created_at).toDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgExecutionTimes = queries.reduce((acc, query) => {
      const date = new Date(query.created_at).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(query.execution_time_ms || 0);
      return acc;
    }, {} as Record<string, number[]>);

    return {
      queryVolume: dailyQueries,
      performanceTrends: Object.entries(avgExecutionTimes).reduce((acc, [date, times]) => {
        if (Array.isArray(times) && times.length > 0) {
          acc[date] = times.reduce((sum, time) => sum + time, 0) / times.length;
        }
        return acc;
      }, {} as Record<string, number>)
    };
  }

  private static generateRecommendations(queries: any[]): string[] {
    const recommendations = [];
    
    const recentQueries = queries.filter(q => 
      new Date(q.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    if (recentQueries.length > 20) {
      recommendations.push('High query volume detected - consider implementing caching for frequently requested analytics');
    }

    const avgExecutionTime = queries.length > 0 
      ? queries.reduce((sum, q) => sum + (q.execution_time_ms || 0), 0) / queries.length
      : 0;
    
    if (avgExecutionTime > 5000) {
      recommendations.push('Slow query performance detected - optimize database queries and consider data indexing');
    }

    const criticalInsights = queries.flatMap(q => {
      const insights = Array.isArray(q.insights) ? q.insights : [];
      return insights.filter((insight: any) => insight.priority === 'critical');
    });
    
    if (criticalInsights.length > 0) {
      recommendations.push(`${criticalInsights.length} critical manufacturing issues need immediate attention`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Manufacturing intelligence system is performing optimally');
    }

    return recommendations;
  }
}