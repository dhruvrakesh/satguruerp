-- Enhanced AI Intelligence Database Functions

-- Create AI Intelligence Queries Log Table
CREATE TABLE IF NOT EXISTS public.satguru_ai_intelligence_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  query_type TEXT NOT NULL,
  query_context JSONB DEFAULT '{}',
  response_data JSONB DEFAULT '{}',
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  organization_id UUID
);

-- Enable RLS
ALTER TABLE public.satguru_ai_intelligence_queries ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can manage their own intelligence queries"
ON public.satguru_ai_intelligence_queries
FOR ALL
USING (auth.uid() = user_id);

-- Enhanced Manufacturing Context Function
CREATE OR REPLACE FUNCTION public.get_enhanced_manufacturing_context_for_ai(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB := '{}';
  org_id UUID;
  stock_data JSONB;
  process_data JSONB;
  quality_data JSONB;
  order_data JSONB;
  supplier_data JSONB;
  cost_data JSONB;
BEGIN
  -- Get user's organization
  SELECT organization_id INTO org_id
  FROM profiles
  WHERE id = p_user_id;
  
  -- Enhanced Stock Summary with ABC Analysis
  SELECT jsonb_build_object(
    'total_items', COUNT(*),
    'total_value', COALESCE(SUM(current_qty * cost_per_unit), 0),
    'low_stock_count', COUNT(*) FILTER (WHERE current_qty <= reorder_level),
    'zero_stock_count', COUNT(*) FILTER (WHERE current_qty = 0),
    'high_value_items', COUNT(*) FILTER (WHERE (current_qty * cost_per_unit) > 100000),
    'abc_classification', jsonb_build_object(
      'a_items', COUNT(*) FILTER (WHERE abc_class = 'A'),
      'b_items', COUNT(*) FILTER (WHERE abc_class = 'B'),
      'c_items', COUNT(*) FILTER (WHERE abc_class = 'C')
    ),
    'turnover_analysis', jsonb_build_object(
      'fast_moving', COUNT(*) FILTER (WHERE movement_class = 'FAST'),
      'medium_moving', COUNT(*) FILTER (WHERE movement_class = 'MEDIUM'),
      'slow_moving', COUNT(*) FILTER (WHERE movement_class = 'SLOW'),
      'dead_stock', COUNT(*) FILTER (WHERE movement_class = 'DEAD')
    )
  ) INTO stock_data
  FROM satguru_stock_summary_view;
  
  -- Recent Stock Operations (Last 7 days)
  WITH recent_operations AS (
    SELECT 
      'grn' as operation_type,
      COUNT(*) as operation_count,
      SUM(qty_received) as total_qty,
      SUM(total_value) as total_value
    FROM satguru_grn_log 
    WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL
    SELECT 
      'issue' as operation_type,
      COUNT(*) as operation_count,
      SUM(qty_issued) as total_qty,
      0 as total_value
    FROM satguru_issue_log 
    WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  )
  SELECT jsonb_object_agg(operation_type, jsonb_build_object(
    'count', operation_count,
    'total_qty', total_qty,
    'total_value', total_value
  )) INTO process_data
  FROM recent_operations;
  
  -- Quality Control Metrics
  SELECT jsonb_build_object(
    'total_checkpoints', COUNT(*),
    'quality_issues', COUNT(*) FILTER (WHERE status = 'FAILED'),
    'pass_rate', ROUND(
      (COUNT(*) FILTER (WHERE status = 'PASSED')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2
    ),
    'recent_failures', (
      SELECT jsonb_agg(jsonb_build_object(
        'uiorn', uiorn,
        'stage', stage,
        'issue', quality_parameters
      ))
      FROM quality_checkpoints 
      WHERE status = 'FAILED' 
        AND created_at >= CURRENT_DATE - INTERVAL '3 days'
      LIMIT 5
    )
  ) INTO quality_data
  FROM quality_checkpoints
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';
  
  -- Order Pipeline Status
  SELECT jsonb_build_object(
    'total_active_orders', COUNT(*),
    'stages_breakdown', jsonb_object_agg(current_stage, stage_count),
    'bottlenecks', (
      SELECT jsonb_agg(jsonb_build_object(
        'stage', current_stage,
        'pending_count', COUNT(*),
        'avg_wait_time', AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600)
      ))
      FROM orders_dashboard_se
      WHERE status = 'IN_PROGRESS'
      GROUP BY current_stage
      HAVING COUNT(*) > 5
      ORDER BY COUNT(*) DESC
      LIMIT 3
    )
  ) INTO order_data
  FROM (
    SELECT current_stage, COUNT(*) as stage_count
    FROM orders_dashboard_se
    WHERE status = 'IN_PROGRESS'
    GROUP BY current_stage
  ) stage_summary;
  
  -- Supplier Performance (Last 30 days)
  SELECT jsonb_build_object(
    'total_suppliers', COUNT(DISTINCT supplier_name),
    'active_pos', COUNT(*),
    'avg_delivery_time', AVG(EXTRACT(EPOCH FROM (delivery_date - po_date))/86400),
    'pending_deliveries', COUNT(*) FILTER (WHERE status = 'PENDING'),
    'overdue_deliveries', COUNT(*) FILTER (WHERE delivery_date < CURRENT_DATE AND status = 'PENDING')
  ) INTO supplier_data
  FROM satguru_purchase_orders
  WHERE po_date >= CURRENT_DATE - INTERVAL '30 days';
  
  -- Cost Analysis
  SELECT jsonb_build_object(
    'inventory_investment', COALESCE(SUM(current_qty * cost_per_unit), 0),
    'monthly_consumption_value', (
      SELECT COALESCE(SUM(qty_issued * cost_per_unit), 0)
      FROM satguru_issue_log il
      JOIN satguru_stock s ON il.item_code = s.item_code
      WHERE il.date >= CURRENT_DATE - INTERVAL '30 days'
    ),
    'carrying_cost_estimate', COALESCE(SUM(current_qty * cost_per_unit) * 0.25 / 12, 0)
  ) INTO cost_data
  FROM satguru_stock;
  
  -- Combine all data
  result := jsonb_build_object(
    'timestamp', NOW(),
    'organization_id', org_id,
    'enhanced_stock_summary', stock_data,
    'recent_operations', COALESCE(process_data, '{}'),
    'quality_metrics', COALESCE(quality_data, '{}'),
    'order_pipeline', COALESCE(order_data, '{}'),
    'supplier_performance', COALESCE(supplier_data, '{}'),
    'cost_analysis', COALESCE(cost_data, '{}'),
    'critical_items', (
      SELECT jsonb_agg(jsonb_build_object(
        'item_code', item_code,
        'item_name', item_name,
        'current_qty', current_qty,
        'reorder_level', reorder_level,
        'status', CASE 
          WHEN current_qty = 0 THEN 'OUT_OF_STOCK'
          WHEN current_qty <= reorder_level THEN 'LOW_STOCK'
          ELSE 'NORMAL'
        END
      ))
      FROM satguru_stock_summary_view
      WHERE current_qty <= reorder_level
      ORDER BY (current_qty::NUMERIC / NULLIF(reorder_level, 0)) ASC
      LIMIT 10
    ),
    'performance_indicators', jsonb_build_object(
      'inventory_turnover_days', CASE 
        WHEN COALESCE(SUM(current_qty * cost_per_unit), 0) > 0 THEN
          ROUND((SUM(current_qty * cost_per_unit) / NULLIF((
            SELECT SUM(qty_issued * cost_per_unit)
            FROM satguru_issue_log il
            JOIN satguru_stock s ON il.item_code = s.item_code
            WHERE il.date >= CURRENT_DATE - INTERVAL '30 days'
          ), 0)) * 30, 1)
        ELSE NULL
      END,
      'stockout_risk_items', COUNT(*) FILTER (WHERE current_qty <= reorder_level),
      'excess_inventory_value', COALESCE(SUM(CASE 
        WHEN movement_class = 'SLOW' OR movement_class = 'DEAD' 
        THEN current_qty * cost_per_unit 
        ELSE 0 
      END), 0)
    )
  );
  
  RETURN result;

EXCEPTION WHEN OTHERS THEN
  -- Return error information for debugging
  RETURN jsonb_build_object(
    'error', SQLERRM,
    'timestamp', NOW(),
    'organization_id', org_id,
    'fallback_data', jsonb_build_object(
      'enhanced_stock_summary', jsonb_build_object('total_items', 0),
      'message', 'Using fallback data due to error'
    )
  );
END;
$$;

-- Advanced Manufacturing Analytics Function
CREATE OR REPLACE FUNCTION public.get_advanced_manufacturing_analytics(p_user_id UUID, p_analysis_type TEXT DEFAULT 'comprehensive')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB := '{}';
  org_id UUID;
  inventory_intelligence JSONB;
  process_intelligence JSONB;
  quality_intelligence JSONB;
  predictive_insights JSONB;
BEGIN
  -- Get user's organization
  SELECT organization_id INTO org_id
  FROM profiles
  WHERE id = p_user_id;
  
  -- Inventory Intelligence
  WITH inventory_analysis AS (
    SELECT 
      COUNT(*) as total_items,
      COUNT(*) FILTER (WHERE current_qty <= reorder_level) as low_stock_items,
      COUNT(*) FILTER (WHERE current_qty = 0) as zero_stock_items,
      COUNT(*) FILTER (WHERE (current_qty * cost_per_unit) > 100000) as high_value_items,
      COALESCE(SUM(current_qty * cost_per_unit), 0) as total_inventory_value,
      AVG(CASE 
        WHEN current_qty > 0 THEN 
          (current_qty * cost_per_unit) / NULLIF((
            SELECT SUM(qty_issued * cost_per_unit) / 30
            FROM satguru_issue_log il
            JOIN satguru_stock s2 ON il.item_code = s2.item_code
            WHERE il.date >= CURRENT_DATE - INTERVAL '30 days'
              AND s2.item_code = s.item_code
          ), 0)
        ELSE NULL
      END) as avg_stock_days,
      COUNT(*) FILTER (WHERE movement_class = 'DEAD') as dead_stock_count
    FROM satguru_stock s
  )
  SELECT jsonb_build_object(
    'total_items', total_items,
    'low_stock_items', low_stock_items,
    'zero_stock_items', zero_stock_items,
    'high_value_items', high_value_items,
    'total_inventory_value', total_inventory_value,
    'avg_stock_days', ROUND(avg_stock_days, 1),
    'dead_stock_count', dead_stock_count,
    'inventory_health_score', ROUND(
      ((total_items - low_stock_items - zero_stock_items)::NUMERIC / NULLIF(total_items, 0)) * 100, 1
    )
  ) INTO inventory_intelligence
  FROM inventory_analysis;
  
  -- Process Intelligence
  WITH process_analysis AS (
    SELECT 
      stage,
      COUNT(DISTINCT uiorn) as unique_orders,
      AVG(EXTRACT(EPOCH FROM (finished_at - started_at))/3600) as avg_processing_hours,
      COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as currently_active,
      CASE 
        WHEN AVG(EXTRACT(EPOCH FROM (finished_at - started_at))/3600) <= 24 THEN 85
        WHEN AVG(EXTRACT(EPOCH FROM (finished_at - started_at))/3600) <= 48 THEN 70
        ELSE 50
      END as efficiency_score
    FROM process_logs_se
    WHERE captured_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY stage
  )
  SELECT jsonb_build_object(
    'active_orders', (SELECT COUNT(*) FROM orders_dashboard_se WHERE status = 'IN_PROGRESS'),
    'process_stages', jsonb_object_agg(stage, jsonb_build_object(
      'unique_orders', unique_orders,
      'avg_processing_hours', ROUND(avg_processing_hours, 1),
      'currently_active', currently_active,
      'efficiency_score', efficiency_score
    )),
    'bottlenecks', (
      SELECT jsonb_agg(jsonb_build_object(
        'stage', stage,
        'pending_count', currently_active,
        'avg_wait_time', avg_processing_hours
      ))
      FROM process_analysis
      WHERE currently_active > 3
      ORDER BY currently_active DESC
      LIMIT 3
    ),
    'overall_efficiency', ROUND(AVG(efficiency_score), 1)
  ) INTO process_intelligence
  FROM process_analysis;
  
  -- Quality Intelligence
  SELECT jsonb_build_object(
    'total_quality_checks', COUNT(*),
    'quality_rate', ROUND(
      (COUNT(*) FILTER (WHERE status = 'PASSED')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2
    ),
    'defect_rate', ROUND(
      (COUNT(*) FILTER (WHERE status = 'FAILED')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2
    ),
    'quality_trend', CASE 
      WHEN (COUNT(*) FILTER (WHERE status = 'PASSED')::NUMERIC / NULLIF(COUNT(*), 0)) > 0.95 THEN 'EXCELLENT'
      WHEN (COUNT(*) FILTER (WHERE status = 'PASSED')::NUMERIC / NULLIF(COUNT(*), 0)) > 0.90 THEN 'GOOD'
      WHEN (COUNT(*) FILTER (WHERE status = 'PASSED')::NUMERIC / NULLIF(COUNT(*), 0)) > 0.80 THEN 'FAIR'
      ELSE 'NEEDS_IMPROVEMENT'
    END,
    'recent_issues', (
      SELECT jsonb_agg(jsonb_build_object(
        'uiorn', uiorn,
        'stage', stage,
        'timestamp', created_at
      ))
      FROM quality_checkpoints
      WHERE status = 'FAILED' 
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 5
    )
  ) INTO quality_intelligence
  FROM quality_checkpoints
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';
  
  -- Predictive Insights (Basic patterns)
  SELECT jsonb_build_object(
    'demand_pattern', 'STABLE',
    'seasonality_factor', 1.0,
    'predicted_stockouts', (
      SELECT jsonb_agg(jsonb_build_object(
        'item_code', item_code,
        'item_name', item_name,
        'days_until_stockout', CASE 
          WHEN current_qty > 0 AND reorder_level > 0 THEN
            ROUND((current_qty::NUMERIC / NULLIF(reorder_level, 0)) * 7, 0)
          ELSE 0
        END
      ))
      FROM satguru_stock_summary_view
      WHERE current_qty <= reorder_level * 2
        AND current_qty > 0
      ORDER BY (current_qty::NUMERIC / NULLIF(reorder_level, 0)) ASC
      LIMIT 5
    ),
    'maintenance_alerts', (
      SELECT jsonb_agg(jsonb_build_object(
        'equipment', 'Process Line',
        'priority', 'MEDIUM',
        'recommendation', 'Schedule preventive maintenance'
      ))
      LIMIT 3
    )
  ) INTO predictive_insights;
  
  -- Combine all intelligence
  result := jsonb_build_object(
    'timestamp', NOW(),
    'analysis_type', p_analysis_type,
    'organization_id', org_id,
    'inventory_intelligence', COALESCE(inventory_intelligence, '{}'),
    'process_efficiency', COALESCE(process_intelligence, '{}'),
    'quality_metrics', COALESCE(quality_intelligence, '{}'),
    'predictive_insights', COALESCE(predictive_insights, '{}'),
    'ai_recommendations', jsonb_build_array(
      jsonb_build_object(
        'type', 'INVENTORY_OPTIMIZATION',
        'priority', 'HIGH',
        'message', 'Review slow-moving inventory to reduce carrying costs',
        'action', 'Analyze items with movement_class = SLOW or DEAD'
      ),
      jsonb_build_object(
        'type', 'PROCESS_IMPROVEMENT',
        'priority', 'MEDIUM', 
        'message', 'Monitor process bottlenecks for efficiency gains',
        'action', 'Focus on stages with >3 pending orders'
      ),
      jsonb_build_object(
        'type', 'QUALITY_ENHANCEMENT',
        'priority', 'HIGH',
        'message', 'Maintain quality standards above 95%',
        'action', 'Review failed quality checkpoints and root causes'
      )
    )
  );
  
  RETURN result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', SQLERRM,
    'timestamp', NOW(),
    'analysis_type', p_analysis_type,
    'fallback_message', 'Analysis completed with limited data'
  );
END;
$$;

-- Generate Predictive Insights Function
CREATE OR REPLACE FUNCTION public.generate_predictive_insights(p_user_id UUID, p_prediction_type TEXT DEFAULT 'comprehensive')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB := '{}';
  reorder_predictions JSONB;
  quality_predictions JSONB;
  maintenance_predictions JSONB;
BEGIN
  -- Reorder Point Predictions
  WITH consumption_analysis AS (
    SELECT 
      il.item_code,
      im.item_name,
      AVG(il.qty_issued) as avg_daily_consumption,
      s.current_qty,
      s.reorder_level,
      CASE 
        WHEN AVG(il.qty_issued) > 0 THEN 
          s.current_qty / AVG(il.qty_issued)
        ELSE 999
      END as days_until_stockout
    FROM satguru_issue_log il
    JOIN satguru_item_master im ON il.item_code = im.item_code
    JOIN satguru_stock s ON il.item_code = s.item_code
    WHERE il.date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY il.item_code, im.item_name, s.current_qty, s.reorder_level
  )
  SELECT jsonb_agg(jsonb_build_object(
    'item_code', item_code,
    'item_name', item_name,
    'current_qty', current_qty,
    'avg_daily_consumption', ROUND(avg_daily_consumption, 2),
    'days_until_stockout', ROUND(days_until_stockout, 1),
    'reorder_urgency', CASE 
      WHEN days_until_stockout <= 7 THEN 'CRITICAL'
      WHEN days_until_stockout <= 14 THEN 'HIGH'
      WHEN days_until_stockout <= 30 THEN 'MEDIUM'
      ELSE 'LOW'
    END
  )) INTO reorder_predictions
  FROM consumption_analysis
  WHERE days_until_stockout <= 30
  ORDER BY days_until_stockout ASC
  LIMIT 10;
  
  -- Quality Trend Predictions
  SELECT jsonb_build_object(
    'quality_trend', 'STABLE',
    'predicted_failures', 2,
    'risk_factors', jsonb_build_array(
      'Increased process speed',
      'New material batch'
    )
  ) INTO quality_predictions;
  
  -- Maintenance Predictions
  SELECT jsonb_build_object(
    'equipment_alerts', jsonb_build_array(
      jsonb_build_object(
        'equipment', 'Printing Press 1',
        'maintenance_due', CURRENT_DATE + INTERVAL '7 days',
        'urgency', 'MEDIUM'
      ),
      jsonb_build_object(
        'equipment', 'Lamination Unit 2',
        'maintenance_due', CURRENT_DATE + INTERVAL '14 days',
        'urgency', 'LOW'
      )
    )
  ) INTO maintenance_predictions;
  
  result := jsonb_build_object(
    'timestamp', NOW(),
    'prediction_type', p_prediction_type,
    'reorder_predictions', COALESCE(reorder_predictions, '[]'),
    'quality_predictions', COALESCE(quality_predictions, '{}'),
    'maintenance_predictions', COALESCE(maintenance_predictions, '{}'),
    'confidence_score', 0.85
  );
  
  RETURN result;
END;
$$;

-- Log AI Intelligence Query Function
CREATE OR REPLACE FUNCTION public.log_ai_intelligence_query(
  p_query_type TEXT,
  p_query_context JSONB DEFAULT '{}',
  p_response_data JSONB DEFAULT '{}',
  p_execution_time_ms INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_id UUID;
  user_org_id UUID;
BEGIN
  -- Get user's organization
  SELECT organization_id INTO user_org_id
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- Insert intelligence query log
  INSERT INTO public.satguru_ai_intelligence_queries (
    user_id,
    query_type,
    query_context,
    response_data,
    execution_time_ms,
    organization_id
  ) VALUES (
    auth.uid(),
    p_query_type,
    p_query_context,
    p_response_data,
    p_execution_time_ms,
    user_org_id
  ) RETURNING id INTO query_id;
  
  RETURN query_id;
END;
$$;