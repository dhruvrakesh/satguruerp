import { supabase } from '@/integrations/supabase/client';

// Material categories for manufacturing intelligence
export const MATERIAL_CATEGORIES = {
  BOPP: ['BOPP', 'BOPPMAT', 'BOPP_'],
  PET: ['PET', 'PETMAT', 'PET_'],
  INK: ['INK', 'INKMAT', 'INK_', 'SOLVENT'],
  PAPER: ['PAPER', 'PAPERMAT', 'PAPER_'],
  GRAN: ['GRAN', 'GRANULE', 'PELLET'],
  LDPELAM: ['LDPE', 'LAMINATE', 'LDPELAM'],
  CHEM: ['CHEM', 'CHEMICAL', 'ADDITIVE'],
  ADHESIVE: ['ADHES', 'GLUE', 'BONDING'],
  FOIL: ['FOIL', 'ALUMINUM', 'METALIZED'],
  COATING: ['COATING', 'PRIMER', 'BARRIER']
};

export interface CategoryMovement {
  category: string;
  total_items: number;
  active_items: number;
  low_stock_items: number;
  out_of_stock_items: number;
  avg_turnover: number;
  total_value: number;
  movement_velocity: 'FAST' | 'MEDIUM' | 'SLOW' | 'STAGNANT';
  health_score: number;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  top_items: Array<{
    item_code: string;
    item_name: string;
    current_qty: number;
    movement_frequency: number;
  }>;
  critical_items: Array<{
    item_code: string;
    item_name: string;
    status: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'OVERSTOCK';
    days_cover: number;
  }>;
}

export interface CategoryInsight {
  category: string;
  type: 'performance' | 'alert' | 'optimization' | 'trend';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  recommendation: string;
  metrics: {
    current_value: number;
    target_value: number;
    trend: string;
  };
  action_items: string[];
}

export class CategoryIntelligenceService {
  /**
   * Analyze stock movement patterns by material categories
   */
  static async analyzeCategoryMovements(): Promise<{
    movements: CategoryMovement[];
    insights: CategoryInsight[];
    summary: {
      total_categories: number;
      high_performing: number;
      needs_attention: number;
      critical_issues: number;
    };
  }> {
    try {
      // Get comprehensive stock and movement data
      const { data: stockData, error: stockError } = await supabase
        .from('satguru_stock_summary_view')
        .select('*');

      if (stockError) throw stockError;

      // Get recent movement data (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: grnData } = await supabase
        .from('satguru_grn_log')
        .select('item_code, qty_received, date')
        .gte('date', thirtyDaysAgo);

      const { data: issueData } = await supabase
        .from('satguru_issue_log')
        .select('item_code, qty_issued, date')
        .gte('date', thirtyDaysAgo);

      // Categorize items and calculate metrics
      const categoryMetrics = this.categorizeAndAnalyze(stockData || [], grnData || [], issueData || []);
      
      // Generate insights based on category performance
      const insights = this.generateCategoryInsights(categoryMetrics);
      
      // Calculate summary statistics
      const summary = this.calculateCategorySummary(categoryMetrics, insights);

      return {
        movements: categoryMetrics,
        insights,
        summary
      };
    } catch (error) {
      console.error('Category analysis failed:', error);
      throw new Error(`Category intelligence analysis failed: ${error.message}`);
    }
  }

  /**
   * Categorize items and calculate movement analytics
   */
  private static categorizeAndAnalyze(
    stockData: any[],
    grnData: any[],
    issueData: any[]
  ): CategoryMovement[] {
    const categoryData: Record<string, any> = {};

    // Initialize categories
    Object.keys(MATERIAL_CATEGORIES).forEach(category => {
      categoryData[category] = {
        category,
        items: [],
        total_received: 0,
        total_issued: 0,
        movement_count: 0
      };
    });

    // Categorize stock items
    stockData.forEach(item => {
      const category = this.identifyCategory(item.item_code, item.item_name);
      if (category && categoryData[category]) {
        categoryData[category].items.push(item);
      }
    });

    // Add movement data
    grnData.forEach(grn => {
      const category = this.identifyCategory(grn.item_code);
      if (category && categoryData[category]) {
        categoryData[category].total_received += grn.qty_received || 0;
        categoryData[category].movement_count++;
      }
    });

    issueData.forEach(issue => {
      const category = this.identifyCategory(issue.item_code);
      if (category && categoryData[category]) {
        categoryData[category].total_issued += issue.qty_issued || 0;
        categoryData[category].movement_count++;
      }
    });

    // Calculate metrics for each category
    return Object.values(categoryData).map((cat: any) => {
      const items = cat.items;
      const totalItems = items.length;
      const activeItems = items.filter((item: any) => item.current_qty > 0).length;
      const lowStockItems = items.filter((item: any) => 
        item.current_qty > 0 && item.current_qty <= (item.reorder_level || 10)
      ).length;
      const outOfStockItems = items.filter((item: any) => item.current_qty <= 0).length;
      
      const totalValue = items.reduce((sum: number, item: any) => 
        sum + (item.current_qty * item.unit_price || 0), 0
      );
      
      const avgTurnover = totalItems > 0 
        ? (cat.total_issued / Math.max(1, items.reduce((sum: number, item: any) => sum + item.current_qty, 0))) * 100
        : 0;
      
      const healthScore = this.calculateCategoryHealth(totalItems, activeItems, lowStockItems, outOfStockItems, avgTurnover);
      const movementVelocity = this.calculateMovementVelocity(cat.movement_count, totalItems);
      const trend = this.calculateTrend(avgTurnover, healthScore);
      
      // Get top performing items
      const topItems = items
        .filter((item: any) => item.current_qty > 0)
        .sort((a: any, b: any) => (b.current_qty * b.unit_price || 0) - (a.current_qty * a.unit_price || 0))
        .slice(0, 5)
        .map((item: any) => ({
          item_code: item.item_code,
          item_name: item.item_name,
          current_qty: item.current_qty,
          movement_frequency: cat.movement_count / Math.max(1, totalItems)
        }));

      // Get critical items
      const criticalItems = [
        ...items.filter((item: any) => item.current_qty <= 0).map((item: any) => ({
          item_code: item.item_code,
          item_name: item.item_name,
          status: 'OUT_OF_STOCK' as const,
          days_cover: 0
        })),
        ...items.filter((item: any) => 
          item.current_qty > 0 && item.current_qty <= (item.reorder_level || 10)
        ).map((item: any) => ({
          item_code: item.item_code,
          item_name: item.item_name,
          status: 'LOW_STOCK' as const,
          days_cover: Math.floor(item.current_qty / Math.max(1, cat.total_issued / 30))
        }))
      ].slice(0, 10);

      return {
        category: cat.category,
        total_items: totalItems,
        active_items: activeItems,
        low_stock_items: lowStockItems,
        out_of_stock_items: outOfStockItems,
        avg_turnover: Math.round(avgTurnover * 100) / 100,
        total_value: Math.round(totalValue),
        movement_velocity: movementVelocity,
        health_score: healthScore,
        trend,
        top_items: topItems,
        critical_items: criticalItems
      };
    });
  }

  /**
   * Identify which category an item belongs to based on item code and name
   */
  private static identifyCategory(itemCode: string, itemName?: string): string | null {
    const searchText = `${itemCode} ${itemName || ''}`.toUpperCase();
    
    for (const [category, patterns] of Object.entries(MATERIAL_CATEGORIES)) {
      if (patterns.some(pattern => searchText.includes(pattern))) {
        return category;
      }
    }
    
    return null;
  }

  /**
   * Calculate category health score (0-100)
   */
  private static calculateCategoryHealth(
    totalItems: number, 
    activeItems: number, 
    lowStockItems: number, 
    outOfStockItems: number, 
    avgTurnover: number
  ): number {
    if (totalItems === 0) return 0;
    
    const stockAvailability = (activeItems / totalItems) * 40;
    const stockAdequacy = ((totalItems - lowStockItems - outOfStockItems) / totalItems) * 40;
    const turnoverHealth = Math.min(avgTurnover / 2, 20); // Cap at 20 points
    
    return Math.round(stockAvailability + stockAdequacy + turnoverHealth);
  }

  /**
   * Calculate movement velocity
   */
  private static calculateMovementVelocity(movementCount: number, totalItems: number): 'FAST' | 'MEDIUM' | 'SLOW' | 'STAGNANT' {
    if (totalItems === 0) return 'STAGNANT';
    
    const velocity = movementCount / totalItems;
    
    if (velocity > 10) return 'FAST';
    if (velocity > 5) return 'MEDIUM';
    if (velocity > 1) return 'SLOW';
    return 'STAGNANT';
  }

  /**
   * Calculate trend direction
   */
  private static calculateTrend(avgTurnover: number, healthScore: number): 'IMPROVING' | 'STABLE' | 'DECLINING' {
    if (healthScore > 80 && avgTurnover > 15) return 'IMPROVING';
    if (healthScore < 60 || avgTurnover < 5) return 'DECLINING';
    return 'STABLE';
  }

  /**
   * Generate actionable insights for categories
   */
  private static generateCategoryInsights(movements: CategoryMovement[]): CategoryInsight[] {
    const insights: CategoryInsight[] = [];

    movements.forEach(movement => {
      // Critical stock alerts
      if (movement.out_of_stock_items > 0) {
        insights.push({
          category: movement.category,
          type: 'alert',
          priority: 'critical',
          title: `${movement.category} Category: Critical Stock Shortage`,
          message: `${movement.out_of_stock_items} items in ${movement.category} category are completely out of stock`,
          recommendation: `Immediately source ${movement.category} materials to prevent production disruption`,
          metrics: {
            current_value: movement.out_of_stock_items,
            target_value: 0,
            trend: 'critical'
          },
          action_items: [
            'Review emergency procurement options',
            'Contact suppliers for expedited delivery',
            'Consider alternative materials if available'
          ]
        });
      }

      // Health score insights
      if (movement.health_score < 70) {
        insights.push({
          category: movement.category,
          type: 'performance',
          priority: movement.health_score < 50 ? 'high' : 'medium',
          title: `${movement.category} Category Health Below Target`,
          message: `${movement.category} category health score is ${movement.health_score}% (target: 80%+)`,
          recommendation: `Optimize ${movement.category} inventory management and review procurement strategy`,
          metrics: {
            current_value: movement.health_score,
            target_value: 80,
            trend: movement.trend.toLowerCase()
          },
          action_items: [
            'Analyze demand patterns for accurate forecasting',
            'Review reorder levels and safety stock',
            'Improve supplier lead time management'
          ]
        });
      }

      // Movement velocity insights
      if (movement.movement_velocity === 'STAGNANT' && movement.total_items > 0) {
        insights.push({
          category: movement.category,
          type: 'optimization',
          priority: 'medium',
          title: `${movement.category} Category: Low Movement Activity`,
          message: `${movement.category} materials showing minimal movement activity`,
          recommendation: `Review ${movement.category} usage patterns and optimize inventory levels`,
          metrics: {
            current_value: movement.avg_turnover,
            target_value: 15,
            trend: 'declining'
          },
          action_items: [
            'Identify slow-moving items for clearance',
            'Review usage forecasts',
            'Consider inventory reduction strategies'
          ]
        });
      }

      // High performance recognition
      if (movement.health_score > 85 && movement.movement_velocity === 'FAST') {
        insights.push({
          category: movement.category,
          type: 'performance',
          priority: 'low',
          title: `${movement.category} Category: Excellent Performance`,
          message: `${movement.category} category showing optimal inventory health and movement`,
          recommendation: `Maintain current ${movement.category} management practices as a benchmark`,
          metrics: {
            current_value: movement.health_score,
            target_value: 80,
            trend: 'improving'
          },
          action_items: [
            'Document best practices for replication',
            'Share insights with other categories',
            'Monitor for sustainability'
          ]
        });
      }
    });

    return insights.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Calculate summary statistics
   */
  private static calculateCategorySummary(movements: CategoryMovement[], insights: CategoryInsight[]) {
    const totalCategories = movements.filter(m => m.total_items > 0).length;
    const highPerforming = movements.filter(m => m.health_score > 80).length;
    const needsAttention = movements.filter(m => m.health_score < 70 && m.health_score >= 50).length;
    const criticalIssues = insights.filter(i => i.priority === 'critical').length;

    return {
      total_categories: totalCategories,
      high_performing: highPerforming,
      needs_attention: needsAttention,
      critical_issues: criticalIssues
    };
  }
}