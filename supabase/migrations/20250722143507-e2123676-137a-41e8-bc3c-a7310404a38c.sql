
-- Create table for tracking CSV upload sessions
CREATE TABLE IF NOT EXISTS public.item_pricing_csv_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_records INTEGER NOT NULL DEFAULT 0,
  processed_records INTEGER NOT NULL DEFAULT 0,
  approved_records INTEGER NOT NULL DEFAULT 0,
  rejected_records INTEGER NOT NULL DEFAULT 0,
  pending_records INTEGER NOT NULL DEFAULT 0,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  processing_status TEXT DEFAULT 'PENDING' CHECK (processing_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  validation_summary JSONB,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create table for individual record validation results
CREATE TABLE IF NOT EXISTS public.item_pricing_upload_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES public.item_pricing_csv_uploads(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  item_code TEXT NOT NULL,
  proposed_price NUMERIC(15,4) NOT NULL,
  current_price NUMERIC(15,4),
  price_change_percentage NUMERIC(8,2),
  effective_date DATE,
  cost_category TEXT,
  supplier TEXT,
  change_reason TEXT,
  validation_status TEXT DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'APPROVED', 'REJECTED', 'REQUIRES_REVIEW')),
  validation_errors JSONB,
  validation_warnings JSONB,
  auto_approved BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced item price history table for better audit trails
ALTER TABLE public.item_price_history 
ADD COLUMN IF NOT EXISTS upload_id UUID REFERENCES public.item_pricing_csv_uploads(id),
ADD COLUMN IF NOT EXISTS record_id UUID REFERENCES public.item_pricing_upload_records(id),
ADD COLUMN IF NOT EXISTS validation_flags JSONB,
ADD COLUMN IF NOT EXISTS business_justification TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pricing_uploads_status ON public.item_pricing_csv_uploads(processing_status);
CREATE INDEX IF NOT EXISTS idx_pricing_uploads_user ON public.item_pricing_csv_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_pricing_upload_records_upload ON public.item_pricing_upload_records(upload_id);
CREATE INDEX IF NOT EXISTS idx_pricing_upload_records_status ON public.item_pricing_upload_records(validation_status);
CREATE INDEX IF NOT EXISTS idx_pricing_upload_records_item ON public.item_pricing_upload_records(item_code);

-- Function to validate individual pricing record
CREATE OR REPLACE FUNCTION validate_pricing_record(
  p_item_code TEXT,
  p_proposed_price NUMERIC,
  p_effective_date DATE DEFAULT CURRENT_DATE,
  p_cost_category TEXT DEFAULT NULL,
  p_supplier TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_price NUMERIC;
  v_item_exists BOOLEAN := FALSE;
  v_validation_result JSONB := '{"valid": true, "errors": [], "warnings": [], "flags": []}';
  v_price_change_pct NUMERIC;
  v_errors TEXT[] := '{}';
  v_warnings TEXT[] := '{}';
  v_flags TEXT[] := '{}';
BEGIN
  -- Check if item exists
  SELECT current_price INTO v_current_price
  FROM public.item_pricing_master
  WHERE item_code = p_item_code AND is_active = true
  ORDER BY effective_date DESC
  LIMIT 1;
  
  IF v_current_price IS NOT NULL THEN
    v_item_exists := TRUE;
    v_price_change_pct := ((p_proposed_price - v_current_price) / v_current_price) * 100;
  ELSE
    -- Check if item exists in item master
    IF NOT EXISTS (SELECT 1 FROM public.satguru_item_master WHERE item_code = p_item_code) THEN
      v_errors := array_append(v_errors, 'Item code does not exist in item master');
    ELSE
      v_flags := array_append(v_flags, 'NEW_ITEM_PRICING');
    END IF;
  END IF;
  
  -- Price validation
  IF p_proposed_price <= 0 THEN
    v_errors := array_append(v_errors, 'Price must be greater than zero');
  END IF;
  
  IF p_proposed_price > 100000 THEN
    v_warnings := array_append(v_warnings, 'Price exceeds ₹100,000 - please verify');
    v_flags := array_append(v_flags, 'HIGH_PRICE_ALERT');
  END IF;
  
  -- Price change validation (if existing price)
  IF v_item_exists AND v_price_change_pct IS NOT NULL THEN
    IF ABS(v_price_change_pct) > 500 THEN
      v_errors := array_append(v_errors, 'Price change exceeds 500% - requires manual review');
      v_flags := array_append(v_flags, 'EXTREME_PRICE_CHANGE');
    ELSIF ABS(v_price_change_pct) > 100 THEN
      v_warnings := array_append(v_warnings, 'Significant price change: ' || ROUND(v_price_change_pct, 2)::TEXT || '%');
      v_flags := array_append(v_flags, 'SIGNIFICANT_PRICE_CHANGE');
    END IF;
  END IF;
  
  -- Date validation
  IF p_effective_date > CURRENT_DATE + INTERVAL '30 days' THEN
    v_warnings := array_append(v_warnings, 'Effective date is more than 30 days in future');
  END IF;
  
  IF p_effective_date < CURRENT_DATE - INTERVAL '365 days' THEN
    v_warnings := array_append(v_warnings, 'Effective date is more than 1 year old');
  END IF;
  
  -- Build result
  v_validation_result := jsonb_build_object(
    'valid', array_length(v_errors, 1) IS NULL,
    'errors', to_jsonb(v_errors),
    'warnings', to_jsonb(v_warnings),
    'flags', to_jsonb(v_flags),
    'current_price', v_current_price,
    'price_change_percentage', v_price_change_pct,
    'requires_review', (
      array_length(v_errors, 1) > 0 OR 
      'EXTREME_PRICE_CHANGE' = ANY(v_flags) OR 
      'HIGH_PRICE_ALERT' = ANY(v_flags)
    )
  );
  
  RETURN v_validation_result;
END;
$$;

-- Function to process bulk pricing upload
CREATE OR REPLACE FUNCTION process_pricing_upload_batch(
  p_upload_id UUID,
  p_records JSONB,
  p_auto_approve_threshold NUMERIC DEFAULT 50.0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec JSONB;
  validation_result JSONB;
  record_id UUID;
  processed_count INTEGER := 0;
  approved_count INTEGER := 0;
  rejected_count INTEGER := 0;
  pending_count INTEGER := 0;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(p_records) LOOP
    -- Validate the record
    validation_result := validate_pricing_record(
      rec->>'item_code',
      (rec->>'proposed_price')::NUMERIC,
      COALESCE((rec->>'effective_date')::DATE, CURRENT_DATE),
      rec->>'cost_category',
      rec->>'supplier'
    );
    
    -- Insert record
    INSERT INTO public.item_pricing_upload_records (
      upload_id,
      row_number,
      item_code,
      proposed_price,
      current_price,
      price_change_percentage,
      effective_date,
      cost_category,
      supplier,
      change_reason,
      validation_status,
      validation_errors,
      validation_warnings,
      auto_approved
    ) VALUES (
      p_upload_id,
      (rec->>'row_number')::INTEGER,
      rec->>'item_code',
      (rec->>'proposed_price')::NUMERIC,
      (validation_result->>'current_price')::NUMERIC,
      (validation_result->>'price_change_percentage')::NUMERIC,
      COALESCE((rec->>'effective_date')::DATE, CURRENT_DATE),
      rec->>'cost_category',
      rec->>'supplier',
      COALESCE(rec->>'change_reason', 'Bulk CSV upload'),
      CASE 
        WHEN NOT (validation_result->>'valid')::BOOLEAN THEN 'REJECTED'
        WHEN (validation_result->>'requires_review')::BOOLEAN THEN 'REQUIRES_REVIEW'
        WHEN ABS(COALESCE((validation_result->>'price_change_percentage')::NUMERIC, 0)) <= p_auto_approve_threshold THEN 'APPROVED'
        ELSE 'REQUIRES_REVIEW'
      END,
      validation_result->'errors',
      validation_result->'warnings',
      CASE 
        WHEN (validation_result->>'valid')::BOOLEAN AND 
             NOT (validation_result->>'requires_review')::BOOLEAN AND
             ABS(COALESCE((validation_result->>'price_change_percentage')::NUMERIC, 0)) <= p_auto_approve_threshold 
        THEN TRUE 
        ELSE FALSE 
      END
    ) RETURNING id INTO record_id;
    
    processed_count := processed_count + 1;
    
    -- Count by status
    IF NOT (validation_result->>'valid')::BOOLEAN THEN
      rejected_count := rejected_count + 1;
    ELSIF (validation_result->>'requires_review')::BOOLEAN OR 
          ABS(COALESCE((validation_result->>'price_change_percentage')::NUMERIC, 0)) > p_auto_approve_threshold THEN
      pending_count := pending_count + 1;
    ELSE
      approved_count := approved_count + 1;
      
      -- Auto-approve: Update item pricing master
      PERFORM update_item_price(
        rec->>'item_code',
        (rec->>'proposed_price')::NUMERIC,
        COALESCE(rec->>'change_reason', 'Bulk CSV upload - auto-approved')
      );
      
      -- Link to price history
      UPDATE public.item_price_history 
      SET upload_id = p_upload_id, record_id = record_id
      WHERE item_code = rec->>'item_code' 
        AND created_at >= NOW() - INTERVAL '1 minute';
    END IF;
  END LOOP;
  
  -- Update upload summary
  UPDATE public.item_pricing_csv_uploads SET
    processed_records = processed_count,
    approved_records = approved_count,
    rejected_records = rejected_count,
    pending_records = pending_count,
    processing_status = 'COMPLETED',
    completed_at = NOW()
  WHERE id = p_upload_id;
  
  RETURN jsonb_build_object(
    'processed', processed_count,
    'approved', approved_count,
    'rejected', rejected_count,
    'pending', pending_count
  );
END;
$$;

-- RLS Policies
ALTER TABLE public.item_pricing_csv_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_pricing_upload_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can manage pricing uploads" ON public.item_pricing_csv_uploads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid() 
      AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

CREATE POLICY "Approved users can manage upload records" ON public.item_pricing_upload_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid() 
      AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );
