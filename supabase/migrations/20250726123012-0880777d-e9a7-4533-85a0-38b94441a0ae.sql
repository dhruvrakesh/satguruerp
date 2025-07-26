-- Drop all conflicting function versions to eliminate overloading
DROP FUNCTION IF EXISTS public.generate_predictive_insights(text);
DROP FUNCTION IF EXISTS public.generate_predictive_insights(text, uuid);
DROP FUNCTION IF EXISTS public.get_advanced_manufacturing_analytics(text);
DROP FUNCTION IF EXISTS public.get_advanced_manufacturing_analytics(text, uuid);

-- Create single definitive version of generate_predictive_insights
CREATE OR REPLACE FUNCTION public.generate_predictive_insights(p_prediction_type text, p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  user_org_id uuid;
BEGIN
  -- Get user's organization if user_id provided
  IF p_user_id IS NOT NULL THEN
    SELECT organization_id INTO user_org_id
    FROM profiles
    WHERE id = p_user_id;
  ELSE
    SELECT organization_id INTO user_org_id
    FROM profiles
    WHERE id = auth.uid();
  END IF;
  
  -- Only process for SATGURU organization
  IF user_org_id IS NULL OR NOT EXISTS (SELECT 1 FROM organizations WHERE id = user_org_id AND code = 'SATGURU') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied: SATGURU organization required'
    );
  END IF;

  -- Generate predictive insights based on consumption patterns
  WITH consumption_analysis AS (
    SELECT 
      s.item_code,
      s.item_name,
      s.current_qty,
      s.reorder_level,
      s.consumption_30_days,
      s.received_30_days,
      CASE 
        WHEN s.consumption_30_days > 0 THEN s.current_qty / (s.consumption_30_days / 30.0)
        ELSE 999
      END as days_remaining,
      CASE
        WHEN s.current_qty <= s.reorder_level THEN 'CRITICAL'
        WHEN s.consumption_30_days > 0 AND s.current_qty / (s.consumption_30_days / 30.0) <= 7 THEN 'HIGH'
        WHEN s.consumption_30_days > 0 AND s.current_qty / (s.consumption_30_days / 30.0) <= 15 THEN 'MEDIUM'
        ELSE 'LOW'
      END as urgency_level
    FROM satguru_stock_summary_view s
    WHERE s.consumption_30_days > 0
      AND s.current_qty > 0
  ),
  reorder_predictions AS (
    SELECT 
      item_code,
      item_name,
      current_qty,
      consumption_30_days,
      days_remaining,
      urgency_level,
      CASE
        WHEN urgency_level = 'CRITICAL' THEN 'Immediate reorder required'
        WHEN urgency_level = 'HIGH' THEN 'Reorder within 1 week'
        WHEN urgency_level = 'MEDIUM' THEN 'Reorder within 2 weeks'
        ELSE 'Stock level adequate'
      END as recommendation
    FROM consumption_analysis
    WHERE urgency_level IN ('CRITICAL', 'HIGH', 'MEDIUM')
    ORDER BY 
      CASE urgency_level
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
      END,
      days_remaining ASC
    LIMIT 20
  )
  SELECT jsonb_build_object(
    'success', true,
    'prediction_type', p_prediction_type,
    'generated_at', NOW(),
    'predictions', jsonb_agg(
      jsonb_build_object(
        'item_code', r.item_code,
        'item_name', r.item_name,
        'current_stock', r.current_qty,
        'monthly_consumption', r.consumption_30_days,
        'days_remaining', ROUND(r.days_remaining, 1),
        'urgency_level', r.urgency_level,
        'recommendation', r.recommendation
      )
    ),
    'summary', jsonb_build_object(
      'critical_items', (SELECT COUNT(*) FROM reorder_predictions WHERE urgency_level = 'CRITICAL'),
      'high_priority_items', (SELECT COUNT(*) FROM reorder_predictions WHERE urgency_level = 'HIGH'),
      'medium_priority_items', (SELECT COUNT(*) FROM reorder_predictions WHERE urgency_level = 'MEDIUM'),
      'total_items_analyzed', (SELECT COUNT(*) FROM consumption_analysis)
    )
  ) INTO result
  FROM reorder_predictions r;

  RETURN COALESCE(result, jsonb_build_object(
    'success', true,
    'prediction_type', p_prediction_type,
    'generated_at', NOW(),
    'predictions', '[]'::jsonb,
    'summary', jsonb_build_object(
      'critical_items', 0,
      'high_priority_items', 0,
      'medium_priority_items', 0,
      'total_items_analyzed', 0
    )
  ));
END;
$$;

-- Create single definitive version of get_advanced_manufacturing_analytics
CREATE OR REPLACE FUNCTION public.get_advanced_manufacturing_analytics(p_analysis_type text, p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  user_org_id uuid;
BEGIN
  -- Get user's organization if user_id provided
  IF p_user_id IS NOT NULL THEN
    SELECT organization_id INTO user_org_id
    FROM profiles
    WHERE id = p_user_id;
  ELSE
    SELECT organization_id INTO user_org_id
    FROM profiles
    WHERE id = auth.uid();
  END IF;
  
  -- Only process for SATGURU organization
  IF user_org_id IS NULL OR NOT EXISTS (SELECT 1 FROM organizations WHERE id = user_org_id AND code = 'SATGURU') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied: SATGURU organization required'
    );
  END IF;

  -- Generate comprehensive manufacturing analytics
  WITH stock_metrics AS (
    SELECT 
      COUNT(*) as total_items,
      COUNT(CASE WHEN current_qty <= reorder_level THEN 1 END) as low_stock_items,
      COUNT(CASE WHEN current_qty = 0 THEN 1 END) as out_of_stock_items,
      COUNT(CASE WHEN consumption_30_days > 0 THEN 1 END) as active_items,
      SUM(current_qty) as total_stock_qty,
      SUM(consumption_30_days) as total_consumption,
      AVG(CASE WHEN consumption_30_days > 0 THEN current_qty / (consumption_30_days / 30.0) ELSE NULL END) as avg_days_coverage
    FROM satguru_stock_summary_view
  ),
  inventory_turnover AS (
    SELECT 
      item_code,
      item_name,
      current_qty,
      consumption_30_days,
      CASE 
        WHEN current_qty > 0 AND consumption_30_days > 0 
        THEN consumption_30_days / current_qty 
        ELSE 0 
      END as turnover_ratio
    FROM satguru_stock_summary_view
    WHERE consumption_30_days > 0
    ORDER BY turnover_ratio DESC
    LIMIT 10
  ),
  process_activity AS (
    SELECT 
      stage::text as process_stage,
      COUNT(*) as activity_count,
      COUNT(DISTINCT uiorn) as unique_orders
    FROM process_logs_se 
    WHERE captured_at >= NOW() - INTERVAL '30 days'
    GROUP BY stage
    ORDER BY activity_count DESC
  )
  SELECT jsonb_build_object(
    'success', true,
    'analysis_type', p_analysis_type,
    'generated_at', NOW(),
    'stock_overview', jsonb_build_object(
      'total_items', sm.total_items,
      'low_stock_alerts', sm.low_stock_items,
      'out_of_stock_items', sm.out_of_stock_items,
      'active_items', sm.active_items,
      'stock_coverage_days', ROUND(sm.avg_days_coverage, 1),
      'inventory_health_score', 
        CASE 
          WHEN sm.total_items > 0 THEN 
            ROUND(((sm.total_items - sm.low_stock_items - sm.out_of_stock_items)::numeric / sm.total_items) * 100, 1)
          ELSE 0 
        END
    ),
    'top_turnover_items', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'item_code', it.item_code,
          'item_name', it.item_name,
          'current_qty', it.current_qty,
          'monthly_consumption', it.consumption_30_days,
          'turnover_ratio', ROUND(it.turnover_ratio, 2)
        )
      )
      FROM inventory_turnover it
    ),
    'process_activity', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'stage', pa.process_stage,
          'activity_count', pa.activity_count,
          'unique_orders', pa.unique_orders
        )
      )
      FROM process_activity pa
    ),
    'recommendations', jsonb_build_array(
      CASE WHEN sm.low_stock_items > 0 THEN 
        jsonb_build_object(
          'type', 'stock_alert',
          'priority', 'high',
          'message', sm.low_stock_items || ' items below reorder level',
          'action', 'Review and place purchase orders'
        )
      END,
      CASE WHEN sm.out_of_stock_items > 0 THEN
        jsonb_build_object(
          'type', 'stock_out',
          'priority', 'critical', 
          'message', sm.out_of_stock_items || ' items out of stock',
          'action', 'Immediate procurement required'
        )
      END
    )
  ) INTO result
  FROM stock_metrics sm;

  RETURN result;
END;
$$;