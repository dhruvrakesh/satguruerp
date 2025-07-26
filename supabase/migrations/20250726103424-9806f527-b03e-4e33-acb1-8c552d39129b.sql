-- Create project-specific AI tables for SATGURU manufacturing system

-- SATGURU AI Conversations table
CREATE TABLE public.satguru_ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Manufacturing Chat',
  context_type TEXT DEFAULT 'general' CHECK (context_type IN ('general', 'manufacturing', 'inventory', 'analytics', 'quality_control', 'process_optimization')),
  manufacturing_context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_archived BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE
);

-- SATGURU AI Messages table
CREATE TABLE public.satguru_ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES satguru_ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  manufacturing_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- SATGURU AI Insights table
CREATE TABLE public.satguru_ai_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('inventory_optimization', 'process_efficiency', 'quality_control', 'cost_analysis', 'maintenance_prediction', 'workflow_bottleneck')),
  data JSONB DEFAULT '{}'::jsonb,
  manufacturing_context JSONB DEFAULT '{}'::jsonb,
  confidence_score NUMERIC DEFAULT 0.75 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- SATGURU AI Usage Analytics table
CREATE TABLE public.satguru_ai_usage_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('chat', 'insights', 'analytics', 'optimization')),
  tokens_used INTEGER DEFAULT 0,
  cost_estimate NUMERIC DEFAULT 0,
  session_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- SATGURU AI Context Data table (for manufacturing-specific context)
CREATE TABLE public.satguru_ai_context_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES satguru_ai_conversations(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL CHECK (context_type IN ('stock_levels', 'bom_data', 'order_status', 'quality_metrics', 'process_parameters')),
  context_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_satguru_ai_conversations_user_id ON satguru_ai_conversations(user_id);
CREATE INDEX idx_satguru_ai_conversations_organization_id ON satguru_ai_conversations(organization_id);
CREATE INDEX idx_satguru_ai_conversations_context_type ON satguru_ai_conversations(context_type);
CREATE INDEX idx_satguru_ai_messages_conversation_id ON satguru_ai_messages(conversation_id);
CREATE INDEX idx_satguru_ai_messages_created_at ON satguru_ai_messages(created_at);
CREATE INDEX idx_satguru_ai_insights_user_id ON satguru_ai_insights(user_id);
CREATE INDEX idx_satguru_ai_insights_organization_id ON satguru_ai_insights(organization_id);
CREATE INDEX idx_satguru_ai_insights_insight_type ON satguru_ai_insights(insight_type);
CREATE INDEX idx_satguru_ai_insights_is_read ON satguru_ai_insights(is_read);
CREATE INDEX idx_satguru_ai_usage_analytics_user_id ON satguru_ai_usage_analytics(user_id);
CREATE INDEX idx_satguru_ai_usage_analytics_organization_id ON satguru_ai_usage_analytics(organization_id);
CREATE INDEX idx_satguru_ai_context_data_conversation_id ON satguru_ai_context_data(conversation_id);

-- Enable Row Level Security
ALTER TABLE public.satguru_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.satguru_ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.satguru_ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.satguru_ai_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.satguru_ai_context_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for SATGURU organization only
CREATE POLICY "SATGURU users can manage their own conversations" ON public.satguru_ai_conversations
FOR ALL USING (
  auth.uid() = user_id AND
  organization_id = (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() AND organization_id IN (
      SELECT id FROM organizations WHERE code = 'SATGURU'
    )
  )
);

CREATE POLICY "SATGURU users can manage their own messages" ON public.satguru_ai_messages
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM satguru_ai_conversations 
    WHERE id = satguru_ai_messages.conversation_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "SATGURU users can manage their own insights" ON public.satguru_ai_insights
FOR ALL USING (
  auth.uid() = user_id AND
  organization_id = (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() AND organization_id IN (
      SELECT id FROM organizations WHERE code = 'SATGURU'
    )
  )
);

CREATE POLICY "SATGURU users can manage their own usage analytics" ON public.satguru_ai_usage_analytics
FOR ALL USING (
  auth.uid() = user_id AND
  organization_id = (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid() AND organization_id IN (
      SELECT id FROM organizations WHERE code = 'SATGURU'
    )
  )
);

CREATE POLICY "SATGURU users can manage context data for their conversations" ON public.satguru_ai_context_data
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM satguru_ai_conversations 
    WHERE id = satguru_ai_context_data.conversation_id 
    AND user_id = auth.uid()
  )
);

-- Create function to get manufacturing context for AI
CREATE OR REPLACE FUNCTION public.get_manufacturing_context_for_ai(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  context_data JSONB := '{}'::jsonb;
  stock_summary JSONB;
  recent_orders JSONB;
  low_stock_items JSONB;
BEGIN
  -- Get stock summary
  SELECT jsonb_build_object(
    'total_items', COUNT(*),
    'low_stock_count', COUNT(*) FILTER (WHERE current_qty < reorder_level),
    'total_value', COALESCE(SUM(current_qty * COALESCE(rate, 0)), 0)
  ) INTO stock_summary
  FROM satguru_stock s
  LEFT JOIN satguru_item_pricing sp ON s.item_code = sp.item_code;
  
  -- Get recent manufacturing orders
  SELECT jsonb_agg(
    jsonb_build_object(
      'uiorn', uiorn,
      'status', status,
      'created_at', created_at,
      'customer_code', customer_code
    )
  ) INTO recent_orders
  FROM (
    SELECT uiorn, status, created_at, customer_code
    FROM orders_dashboard_se
    ORDER BY created_at DESC
    LIMIT 10
  ) recent;
  
  -- Get low stock items
  SELECT jsonb_agg(
    jsonb_build_object(
      'item_code', s.item_code,
      'current_qty', s.current_qty,
      'reorder_level', s.reorder_level,
      'item_name', im.item_name
    )
  ) INTO low_stock_items
  FROM satguru_stock s
  LEFT JOIN satguru_item_master im ON s.item_code = im.item_code
  WHERE s.current_qty < s.reorder_level
  LIMIT 20;
  
  -- Build context
  context_data := jsonb_build_object(
    'stock_summary', COALESCE(stock_summary, '{}'::jsonb),
    'recent_orders', COALESCE(recent_orders, '[]'::jsonb),
    'low_stock_items', COALESCE(low_stock_items, '[]'::jsonb),
    'timestamp', extract(epoch from now())
  );
  
  RETURN context_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;