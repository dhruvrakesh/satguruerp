-- Create AI Intelligence Snapshots table
CREATE TABLE IF NOT EXISTS public.ai_intelligence_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID,
  inventory_health_score NUMERIC DEFAULT 0,
  process_efficiency_score NUMERIC DEFAULT 0,
  quality_score NUMERIC DEFAULT 0,
  overall_intelligence_score NUMERIC DEFAULT 0,
  total_insights INTEGER DEFAULT 0,
  actionable_items INTEGER DEFAULT 0,
  critical_alerts INTEGER DEFAULT 0,
  material_insights JSONB NOT NULL DEFAULT '{}',
  category_analysis JSONB NOT NULL DEFAULT '{}',
  cross_correlations JSONB NOT NULL DEFAULT '{}',
  outliers_detected JSONB NOT NULL DEFAULT '[]',
  executive_summary JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create User Intelligence Sessions table
CREATE TABLE IF NOT EXISTS public.user_intelligence_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  session_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  session_end TIMESTAMP WITH TIME ZONE,
  insights_viewed INTEGER DEFAULT 0,
  actions_taken INTEGER DEFAULT 0,
  categories_accessed TEXT[] DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  learning_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create RLS policies for AI Intelligence Snapshots
ALTER TABLE public.ai_intelligence_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization snapshots" 
ON public.ai_intelligence_snapshots 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.organization_id = ai_intelligence_snapshots.organization_id
  )
);

CREATE POLICY "System can insert snapshots" 
ON public.ai_intelligence_snapshots 
FOR INSERT 
WITH CHECK (true);

-- Create RLS policies for User Intelligence Sessions
ALTER TABLE public.user_intelligence_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sessions" 
ON public.user_intelligence_sessions 
FOR ALL 
USING (auth.uid() = user_id);

-- Create RPC function for tracking user session activity
CREATE OR REPLACE FUNCTION public.update_user_session_activity(
  p_insights_viewed INTEGER DEFAULT 0,
  p_actions_taken INTEGER DEFAULT 0,
  p_categories_accessed TEXT[] DEFAULT '{}',
  p_preferences JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_id UUID;
  user_org_id UUID;
BEGIN
  -- Get user's organization
  SELECT organization_id INTO user_org_id
  FROM profiles
  WHERE id = auth.uid();
  
  -- Update or create session
  INSERT INTO public.user_intelligence_sessions (
    user_id,
    insights_viewed,
    actions_taken,
    categories_accessed,
    preferences,
    updated_at
  ) VALUES (
    auth.uid(),
    p_insights_viewed,
    p_actions_taken,
    p_categories_accessed,
    p_preferences,
    now()
  ) 
  ON CONFLICT (user_id) 
  DO UPDATE SET
    insights_viewed = user_intelligence_sessions.insights_viewed + p_insights_viewed,
    actions_taken = user_intelligence_sessions.actions_taken + p_actions_taken,
    categories_accessed = array_cat(user_intelligence_sessions.categories_accessed, p_categories_accessed),
    preferences = p_preferences,
    updated_at = now()
  RETURNING id INTO session_id;
  
  RETURN session_id;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_snapshots_date ON public.ai_intelligence_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_ai_snapshots_org ON public.ai_intelligence_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_intelligence_sessions(user_id);