import { supabase } from '@/integrations/supabase/client';

// Material Categories with Enhanced Intelligence
export const ENHANCED_MATERIAL_CATEGORIES = {
  BOPP: {
    code: 'BOPP',
    name: 'Biaxially Oriented Polypropylene',
    keywords: ['BOPP', 'POLYPROPYLENE', 'FILM'],
    intelligence: {
      criticalMetrics: ['thickness_variation', 'clarity', 'tensile_strength'],
      qualityIndicators: ['surface_tension', 'corona_treatment'],
      processCorrelation: ['printing_quality', 'lamination_adhesion']
    }
  },
  PET: {
    code: 'PET',
    name: 'Polyethylene Terephthalate',
    keywords: ['PET', 'POLYETHYLENE', 'TEREPHTHALATE'],
    intelligence: {
      criticalMetrics: ['shrinkage', 'barrier_properties', 'clarity'],
      qualityIndicators: ['haze_level', 'gloss_retention'],
      processCorrelation: ['heat_resistance', 'chemical_resistance']
    }
  },
  INK: {
    code: 'INK',
    name: 'Printing Inks',
    keywords: ['INK', 'PIGMENT', 'COLORANT'],
    intelligence: {
      criticalMetrics: ['viscosity', 'color_strength', 'adhesion'],
      qualityIndicators: ['dot_gain', 'print_density'],
      processCorrelation: ['drying_speed', 'rub_resistance']
    }
  },
  PAPER: {
    code: 'PAPER',
    name: 'Paper Materials',
    keywords: ['PAPER', 'BOARD', 'CARDBOARD'],
    intelligence: {
      criticalMetrics: ['moisture_content', 'caliper', 'formation'],
      qualityIndicators: ['smoothness', 'opacity'],
      processCorrelation: ['printability', 'converting_performance']
    }
  },
  GRAN: {
    code: 'GRAN',
    name: 'Granules',
    keywords: ['GRAN', 'GRANULE', 'PELLET'],
    intelligence: {
      criticalMetrics: ['particle_size', 'melt_flow_index', 'density'],
      qualityIndicators: ['uniformity', 'contamination_level'],
      processCorrelation: ['extrusion_stability', 'mixing_efficiency']
    }
  },
  LDPELAM: {
    code: 'LDPELAM',
    name: 'LDPE Lamination Film',
    keywords: ['LDPE', 'LAMINATION', 'FILM'],
    intelligence: {
      criticalMetrics: ['seal_strength', 'heat_resistance', 'puncture_resistance'],
      qualityIndicators: ['dart_drop', 'elmendorf_tear'],
      processCorrelation: ['lamination_speed', 'bond_strength']
    }
  },
  CHEM: {
    code: 'CHEM',
    name: 'Chemicals',
    keywords: ['CHEMICAL', 'SOLVENT', 'ADDITIVE'],
    intelligence: {
      criticalMetrics: ['purity', 'ph_level', 'concentration'],
      qualityIndicators: ['stability', 'compatibility'],
      processCorrelation: ['reaction_rate', 'environmental_impact']
    }
  }
};

export interface MaterialIntelligence {
  category: string;
  totalItems: number;
  activeItems: number;
  healthScore: number;
  qualityTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  velocityClass: 'FAST' | 'MEDIUM' | 'SLOW' | 'STAGNANT';
  topItems: Array<{
    itemCode: string;
    itemName: string;
    velocity: number;
    healthScore: number;
  }>;
  criticalItems: Array<{
    itemCode: string;
    itemName: string;
    issue: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  outliers: Array<{
    itemCode: string;
    metric: string;
    currentValue: number;
    expectedValue: number;
    deviationPercent: number;
  }>;
  crossCorrelations: Array<{
    relatedCategory: string;
    correlationStrength: number;
    impact: string;
  }>;
}

export interface MaterialInsight {
  type: 'performance' | 'quality' | 'optimization' | 'alert';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  title: string;
  message: string;
  recommendation: string;
  actionable: boolean;
  metadata: {
    affectedItems?: number;
    potentialImpact?: string;
    timeToAction?: string;
  };
}

export interface UserIntelligenceSession {
  sessionId: string;
  userId: string;
  preferredCategories: string[];
  viewedInsights: string[];
  actionsTaken: string[];
  personalizedRecommendations: string[];
  lastActivity: string;
}

export class EnhancedCategoryIntelligenceService {
  
  /**
   * Get comprehensive material intelligence with outlier detection
   */
  static async getMaterialIntelligence(): Promise<{
    materialAnalysis: Record<string, MaterialIntelligence>;
    crossCategoryInsights: MaterialInsight[];
    outlierAlerts: MaterialInsight[];
    executiveSummary: {
      totalCategories: number;
      healthyCategories: number;
      criticalCategories: number;
      totalOutliers: number;
      topRecommendations: string[];
    };
  }> {
    try {
      // Fetch stock data for analysis
      const { data: stockData, error } = await supabase
        .from('satguru_stock_summary_view')
        .select('*');

      if (error) throw error;

      // Analyze each material category
      const materialAnalysis: Record<string, MaterialIntelligence> = {};
      const allOutliers: any[] = [];
      
      for (const [categoryCode, categoryInfo] of Object.entries(ENHANCED_MATERIAL_CATEGORIES)) {
        const categoryItems = stockData?.filter(item => 
          this.identifyMaterialCategory(item.item_code, item.item_name) === categoryCode
        ) || [];

        const analysis = await this.analyzeMaterialCategory(categoryCode, categoryItems);
        materialAnalysis[categoryCode] = analysis;
        
        // Collect outliers for cross-category analysis
        allOutliers.push(...analysis.outliers.map(outlier => ({
          ...outlier,
          category: categoryCode
        })));
      }

      // Generate cross-category insights
      const crossCategoryInsights = this.generateCrossCategoryInsights(materialAnalysis);
      
      // Create outlier alerts
      const outlierAlerts = this.generateOutlierAlerts(allOutliers);

      // Executive summary
      const healthyCategories = Object.values(materialAnalysis).filter(m => m.healthScore >= 80).length;
      const criticalCategories = Object.values(materialAnalysis).filter(m => m.healthScore < 60).length;

      return {
        materialAnalysis,
        crossCategoryInsights,
        outlierAlerts,
        executiveSummary: {
          totalCategories: Object.keys(materialAnalysis).length,
          healthyCategories,
          criticalCategories,
          totalOutliers: allOutliers.length,
          topRecommendations: this.generateExecutiveRecommendations(materialAnalysis)
        }
      };
    } catch (error) {
      console.error('Failed to get material intelligence:', error);
      throw error;
    }
  }

  /**
   * Analyze specific material category with deep intelligence
   */
  private static async analyzeMaterialCategory(category: string, items: any[]): Promise<MaterialIntelligence> {
    const totalItems = items.length;
    const activeItems = items.filter(item => (item.current_qty || 0) > 0).length;
    
    // Calculate health score based on multiple factors
    const healthScore = this.calculateCategoryHealthScore(items);
    
    // Determine velocity and trend
    const velocityClass = this.calculateVelocityClass(items);
    const qualityTrend = this.calculateQualityTrend(items);
    
    // Identify top performers and critical items
    const topItems = this.identifyTopPerformers(items).slice(0, 5);
    const criticalItems = this.identifyCriticalItems(items);
    
    // Detect outliers using statistical analysis
    const outliers = this.detectStatisticalOutliers(items);
    
    // Generate cross-correlations
    const crossCorrelations = this.generateCrossCorrelations(category, items);

    return {
      category,
      totalItems,
      activeItems,
      healthScore,
      qualityTrend,
      velocityClass,
      topItems,
      criticalItems,
      outliers,
      crossCorrelations
    };
  }

  /**
   * Identify material category using enhanced logic
   */
  private static identifyMaterialCategory(itemCode: string, itemName: string): string {
    const text = `${itemCode} ${itemName}`.toUpperCase();
    
    for (const [category, info] of Object.entries(ENHANCED_MATERIAL_CATEGORIES)) {
      if (info.keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }
    
    return 'OTHER';
  }

  /**
   * Calculate comprehensive health score
   */
  private static calculateCategoryHealthScore(items: any[]): number {
    if (items.length === 0) return 0;
    
    let totalScore = 0;
    let scoreCount = 0;
    
    items.forEach(item => {
      let itemScore = 50; // Base score
      
      // Stock availability factor
      const currentQty = item.current_qty || 0;
      if (currentQty > 0) itemScore += 20;
      if (currentQty > 100) itemScore += 10;
      
      // Recent activity factor
      if (item.last_transaction_date) {
        const daysSinceLastTransaction = Math.floor(
          (Date.now() - new Date(item.last_transaction_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceLastTransaction <= 7) itemScore += 20;
        else if (daysSinceLastTransaction <= 30) itemScore += 10;
      }
      
      totalScore += Math.min(itemScore, 100);
      scoreCount++;
    });
    
    return Math.round(totalScore / scoreCount);
  }

  /**
   * Calculate velocity class using advanced metrics
   */
  private static calculateVelocityClass(items: any[]): 'FAST' | 'MEDIUM' | 'SLOW' | 'STAGNANT' {
    const activeItems = items.filter(item => (item.current_qty || 0) > 0);
    const recentActivity = items.filter(item => {
      if (!item.last_transaction_date) return false;
      const daysSince = Math.floor(
        (Date.now() - new Date(item.last_transaction_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSince <= 30;
    });
    
    const activityRatio = activeItems.length > 0 ? recentActivity.length / activeItems.length : 0;
    
    if (activityRatio >= 0.8) return 'FAST';
    if (activityRatio >= 0.5) return 'MEDIUM';
    if (activityRatio >= 0.2) return 'SLOW';
    return 'STAGNANT';
  }

  /**
   * Calculate quality trend
   */
  private static calculateQualityTrend(items: any[]): 'IMPROVING' | 'STABLE' | 'DECLINING' {
    // Simplified trend analysis - in production, this would analyze historical quality data
    const healthScore = this.calculateCategoryHealthScore(items);
    
    if (healthScore >= 85) return 'IMPROVING';
    if (healthScore >= 70) return 'STABLE';
    return 'DECLINING';
  }

  /**
   * Identify top performing items
   */
  private static identifyTopPerformers(items: any[]): Array<{
    itemCode: string;
    itemName: string;
    velocity: number;
    healthScore: number;
  }> {
    return items
      .map(item => ({
        itemCode: item.item_code,
        itemName: item.item_name || 'Unknown',
        velocity: this.calculateItemVelocity(item),
        healthScore: this.calculateItemHealthScore(item)
      }))
      .sort((a, b) => b.healthScore - a.healthScore);
  }

  /**
   * Identify critical items needing attention
   */
  private static identifyCriticalItems(items: any[]): Array<{
    itemCode: string;
    itemName: string;
    issue: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }> {
    const criticalItems: any[] = [];
    
    items.forEach(item => {
      const currentQty = item.current_qty || 0;
      const minStock = item.min_stock || 0;
      
      if (currentQty === 0) {
        criticalItems.push({
          itemCode: item.item_code,
          itemName: item.item_name || 'Unknown',
          issue: 'Out of stock',
          severity: 'HIGH' as const
        });
      } else if (currentQty <= minStock) {
        criticalItems.push({
          itemCode: item.item_code,
          itemName: item.item_name || 'Unknown',
          issue: 'Low stock level',
          severity: 'MEDIUM' as const
        });
      }
    });
    
    return criticalItems.slice(0, 10); // Limit to top 10 critical items
  }

  /**
   * Detect statistical outliers
   */
  private static detectStatisticalOutliers(items: any[]): Array<{
    itemCode: string;
    metric: string;
    currentValue: number;
    expectedValue: number;
    deviationPercent: number;
  }> {
    const outliers: any[] = [];
    
    if (items.length < 3) return outliers; // Need minimum data for statistical analysis
    
    // Analyze stock quantity outliers
    const quantities = items.map(item => item.current_qty || 0).filter(qty => qty > 0);
    if (quantities.length > 0) {
      const mean = quantities.reduce((sum, qty) => sum + qty, 0) / quantities.length;
      const stdDev = Math.sqrt(
        quantities.reduce((sum, qty) => sum + Math.pow(qty - mean, 2), 0) / quantities.length
      );
      
      items.forEach(item => {
        const qty = item.current_qty || 0;
        if (qty > 0 && Math.abs(qty - mean) > 2 * stdDev) {
          const deviationPercent = Math.round(((qty - mean) / mean) * 100);
          outliers.push({
            itemCode: item.item_code,
            metric: 'stock_quantity',
            currentValue: qty,
            expectedValue: Math.round(mean),
            deviationPercent: Math.abs(deviationPercent)
          });
        }
      });
    }
    
    return outliers.slice(0, 10); // Limit to top 10 outliers
  }

  /**
   * Generate cross-correlations between categories
   */
  private static generateCrossCorrelations(category: string, items: any[]): Array<{
    relatedCategory: string;
    correlationStrength: number;
    impact: string;
  }> {
    // Simplified correlation analysis
    const correlations = [];
    
    if (category === 'INK') {
      correlations.push({
        relatedCategory: 'BOPP',
        correlationStrength: 0.85,
        impact: 'Ink viscosity directly affects BOPP print quality and adhesion'
      });
    }
    
    if (category === 'PAPER') {
      correlations.push({
        relatedCategory: 'INK',
        correlationStrength: 0.78,
        impact: 'Paper moisture content affects ink absorption and print quality'
      });
    }
    
    return correlations;
  }

  /**
   * Generate cross-category insights
   */
  private static generateCrossCategoryInsights(materialAnalysis: Record<string, MaterialIntelligence>): MaterialInsight[] {
    const insights: MaterialInsight[] = [];
    
    // Check for correlated issues across categories
    const criticalCategories = Object.entries(materialAnalysis)
      .filter(([_, analysis]) => analysis.healthScore < 60)
      .map(([category, _]) => category);
    
    if (criticalCategories.length >= 2) {
      insights.push({
        type: 'alert',
        priority: 'HIGH',
        category: 'CROSS_CATEGORY',
        title: 'Multiple Category Performance Issues',
        message: `${criticalCategories.length} material categories showing poor health scores`,
        recommendation: 'Investigate supply chain disruptions or quality control processes',
        actionable: true,
        metadata: {
          affectedItems: criticalCategories.length,
          potentialImpact: 'Production delays and quality issues',
          timeToAction: 'Immediate'
        }
      });
    }
    
    return insights;
  }

  /**
   * Generate outlier alerts
   */
  private static generateOutlierAlerts(outliers: any[]): MaterialInsight[] {
    const alerts: MaterialInsight[] = [];
    
    if (outliers.length > 5) {
      alerts.push({
        type: 'alert',
        priority: 'MEDIUM',
        category: 'OUTLIER_DETECTION',
        title: 'Statistical Anomalies Detected',
        message: `${outliers.length} material items showing unusual patterns`,
        recommendation: 'Review inventory management and demand forecasting processes',
        actionable: true,
        metadata: {
          affectedItems: outliers.length,
          potentialImpact: 'Inventory optimization opportunities',
          timeToAction: '24-48 hours'
        }
      });
    }
    
    return alerts;
  }

  /**
   * Generate executive recommendations
   */
  private static generateExecutiveRecommendations(materialAnalysis: Record<string, MaterialIntelligence>): string[] {
    const recommendations: string[] = [];
    
    const avgHealthScore = Object.values(materialAnalysis)
      .reduce((sum, analysis) => sum + analysis.healthScore, 0) / Object.keys(materialAnalysis).length;
    
    if (avgHealthScore < 70) {
      recommendations.push('Implement enhanced quality control measures across material categories');
    }
    
    const stagnantCategories = Object.values(materialAnalysis)
      .filter(analysis => analysis.velocityClass === 'STAGNANT').length;
    
    if (stagnantCategories > 0) {
      recommendations.push('Review demand planning for slow-moving material categories');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Material intelligence shows healthy performance across all categories');
    }
    
    return recommendations;
  }

  /**
   * Calculate item velocity
   */
  private static calculateItemVelocity(item: any): number {
    // Simplified velocity calculation
    const currentQty = item.current_qty || 0;
    if (currentQty === 0) return 0;
    
    return Math.random() * 100; // Placeholder for actual velocity calculation
  }

  /**
   * Calculate item health score
   */
  private static calculateItemHealthScore(item: any): number {
    let score = 50;
    
    if ((item.current_qty || 0) > 0) score += 30;
    if (item.last_transaction_date) {
      const daysSince = Math.floor(
        (Date.now() - new Date(item.last_transaction_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince <= 7) score += 20;
    }
    
    return Math.min(score, 100);
  }

  /**
   * Store daily intelligence snapshot
   */
  static async storeDailySnapshot(materialAnalysis: Record<string, MaterialIntelligence>, insights: MaterialInsight[]): Promise<void> {
    try {
      const snapshot = {
        snapshot_date: new Date().toISOString().split('T')[0],
        material_insights: materialAnalysis,
        category_analysis: materialAnalysis,
        total_insights: insights.length,
        critical_alerts: insights.filter(i => i.priority === 'CRITICAL').length,
        actionable_items: insights.filter(i => i.actionable).length,
        inventory_health_score: Object.values(materialAnalysis)
          .reduce((sum, analysis) => sum + analysis.healthScore, 0) / Object.keys(materialAnalysis).length,
        process_efficiency_score: 85, // Placeholder
        quality_score: 88, // Placeholder
        overall_intelligence_score: 82, // Placeholder
        outliers_detected: insights.filter(i => i.type === 'alert'),
        cross_correlations: {},
        executive_summary: {
          totalCategories: Object.keys(materialAnalysis).length,
          performanceTrend: 'stable',
          keyRecommendations: insights.slice(0, 3).map(i => i.recommendation)
        }
      };

      const { error } = await supabase
        .from('ai_intelligence_snapshots')
        .upsert(snapshot, { onConflict: 'snapshot_date' });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to store daily snapshot:', error);
      throw error;
    }
  }

  /**
   * Get historical intelligence data
   */
  static async getHistoricalIntelligence(startDate: string, endDate: string) {
    try {
      const { data, error } = await supabase
        .from('ai_intelligence_snapshots')
        .select('*')
        .gte('snapshot_date', startDate)
        .lte('snapshot_date', endDate)
        .order('snapshot_date', { ascending: false });

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Failed to get historical intelligence:', error);
      throw error;
    }
  }

  /**
   * Track user session activity
   */
  static async trackUserSession(sessionData: Partial<UserIntelligenceSession>): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_user_session_activity', {
        p_session_data: sessionData
      });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to track user session:', error);
      throw error;
    }
  }
}