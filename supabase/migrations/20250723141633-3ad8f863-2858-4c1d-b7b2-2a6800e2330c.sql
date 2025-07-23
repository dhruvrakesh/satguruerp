-- Create a function to log pricing audit events
CREATE OR REPLACE FUNCTION log_audit_event_pricing(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.pricing_audit_log (
    action,
    entity_type, 
    entity_id,
    old_data,
    new_data,
    user_id,
    metadata
  ) VALUES (
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_data,
    p_new_data,
    auth.uid(),
    p_metadata
  );
END;
$$;