-- Create pricing audit log table for enterprise-grade tracking
CREATE TABLE public.pricing_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Approved users can view audit logs" 
ON public.pricing_audit_log 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid() 
    AND p.is_approved = true 
    AND o.code IN ('DKEGL', 'SATGURU')
  )
);

CREATE POLICY "Authenticated users can create audit logs" 
ON public.pricing_audit_log 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Create index for better performance
CREATE INDEX idx_pricing_audit_log_entity ON public.pricing_audit_log(entity_type, entity_id);
CREATE INDEX idx_pricing_audit_log_user ON public.pricing_audit_log(user_id);
CREATE INDEX idx_pricing_audit_log_created ON public.pricing_audit_log(created_at DESC);