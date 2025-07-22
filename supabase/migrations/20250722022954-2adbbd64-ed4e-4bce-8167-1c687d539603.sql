
-- First, let's check and align the database enums with the frontend configuration
-- Update process_stage enum to include all required stages
DO $$ 
BEGIN
  -- Add missing enum values if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ARTWORK_UPLOAD' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'process_stage')) THEN
    ALTER TYPE process_stage ADD VALUE 'ARTWORK_UPLOAD';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'LAMINATION_COATING' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'process_stage')) THEN
    ALTER TYPE process_stage ADD VALUE 'LAMINATION_COATING';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SLITTING_PACKING' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'process_stage')) THEN
    ALTER TYPE process_stage ADD VALUE 'SLITTING_PACKING';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PACKAGING' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'process_stage')) THEN
    ALTER TYPE process_stage ADD VALUE 'PACKAGING';
  END IF;
END $$;

-- Update process_status enum to align with frontend
DO $$ 
BEGIN
  -- Check if process_status enum exists, if not create it
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'process_status') THEN
    CREATE TYPE process_status AS ENUM (
      'pending',
      'in_progress', 
      'completed',
      'on_hold',
      'cancelled'
    );
  END IF;
END $$;

-- Create a unified manufacturing stage status table
CREATE TABLE IF NOT EXISTS manufacturing_stage_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uiorn TEXT NOT NULL,
  stage process_stage NOT NULL,
  status process_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  operator_id UUID,
  machine_id TEXT,
  process_parameters JSONB DEFAULT '{}',
  quality_metrics JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(uiorn, stage)
);

-- Enable RLS
ALTER TABLE manufacturing_stage_status ENABLE ROW LEVEL SECURITY;

-- Create policy for Satguru users
CREATE POLICY "Satguru users can manage manufacturing stage status" 
ON manufacturing_stage_status 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() AND o.code = 'SATGURU'
  )
);

-- Create function to handle stage transitions
CREATE OR REPLACE FUNCTION handle_manufacturing_stage_transition(
  p_uiorn TEXT,
  p_stage process_stage,
  p_status process_status,
  p_operator_id UUID DEFAULT NULL,
  p_machine_id TEXT DEFAULT NULL,
  p_process_parameters JSONB DEFAULT '{}',
  p_quality_metrics JSONB DEFAULT '{}',
  p_notes TEXT DEFAULT NULL
) RETURNS manufacturing_stage_status AS $$
DECLARE
  result manufacturing_stage_status;
BEGIN
  INSERT INTO manufacturing_stage_status (
    uiorn, stage, status, operator_id, machine_id, 
    process_parameters, quality_metrics, notes,
    started_at, completed_at
  ) VALUES (
    p_uiorn, p_stage, p_status, p_operator_id, p_machine_id,
    p_process_parameters, p_quality_metrics, p_notes,
    CASE WHEN p_status = 'in_progress' THEN now() ELSE NULL END,
    CASE WHEN p_status = 'completed' THEN now() ELSE NULL END
  )
  ON CONFLICT (uiorn, stage) 
  DO UPDATE SET
    status = p_status,
    operator_id = COALESCE(p_operator_id, manufacturing_stage_status.operator_id),
    machine_id = COALESCE(p_machine_id, manufacturing_stage_status.machine_id),
    process_parameters = COALESCE(p_process_parameters, manufacturing_stage_status.process_parameters),
    quality_metrics = COALESCE(p_quality_metrics, manufacturing_stage_status.quality_metrics),
    notes = COALESCE(p_notes, manufacturing_stage_status.notes),
    started_at = CASE 
      WHEN p_status = 'in_progress' AND manufacturing_stage_status.started_at IS NULL 
      THEN now() 
      ELSE manufacturing_stage_status.started_at 
    END,
    completed_at = CASE 
      WHEN p_status = 'completed' 
      THEN now() 
      ELSE NULL 
    END,
    updated_at = now()
  RETURNING * INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
