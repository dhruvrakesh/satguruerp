-- Create manufacturing intelligence tables
CREATE TABLE IF NOT EXISTS satguru_ai_intelligence_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  query_type TEXT NOT NULL, -- 'inventory_analysis', 'process_optimization', 'predictive_analytics'
  query_parameters JSONB DEFAULT '{}',
  analysis_results JSONB DEFAULT '{}',
  insights JSONB DEFAULT '{}',
  confidence_score NUMERIC DEFAULT 0.8,
  execution_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE satguru_ai_intelligence_queries ENABLE ROW LEVEL SECURITY;

-- Create policy for SATGURU users
CREATE POLICY "Satguru users can manage AI intelligence queries" 
ON satguru_ai_intelligence_queries 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid() AND o.code = 'SATGURU'
  )
);

-- Create advanced analytics function
CREATE OR REPLACE FUNCTION get_advanced_manufacturing_analytics(
  p_user_id UUID,
  p_analysis_type TEXT DEFAULT 'comprehensive'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB := '{}';
  inventory_analysis JSONB;
  process_analysis JSONB;
  quality_analysis JSONB;
  efficiency_metrics JSONB;
BEGIN
  -- Get user's organization
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = p_user_id AND o.code = 'SATGURU'
  ) THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  -- Inventory Intelligence Analysis
  SELECT jsonb_build_object(
    'total_items', COUNT(*),
    'low_stock_items', COUNT(*) FILTER (WHERE current_qty <= reorder_level),
    'zero_stock_items', COUNT(*) FILTER (WHERE current_qty = 0),
    'high_value_items', COUNT(*) FILTER (WHERE current_value > 100000),
    'total_value', COALESCE(SUM(current_value), 0),
    'avg_stock_days', COALESCE(AVG(
      CASE WHEN monthly_consumption > 0 
      THEN current_qty / (monthly_consumption / 30)
      ELSE NULL END
    ), 0),
    'turnover_analysis', jsonb_agg(
      jsonb_build_object(
        'category', category_name,
        'items', COUNT(*),
        'value', SUM(current_value),
        'turnover_rate', AVG(
          CASE WHEN monthly_consumption > 0 
          THEN current_qty / (monthly_consumption / 30)
          ELSE 0 END
        )
      )
    )
  ) INTO inventory_analysis
  FROM satguru_stock_summary_view
  GROUP BY category_name;

  -- Process Efficiency Analysis
  SELECT jsonb_build_object(
    'active_orders', COUNT(DISTINCT uiorn),
    'process_stages', jsonb_object_agg(
      stage,
      jsonb_build_object(
        'count', COUNT(*),
        'avg_duration_hours', AVG(EXTRACT(EPOCH FROM (captured_at - LAG(captured_at) OVER (PARTITION BY uiorn ORDER BY captured_at))) / 3600),
        'latest_activity', MAX(captured_at)
      )
    ),
    'bottlenecks', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'stage', stage,
          'pending_count', COUNT(*),
          'avg_wait_time', AVG(EXTRACT(EPOCH FROM (NOW() - captured_at)) / 3600)
        )
      )
      FROM process_logs_se
      WHERE captured_at > NOW() - INTERVAL '7 days'
      GROUP BY stage
      HAVING COUNT(*) > 5
    )
  ) INTO process_analysis
  FROM process_logs_se
  WHERE captured_at > NOW() - INTERVAL '30 days';

  -- Quality Analysis
  SELECT jsonb_build_object(
    'quality_checkpoints', COUNT(*),
    'passed_checks', COUNT(*) FILTER (WHERE status = 'PASSED'),
    'failed_checks', COUNT(*) FILTER (WHERE status = 'FAILED'),
    'quality_rate', ROUND((COUNT(*) FILTER (WHERE status = 'PASSED')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2),
    'recent_issues', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'uiorn', uiorn,
          'stage', stage,
          'issue', notes,
          'timestamp', captured_at
        )
      )
      FROM quality_checkpoints
      WHERE status = 'FAILED' AND captured_at > NOW() - INTERVAL '7 days'
      LIMIT 10
    )
  ) INTO quality_analysis
  FROM quality_checkpoints
  WHERE captured_at > NOW() - INTERVAL '30 days';

  -- Build comprehensive result
  result := jsonb_build_object(
    'timestamp', NOW(),
    'analysis_type', p_analysis_type,
    'inventory_intelligence', COALESCE(inventory_analysis, '{}'),
    'process_efficiency', COALESCE(process_analysis, '{}'),
    'quality_metrics', COALESCE(quality_analysis, '{}'),
    'recommendations', jsonb_build_array(
      'Monitor low stock items for reordering',
      'Optimize process stages with high wait times',
      'Review quality checkpoints with high failure rates',
      'Consider automating reorder processes for high-turnover items'
    )
  );

  RETURN result;
END;
$$;

-- Create predictive analytics function
CREATE OR REPLACE FUNCTION generate_predictive_insights(
  p_user_id UUID,
  p_prediction_type TEXT DEFAULT 'demand_forecast'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB := '{}';
  demand_forecast JSONB;
  maintenance_predictions JSONB;
  quality_predictions JSONB;
BEGIN
  -- Verify SATGURU user
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = p_user_id AND o.code = 'SATGURU'
  ) THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  -- Demand Forecasting based on historical patterns
  SELECT jsonb_build_object(
    'next_month_demand', jsonb_object_agg(
      item_code,
      jsonb_build_object(
        'predicted_consumption', ROUND(avg_monthly_consumption * 1.2, 2), -- Simple 20% growth model
        'confidence', 0.75,
        'reorder_suggestion', CASE 
          WHEN current_qty < (avg_monthly_consumption * 1.2 * 1.5) THEN 'HIGH_PRIORITY'
          WHEN current_qty < (avg_monthly_consumption * 1.2 * 2) THEN 'MEDIUM_PRIORITY'
          ELSE 'LOW_PRIORITY'
        END,
        'suggested_order_qty', GREATEST(
          ROUND((avg_monthly_consumption * 1.2 * 2) - current_qty, 0), 
          0
        )
      )
    )
  ) INTO demand_forecast
  FROM (
    SELECT 
      s.item_code,
      s.current_qty,
      COALESCE(AVG(i.qty_issued), 0) as avg_monthly_consumption
    FROM satguru_stock s
    LEFT JOIN satguru_issue_log i ON s.item_code = i.item_code
      AND i.date > NOW() - INTERVAL '90 days'
    WHERE s.current_qty > 0
    GROUP BY s.item_code, s.current_qty
    HAVING AVG(i.qty_issued) > 0
    LIMIT 20
  ) forecast_data;

  -- Quality Predictions
  SELECT jsonb_build_object(
    'quality_risk_items', jsonb_agg(
      jsonb_build_object(
        'uiorn', uiorn,
        'risk_score', 
        CASE 
          WHEN failure_rate > 0.3 THEN 'HIGH'
          WHEN failure_rate > 0.1 THEN 'MEDIUM'
          ELSE 'LOW'
        END,
        'failure_rate', ROUND(failure_rate * 100, 2),
        'recommendation', 
        CASE 
          WHEN failure_rate > 0.3 THEN 'Review process parameters immediately'
          WHEN failure_rate > 0.1 THEN 'Monitor closely and adjust if needed'
          ELSE 'Continue standard monitoring'
        END
      )
    )
  ) INTO quality_predictions
  FROM (
    SELECT 
      uiorn,
      COUNT(*) FILTER (WHERE status = 'FAILED')::NUMERIC / NULLIF(COUNT(*), 0) as failure_rate
    FROM quality_checkpoints
    WHERE captured_at > NOW() - INTERVAL '30 days'
    GROUP BY uiorn
    HAVING COUNT(*) >= 3
  ) quality_risk;

  result := jsonb_build_object(
    'timestamp', NOW(),
    'prediction_type', p_prediction_type,
    'demand_forecast', COALESCE(demand_forecast, '{}'),
    'quality_predictions', COALESCE(quality_predictions, '{}'),
    'actionable_insights', jsonb_build_array(
      'Focus procurement on high-priority reorder items',
      'Implement predictive maintenance for high-risk processes',
      'Set up automated alerts for quality threshold breaches',
      'Review process parameters for items with high failure rates'
    )
  );

  RETURN result;
END;
$$;