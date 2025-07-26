-- Create enhanced manufacturing context function with correct schema
CREATE OR REPLACE FUNCTION public.get_enhanced_manufacturing_context_for_ai(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  context_data jsonb := '{}';
  stock_data jsonb;
  recent_activity jsonb;
  alerts jsonb;
BEGIN
  -- Get comprehensive stock analysis using actual columns
  SELECT jsonb_build_object(
    'total_items', COUNT(*),
    'low_stock_items', COUNT(*) FILTER (WHERE current_qty <= reorder_level),
    'high_consumption_items', COUNT(*) FILTER (WHERE consumption_30_days > 100),
    'zero_stock_items', COUNT(*) FILTER (WHERE current_qty = 0),
    'fast_moving_items', COUNT(*) FILTER (WHERE consumption_30_days > current_qty / 7),
    'inventory_turnover_avg', AVG(CASE WHEN current_qty > 0 THEN consumption_30_days / current_qty ELSE 0 END),
    'total_current_stock', SUM(current_qty),
    'total_consumption_30d', SUM(consumption_30_days),
    'total_received_30d', SUM(received_30_days)
  ) INTO stock_data
  FROM satguru_stock_summary_view;

  -- Get recent activity patterns
  SELECT jsonb_build_object(
    'recent_grns_count', COUNT(DISTINCT id) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '7 days'),
    'recent_issues_count', (SELECT COUNT(*) FROM satguru_issue_log WHERE date >= CURRENT_DATE - INTERVAL '7 days'),
    'avg_daily_transactions', COUNT(*) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '30 days') / 30
  ) INTO recent_activity
  FROM satguru_grn_log
  WHERE date >= CURRENT_DATE - INTERVAL '30 days';

  -- Generate intelligent alerts
  SELECT jsonb_build_object(
    'critical_stock_alerts', jsonb_agg(
      jsonb_build_object(
        'item_code', item_code,
        'item_name', item_name,
        'current_qty', current_qty,
        'reorder_level', reorder_level,
        'days_of_stock', CASE WHEN consumption_30_days > 0 THEN (current_qty * 30.0 / consumption_30_days) ELSE 999 END,
        'consumption_trend', consumption_30_days
      )
    ) FILTER (WHERE current_qty <= reorder_level AND consumption_30_days > 0)
  ) INTO alerts
  FROM satguru_stock_summary_view
  WHERE current_qty <= reorder_level;

  -- Build comprehensive context
  context_data := jsonb_build_object(
    'stock_analysis', stock_data,
    'recent_activity', recent_activity,
    'alerts', COALESCE(alerts, '{"critical_stock_alerts": []}'::jsonb),
    'generated_at', NOW(),
    'data_source', 'enhanced_manufacturing_intelligence'
  );

  RETURN context_data;
END;
$$;

-- Create advanced manufacturing analytics function
CREATE OR REPLACE FUNCTION public.get_advanced_manufacturing_analytics(p_analysis_type text DEFAULT 'comprehensive', p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  analytics_result jsonb := '{}';
  inventory_metrics jsonb;
  consumption_patterns jsonb;
  supply_chain_metrics jsonb;
BEGIN
  -- Inventory Intelligence Analysis
  SELECT jsonb_build_object(
    'abc_analysis', jsonb_build_object(
      'a_category_items', COUNT(*) FILTER (WHERE consumption_30_days > 100),
      'b_category_items', COUNT(*) FILTER (WHERE consumption_30_days BETWEEN 20 AND 100),
      'c_category_items', COUNT(*) FILTER (WHERE consumption_30_days < 20),
      'total_value_a', SUM(current_qty) FILTER (WHERE consumption_30_days > 100),
      'total_value_b', SUM(current_qty) FILTER (WHERE consumption_30_days BETWEEN 20 AND 100),
      'total_value_c', SUM(current_qty) FILTER (WHERE consumption_30_days < 20)
    ),
    'turnover_analysis', jsonb_build_object(
      'high_turnover_items', COUNT(*) FILTER (WHERE consumption_30_days > current_qty / 7),
      'medium_turnover_items', COUNT(*) FILTER (WHERE consumption_30_days BETWEEN current_qty / 30 AND current_qty / 7),
      'low_turnover_items', COUNT(*) FILTER (WHERE consumption_30_days < current_qty / 30),
      'avg_inventory_days', AVG(CASE WHEN consumption_30_days > 0 THEN (current_qty * 30.0 / consumption_30_days) ELSE 999 END)
    ),
    'stock_efficiency', jsonb_build_object(
      'optimal_stock_items', COUNT(*) FILTER (WHERE current_qty BETWEEN reorder_level AND reorder_level * 3),
      'overstocked_items', COUNT(*) FILTER (WHERE current_qty > reorder_level * 3),
      'understocked_items', COUNT(*) FILTER (WHERE current_qty < reorder_level),
      'stockout_risk_items', COUNT(*) FILTER (WHERE current_qty <= 0)
    )
  ) INTO inventory_metrics
  FROM satguru_stock_summary_view;

  -- Consumption Pattern Analysis
  SELECT jsonb_build_object(
    'consumption_trends', jsonb_build_object(
      'total_consumption_30d', SUM(consumption_30_days),
      'avg_daily_consumption', SUM(consumption_30_days) / 30,
      'high_consumption_variance', COUNT(*) FILTER (WHERE consumption_30_days > received_30_days * 2),
      'steady_consumption_items', COUNT(*) FILTER (WHERE ABS(consumption_30_days - received_30_days) <= received_30_days * 0.2)
    ),
    'demand_volatility', jsonb_build_object(
      'volatile_items', COUNT(*) FILTER (WHERE ABS(consumption_30_days - received_30_days) > received_30_days),
      'stable_items', COUNT(*) FILTER (WHERE ABS(consumption_30_days - received_30_days) <= received_30_days * 0.5),
      'no_movement_items', COUNT(*) FILTER (WHERE consumption_30_days = 0 AND received_30_days = 0)
    )
  ) INTO consumption_patterns
  FROM satguru_stock_summary_view;

  -- Supply Chain Metrics
  SELECT jsonb_build_object(
    'procurement_efficiency', jsonb_build_object(
      'total_receipts_30d', SUM(received_30_days),
      'receipt_vs_consumption_ratio', CASE WHEN SUM(consumption_30_days) > 0 THEN SUM(received_30_days) / SUM(consumption_30_days) ELSE 0 END,
      'items_with_receipts', COUNT(*) FILTER (WHERE received_30_days > 0),
      'items_without_receipts', COUNT(*) FILTER (WHERE received_30_days = 0 AND consumption_30_days > 0)
    ),
    'operational_insights', jsonb_build_object(
      'recent_grn_activity', (SELECT COUNT(*) FROM satguru_grn_log WHERE date >= CURRENT_DATE - INTERVAL '7 days'),
      'recent_issue_activity', (SELECT COUNT(*) FROM satguru_issue_log WHERE date >= CURRENT_DATE - INTERVAL '7 days'),
      'active_items_percentage', (COUNT(*) FILTER (WHERE consumption_30_days > 0 OR received_30_days > 0) * 100.0 / NULLIF(COUNT(*), 0))
    )
  ) INTO supply_chain_metrics
  FROM satguru_stock_summary_view;

  -- Combine all analytics
  analytics_result := jsonb_build_object(
    'analysis_type', p_analysis_type,
    'inventory_intelligence', inventory_metrics,
    'consumption_patterns', consumption_patterns,
    'supply_chain_metrics', supply_chain_metrics,
    'generated_at', NOW(),
    'total_items_analyzed', (SELECT COUNT(*) FROM satguru_stock_summary_view)
  );

  RETURN analytics_result;
END;
$$;

-- Create predictive insights function
CREATE OR REPLACE FUNCTION public.generate_predictive_insights(p_prediction_type text DEFAULT 'comprehensive')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  insights_result jsonb := '{}';
  reorder_predictions jsonb;
  stockout_predictions jsonb;
  consumption_forecasts jsonb;
BEGIN
  -- Predict reorder needs based on consumption trends
  SELECT jsonb_build_object(
    'immediate_reorder_needed', jsonb_agg(
      jsonb_build_object(
        'item_code', item_code,
        'item_name', item_name,
        'current_qty', current_qty,
        'consumption_30_days', consumption_30_days,
        'days_until_stockout', CASE WHEN consumption_30_days > 0 THEN (current_qty * 30.0 / consumption_30_days) ELSE 999 END,
        'recommended_order_qty', GREATEST(reorder_level * 2, consumption_30_days),
        'urgency_level', CASE 
          WHEN current_qty <= 0 THEN 'CRITICAL'
          WHEN current_qty <= reorder_level * 0.5 THEN 'HIGH'
          WHEN current_qty <= reorder_level THEN 'MEDIUM'
          ELSE 'LOW'
        END
      )
    ) FILTER (WHERE current_qty <= reorder_level AND consumption_30_days > 0)
  ) INTO reorder_predictions
  FROM satguru_stock_summary_view
  WHERE current_qty <= reorder_level AND consumption_30_days > 0;

  -- Predict potential stockouts
  SELECT jsonb_build_object(
    'stockout_risk_7_days', jsonb_agg(
      jsonb_build_object(
        'item_code', item_code,
        'item_name', item_name,
        'current_qty', current_qty,
        'daily_consumption', consumption_30_days / 30.0,
        'days_until_stockout', CASE WHEN consumption_30_days > 0 THEN (current_qty * 30.0 / consumption_30_days) ELSE 999 END,
        'risk_level', CASE 
          WHEN consumption_30_days > 0 AND (current_qty * 30.0 / consumption_30_days) <= 3 THEN 'VERY_HIGH'
          WHEN consumption_30_days > 0 AND (current_qty * 30.0 / consumption_30_days) <= 7 THEN 'HIGH'
          WHEN consumption_30_days > 0 AND (current_qty * 30.0 / consumption_30_days) <= 14 THEN 'MEDIUM'
          ELSE 'LOW'
        END
      )
    ) FILTER (WHERE consumption_30_days > 0 AND (current_qty * 30.0 / consumption_30_days) <= 14)
  ) INTO stockout_predictions
  FROM satguru_stock_summary_view
  WHERE consumption_30_days > 0 AND (current_qty * 30.0 / consumption_30_days) <= 14;

  -- Generate consumption forecasts
  SELECT jsonb_build_object(
    'forecast_30_days', jsonb_build_object(
      'predicted_total_consumption', SUM(consumption_30_days),
      'high_demand_items', COUNT(*) FILTER (WHERE consumption_30_days > 100),
      'steady_demand_items', COUNT(*) FILTER (WHERE consumption_30_days BETWEEN 10 AND 100),
      'low_demand_items', COUNT(*) FILTER (WHERE consumption_30_days < 10),
      'procurement_recommendations', SUM(GREATEST(reorder_level * 2, consumption_30_days)) FILTER (WHERE current_qty <= reorder_level)
    )
  ) INTO consumption_forecasts
  FROM satguru_stock_summary_view;

  -- Combine all predictions
  insights_result := jsonb_build_object(
    'prediction_type', p_prediction_type,
    'reorder_predictions', COALESCE(reorder_predictions, '{"immediate_reorder_needed": []}'::jsonb),
    'stockout_predictions', COALESCE(stockout_predictions, '{"stockout_risk_7_days": []}'::jsonb),
    'consumption_forecasts', consumption_forecasts,
    'generated_at', NOW(),
    'confidence_level', 'HIGH',
    'based_on_days', 30
  );

  RETURN insights_result;
END;
$$;