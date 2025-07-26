import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Manufacturing Intelligence function called:', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    // Verify SATGURU organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, organizations!inner(code)')
      .eq('id', user.id)
      .single();
    
    if (!profile || profile.organizations.code !== 'SATGURU') {
      throw new Error('Access denied: SATGURU organization required');
    }

    const { 
      analysisType = 'comprehensive',
      queryType = 'inventory_analysis' 
    } = await req.json();

    const startTime = Date.now();
    let results = {};
    let insights = [];

    console.log('Running analysis type:', analysisType, 'query type:', queryType);

    switch (queryType) {
      case 'inventory_analysis':
        const { data: inventoryData, error: invError } = await supabase
          .rpc('get_advanced_manufacturing_analytics', {
            p_user_id: user.id,
            p_analysis_type: analysisType
          });

        if (invError) {
          console.error('Inventory analysis error:', invError);
          throw new Error(`Inventory analysis failed: ${invError.message}`);
        }

        results = inventoryData;
        
        // Generate AI insights based on inventory data
        if (inventoryData?.inventory_intelligence?.low_stock_items > 0) {
          insights.push({
            type: 'critical_alert',
            title: 'Low Stock Alert',
            message: `${inventoryData.inventory_intelligence.low_stock_items} items below reorder level`,
            priority: 'high',
            actionable: true,
            recommendation: 'Review and place urgent purchase orders for critical items'
          });
        }

        if (inventoryData?.process_efficiency?.bottlenecks?.length > 0) {
          insights.push({
            type: 'process_optimization',
            title: 'Process Bottlenecks Detected',
            message: `${inventoryData.process_efficiency.bottlenecks.length} process bottlenecks identified`,
            priority: 'medium',
            actionable: true,
            recommendation: 'Analyze and optimize high-wait-time process stages'
          });
        }

        if (inventoryData?.quality_metrics?.quality_rate < 95) {
          insights.push({
            type: 'quality_concern',
            title: 'Quality Rate Below Target',
            message: `Quality rate is ${inventoryData.quality_metrics.quality_rate}%, target: 95%`,
            priority: 'high',
            actionable: true,
            recommendation: 'Review quality control processes and recent failures'
          });
        }
        break;

      case 'predictive_analytics':
        const { data: predictiveData, error: predError } = await supabase
          .rpc('generate_predictive_insights', {
            p_user_id: user.id,
            p_prediction_type: 'demand_forecast'
          });

        if (predError) {
          console.error('Predictive analysis error:', predError);
          throw new Error(`Predictive analysis failed: ${predError.message}`);
        }

        results = predictiveData;

        // Generate predictive insights
        if (predictiveData?.demand_forecast?.next_month_demand) {
          const highPriorityItems = Object.entries(predictiveData.demand_forecast.next_month_demand)
            .filter(([_, data]: [string, any]) => data.reorder_suggestion === 'HIGH_PRIORITY')
            .length;

          if (highPriorityItems > 0) {
            insights.push({
              type: 'predictive_alert',
              title: 'High Priority Reorders Predicted',
              message: `${highPriorityItems} items predicted to need urgent reordering next month`,
              priority: 'high',
              actionable: true,
              recommendation: 'Plan procurement for predicted high-demand items'
            });
          }
        }
        break;

      case 'process_optimization':
        // Real-time process analysis
        const { data: processData, error: processError } = await supabase
          .from('process_logs_se')
          .select(`
            stage,
            captured_at,
            uiorn,
            metric,
            value,
            txt_value
          `)
          .gte('captured_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('captured_at', { ascending: false })
          .limit(1000);

        if (processError) {
          throw new Error(`Process data query failed: ${processError.message}`);
        }

        // Analyze process efficiency
        const processMetrics = {};
        const stageStats = {};

        processData?.forEach(log => {
          if (!stageStats[log.stage]) {
            stageStats[log.stage] = {
              count: 0,
              orders: new Set(),
              latest: null,
              avgValue: 0,
              values: []
            };
          }

          stageStats[log.stage].count++;
          stageStats[log.stage].orders.add(log.uiorn);
          stageStats[log.stage].latest = log.captured_at;
          
          if (log.value) {
            stageStats[log.stage].values.push(log.value);
            stageStats[log.stage].avgValue = stageStats[log.stage].values.reduce((a, b) => a + b, 0) / stageStats[log.stage].values.length;
          }
        });

        results = {
          timestamp: new Date().toISOString(),
          analysis_type: 'process_optimization',
          stage_statistics: Object.entries(stageStats).map(([stage, stats]: [string, any]) => ({
            stage,
            activity_count: stats.count,
            unique_orders: stats.orders.size,
            latest_activity: stats.latest,
            average_value: stats.avgValue || 0,
            efficiency_score: Math.min(100, (stats.count / Math.max(1, stats.orders.size)) * 20) // Simple efficiency metric
          })),
          recommendations: [
            'Monitor stages with low efficiency scores',
            'Balance workload across process stages',
            'Implement automated tracking for high-volume stages'
          ]
        };

        // Generate process insights
        const lowEfficiencyStages = Object.entries(stageStats)
          .filter(([_, stats]: [string, any]) => stats.count < 5)
          .map(([stage, _]) => stage);

        if (lowEfficiencyStages.length > 0) {
          insights.push({
            type: 'process_efficiency',
            title: 'Low Activity Process Stages',
            message: `${lowEfficiencyStages.length} stages with minimal activity: ${lowEfficiencyStages.join(', ')}`,
            priority: 'medium',
            actionable: true,
            recommendation: 'Review workflow for underutilized process stages'
          });
        }
        break;

      default:
        throw new Error(`Unknown query type: ${queryType}`);
    }

    const executionTime = Date.now() - startTime;

    // Log the intelligence query
    const { error: logError } = await supabase
      .from('satguru_ai_intelligence_queries')
      .insert({
        user_id: user.id,
        organization_id: profile.organization_id,
        query_type: queryType,
        query_parameters: { analysisType },
        analysis_results: results,
        insights: insights,
        confidence_score: 0.85,
        execution_time_ms: executionTime
      });

    if (logError) {
      console.error('Failed to log intelligence query:', logError);
    }

    console.log(`Analysis completed in ${executionTime}ms with ${insights.length} insights`);

    return new Response(JSON.stringify({
      success: true,
      analysisType,
      queryType,
      executionTime,
      results,
      insights,
      metadata: {
        timestamp: new Date().toISOString(),
        user_id: user.id,
        organization: 'SATGURU'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Manufacturing Intelligence Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});