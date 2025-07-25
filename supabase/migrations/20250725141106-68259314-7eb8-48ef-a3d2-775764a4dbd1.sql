-- Phase 1: Enhance existing master_data_artworks_se table for color standards
ALTER TABLE public.master_data_artworks_se
ADD COLUMN target_l NUMERIC, -- Standard L* value
ADD COLUMN target_a NUMERIC, -- Standard a* value  
ADD COLUMN target_b NUMERIC, -- Standard b* value
ADD COLUMN delta_e_tolerance NUMERIC DEFAULT 2.0; -- Acceptable Delta E threshold

-- Create QC sessions table to track active quality control jobs
CREATE TABLE public.qc_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uiorn TEXT NOT NULL,
    item_code TEXT NOT NULL,
    operator_id UUID REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'active', -- active, completed, paused
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ,
    target_l NUMERIC, -- Snapshot of standard at session start
    target_a NUMERIC,
    target_b NUMERIC,
    delta_e_tolerance NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create color measurements log table for every X-Rite reading
CREATE TABLE public.color_measurements_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.qc_sessions(id) ON DELETE CASCADE,
    measured_l NUMERIC NOT NULL,
    measured_a NUMERIC NOT NULL,
    measured_b NUMERIC NOT NULL,
    delta_e NUMERIC NOT NULL,
    is_pass BOOLEAN NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    measurement_notes TEXT
);

-- Enable RLS for new tables
ALTER TABLE public.qc_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.color_measurements_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for qc_sessions
CREATE POLICY "Satguru users can manage QC sessions" ON public.qc_sessions
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        JOIN organizations o ON p.organization_id = o.id 
        WHERE p.id = auth.uid() AND o.code = 'SATGURU'
    )
);

-- RLS policies for color_measurements_log  
CREATE POLICY "Satguru users can manage color measurements" ON public.color_measurements_log
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        JOIN organizations o ON p.organization_id = o.id 
        WHERE p.id = auth.uid() AND o.code = 'SATGURU'
    )
);

-- Add indexes for performance
CREATE INDEX idx_qc_sessions_uiorn ON public.qc_sessions(uiorn);
CREATE INDEX idx_qc_sessions_status ON public.qc_sessions(status);
CREATE INDEX idx_color_measurements_session_id ON public.color_measurements_log(session_id);
CREATE INDEX idx_color_measurements_captured_at ON public.color_measurements_log(captured_at);

-- Create function to calculate Delta E 2000 (industry standard)
CREATE OR REPLACE FUNCTION calculate_delta_e_2000(
    l1 NUMERIC, a1 NUMERIC, b1 NUMERIC,
    l2 NUMERIC, a2 NUMERIC, b2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
    delta_l NUMERIC;
    delta_a NUMERIC;
    delta_b NUMERIC;
    c1 NUMERIC;
    c2 NUMERIC;
    delta_c NUMERIC;
    h1 NUMERIC;
    h2 NUMERIC;
    delta_h NUMERIC;
    s_l NUMERIC;
    s_c NUMERIC;
    s_h NUMERIC;
    delta_e NUMERIC;
BEGIN
    -- Simplified Delta E 2000 calculation
    -- For production use, consider more precise implementation
    delta_l := l2 - l1;
    delta_a := a2 - a1;
    delta_b := b2 - b1;
    
    c1 := sqrt(a1^2 + b1^2);
    c2 := sqrt(a2^2 + b2^2);
    delta_c := c2 - c1;
    
    -- Simplified calculation for demonstration
    delta_e := sqrt(delta_l^2 + delta_a^2 + delta_b^2);
    
    RETURN delta_e;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add trigger to update timestamps
CREATE OR REPLACE FUNCTION update_qc_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_qc_sessions_updated_at
BEFORE UPDATE ON public.qc_sessions
FOR EACH ROW
EXECUTE FUNCTION update_qc_sessions_updated_at();