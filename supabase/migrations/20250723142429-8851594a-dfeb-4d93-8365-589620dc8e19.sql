-- Phase 1: Create Dedicated Valuation Management Tables

-- 1. Valuation Item Codes (project-specific item code generation)
CREATE TABLE public.valuation_item_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code TEXT NOT NULL UNIQUE,
  category_name TEXT NOT NULL,
  usage_type TEXT NOT NULL,
  qualifier TEXT,
  size_mm NUMERIC,
  gsm NUMERIC,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'
);

-- 2. Valuation Price History (complete audit trail)
CREATE TABLE public.valuation_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code TEXT NOT NULL,
  old_price NUMERIC,
  new_price NUMERIC NOT NULL,
  change_reason TEXT,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  changed_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approval_status TEXT DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  price_source TEXT DEFAULT 'MANUAL' CHECK (price_source IN ('MANUAL', 'BULK_IMPORT', 'GRN_AUTO', 'SYSTEM_GENERATED')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- 3. Valuation Approvals (multi-level approval workflow)
CREATE TABLE public.valuation_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_type TEXT NOT NULL CHECK (request_type IN ('PRICE_CHANGE', 'BULK_IMPORT', 'CATEGORY_CHANGE', 'ITEM_CREATION')),
  entity_id TEXT NOT NULL, -- item_code, batch_id, etc.
  requested_by UUID REFERENCES auth.users(id),
  approval_level INTEGER NOT NULL DEFAULT 1,
  approver_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED')),
  decision_date TIMESTAMP WITH TIME ZONE,
  decision_notes TEXT,
  request_amount NUMERIC, -- for amount-based approval rules
  request_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Valuation Bulk Operations (track bulk operations)
CREATE TABLE public.valuation_bulk_operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('PRICE_IMPORT', 'PRICE_EXPORT', 'STOCK_ADJUSTMENT', 'CATEGORY_UPDATE')),
  status TEXT DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  success_records INTEGER DEFAULT 0,
  file_name TEXT,
  file_size_mb NUMERIC,
  started_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_details JSONB DEFAULT '[]',
  success_details JSONB DEFAULT '[]',
  operation_summary JSONB DEFAULT '{}'
);

-- 5. Valuation Analytics Cache (performance optimization)
CREATE TABLE public.valuation_analytics_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  cache_type TEXT NOT NULL CHECK (cache_type IN ('CATEGORY_TOTALS', 'VALUATION_SUMMARY', 'TREND_ANALYSIS', 'ABC_ANALYSIS')),
  filters_hash TEXT NOT NULL,
  cached_data JSONB NOT NULL,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  calculation_time_ms INTEGER,
  record_count INTEGER
);

-- Enable RLS on all tables
ALTER TABLE public.valuation_item_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_bulk_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_analytics_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for Satguru organization users
CREATE POLICY "Satguru users can manage valuation item codes" 
ON public.valuation_item_codes 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid() 
    AND o.code = 'SATGURU'
  )
);

CREATE POLICY "Satguru users can manage price history" 
ON public.valuation_price_history 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid() 
    AND o.code = 'SATGURU'
  )
);

CREATE POLICY "Satguru users can manage approvals" 
ON public.valuation_approvals 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid() 
    AND o.code = 'SATGURU'
  )
);

CREATE POLICY "Satguru users can manage bulk operations" 
ON public.valuation_bulk_operations 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid() 
    AND o.code = 'SATGURU'
  )
);

CREATE POLICY "Satguru users can access analytics cache" 
ON public.valuation_analytics_cache 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = auth.uid() 
    AND o.code = 'SATGURU'
  )
);

-- Create indexes for performance
CREATE INDEX idx_valuation_item_codes_category ON public.valuation_item_codes(category_name);
CREATE INDEX idx_valuation_item_codes_active ON public.valuation_item_codes(is_active) WHERE is_active = true;
CREATE INDEX idx_valuation_price_history_item ON public.valuation_price_history(item_code);
CREATE INDEX idx_valuation_price_history_date ON public.valuation_price_history(effective_date DESC);
CREATE INDEX idx_valuation_approvals_status ON public.valuation_approvals(status, request_type);
CREATE INDEX idx_valuation_bulk_operations_status ON public.valuation_bulk_operations(status, operation_type);
CREATE INDEX idx_valuation_analytics_cache_key ON public.valuation_analytics_cache(cache_key);
CREATE INDEX idx_valuation_analytics_cache_expires ON public.valuation_analytics_cache(expires_at);

-- Create dedicated functions for valuation management

-- 1. Generate Valuation Item Code (project-specific)
CREATE OR REPLACE FUNCTION public.generate_valuation_item_code(
  p_category_name TEXT,
  p_usage_type TEXT DEFAULT 'RAW_MATERIAL',
  p_qualifier TEXT DEFAULT NULL,
  p_size_mm NUMERIC DEFAULT NULL,
  p_gsm NUMERIC DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_code TEXT;
  v_final_code TEXT;
  v_counter INTEGER := 1;
  v_suffix TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Build base code from parameters
  v_base_code := UPPER(LEFT(p_category_name, 6));
  
  -- Add usage type abbreviation
  CASE p_usage_type
    WHEN 'RAW_MATERIAL' THEN v_base_code := v_base_code || '_RM';
    WHEN 'FINISHED_GOOD' THEN v_base_code := v_base_code || '_FG';
    WHEN 'WIP' THEN v_base_code := v_base_code || '_WIP';
    WHEN 'PACKAGING' THEN v_base_code := v_base_code || '_PKG';
    WHEN 'CONSUMABLE' THEN v_base_code := v_base_code || '_CON';
    ELSE v_base_code := v_base_code || '_GEN';
  END CASE;
  
  -- Add qualifier if provided
  IF p_qualifier IS NOT NULL THEN
    v_base_code := v_base_code || '_' || UPPER(LEFT(p_qualifier, 6));
  END IF;
  
  -- Add size if provided
  IF p_size_mm IS NOT NULL THEN
    v_base_code := v_base_code || '_' || p_size_mm::TEXT;
  END IF;
  
  -- Add GSM if provided
  IF p_gsm IS NOT NULL THEN
    v_base_code := v_base_code || '_' || p_gsm::TEXT || 'GSM';
  END IF;
  
  -- Generate unique code with counter
  LOOP
    v_suffix := LPAD(v_counter::TEXT, 3, '0');
    v_final_code := v_base_code || '_' || v_suffix;
    
    -- Check uniqueness in both valuation_item_codes and satguru_item_master
    SELECT EXISTS(
      SELECT 1 FROM public.valuation_item_codes WHERE item_code = v_final_code
      UNION
      SELECT 1 FROM public.satguru_item_master WHERE item_code = v_final_code
    ) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
    v_counter := v_counter + 1;
    
    -- Prevent infinite loop
    IF v_counter > 999 THEN
      RAISE EXCEPTION 'Unable to generate unique item code for %', v_base_code;
    END IF;
  END LOOP;
  
  -- Store generated code
  INSERT INTO public.valuation_item_codes (
    item_code, category_name, usage_type, qualifier, size_mm, gsm, generated_by
  ) VALUES (
    v_final_code, p_category_name, p_usage_type, p_qualifier, p_size_mm, p_gsm, auth.uid()
  );
  
  RETURN v_final_code;
END;
$$;

-- 2. Calculate Stock Valuation with multiple methods
CREATE OR REPLACE FUNCTION public.calculate_stock_valuation(
  p_item_code TEXT DEFAULT NULL,
  p_valuation_method TEXT DEFAULT 'WEIGHTED_AVG',
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  item_code TEXT,
  item_name TEXT,
  category_name TEXT,
  current_qty NUMERIC,
  unit_cost NUMERIC,
  total_value NUMERIC,
  valuation_method TEXT,
  last_transaction_date DATE,
  cost_layers JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Implementation for FIFO, LIFO, and Weighted Average
  RETURN QUERY
  WITH stock_data AS (
    SELECT 
      s.item_code,
      s.item_name,
      s.category_name,
      s.current_qty,
      CASE 
        WHEN p_valuation_method = 'FIFO' THEN 
          -- Get earliest GRN price
          COALESCE((
            SELECT g.amount_inr / NULLIF(g.qty_received, 0)
            FROM satguru_grn_log g
            WHERE g.item_code = s.item_code 
            AND g.qty_received > 0
            ORDER BY g.date ASC
            LIMIT 1
          ), 0)
        WHEN p_valuation_method = 'LIFO' THEN
          -- Get latest GRN price  
          COALESCE((
            SELECT g.amount_inr / NULLIF(g.qty_received, 0)
            FROM satguru_grn_log g
            WHERE g.item_code = s.item_code 
            AND g.qty_received > 0
            ORDER BY g.date DESC
            LIMIT 1
          ), 0)
        ELSE
          -- Weighted average
          COALESCE((
            SELECT SUM(g.amount_inr) / NULLIF(SUM(g.qty_received), 0)
            FROM satguru_grn_log g
            WHERE g.item_code = s.item_code 
            AND g.qty_received > 0
          ), 0)
      END as calculated_unit_cost,
      p_valuation_method as method,
      (
        SELECT MAX(g.date)
        FROM satguru_grn_log g
        WHERE g.item_code = s.item_code
      ) as last_grn_date
    FROM satguru_stock_summary_view s
    WHERE (p_item_code IS NULL OR s.item_code = p_item_code)
    AND s.current_qty > 0
  )
  SELECT 
    sd.item_code,
    sd.item_name,
    sd.category_name,
    sd.current_qty,
    sd.calculated_unit_cost,
    sd.current_qty * sd.calculated_unit_cost as total_value,
    sd.method,
    sd.last_grn_date,
    jsonb_build_object(
      'method', sd.method,
      'calculation_date', CURRENT_DATE,
      'source', 'GRN_BASED'
    ) as cost_layers
  FROM stock_data sd
  ORDER BY (sd.current_qty * sd.calculated_unit_cost) DESC;
END;
$$;

-- 3. Process Bulk Price Updates with validation
CREATE OR REPLACE FUNCTION public.process_bulk_price_update(
  p_operation_id UUID,
  p_price_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_records INTEGER := 0;
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_errors JSONB[] := '{}';
  v_record JSONB;
  v_item_exists BOOLEAN;
BEGIN
  -- Count total records
  SELECT jsonb_array_length(p_price_data) INTO v_total_records;
  
  -- Update operation status
  UPDATE public.valuation_bulk_operations 
  SET total_records = v_total_records,
      status = 'PROCESSING'
  WHERE id = p_operation_id;
  
  -- Process each record
  FOR v_record IN SELECT * FROM jsonb_array_elements(p_price_data) LOOP
    BEGIN
      -- Validate item exists
      SELECT EXISTS(
        SELECT 1 FROM satguru_item_master 
        WHERE item_code = v_record->>'item_code'
      ) INTO v_item_exists;
      
      IF NOT v_item_exists THEN
        v_errors := array_append(v_errors, 
          jsonb_build_object(
            'item_code', v_record->>'item_code',
            'error', 'Item code not found in master data'
          )
        );
        v_error_count := v_error_count + 1;
        CONTINUE;
      END IF;
      
      -- Insert price history record
      INSERT INTO public.valuation_price_history (
        item_code,
        new_price,
        change_reason,
        effective_date,
        changed_by,
        price_source,
        metadata
      ) VALUES (
        v_record->>'item_code',
        (v_record->>'new_price')::NUMERIC,
        COALESCE(v_record->>'reason', 'Bulk import'),
        COALESCE((v_record->>'effective_date')::DATE, CURRENT_DATE),
        auth.uid(),
        'BULK_IMPORT',
        v_record
      );
      
      v_success_count := v_success_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 
        jsonb_build_object(
          'item_code', v_record->>'item_code',
          'error', SQLERRM
        )
      );
      v_error_count := v_error_count + 1;
    END;
  END LOOP;
  
  -- Update operation with results
  UPDATE public.valuation_bulk_operations 
  SET 
    status = CASE WHEN v_error_count = 0 THEN 'COMPLETED' ELSE 'FAILED' END,
    processed_records = v_total_records,
    success_records = v_success_count,
    failed_records = v_error_count,
    error_details = to_jsonb(v_errors),
    completed_at = now()
  WHERE id = p_operation_id;
  
  RETURN jsonb_build_object(
    'total_records', v_total_records,
    'success_count', v_success_count,
    'error_count', v_error_count,
    'errors', to_jsonb(v_errors)
  );
END;
$$;

-- 4. Get Valuation Analytics with caching
CREATE OR REPLACE FUNCTION public.get_valuation_analytics(
  p_filters JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cache_key TEXT;
  v_filters_hash TEXT;
  v_cached_result JSONB;
  v_result JSONB;
  v_start_time TIMESTAMP;
  v_calculation_time INTEGER;
BEGIN
  v_start_time := clock_timestamp();
  
  -- Generate cache key
  v_filters_hash := encode(digest(p_filters::TEXT, 'sha256'), 'hex');
  v_cache_key := 'valuation_analytics_' || v_filters_hash;
  
  -- Check cache
  SELECT cached_data INTO v_cached_result
  FROM public.valuation_analytics_cache
  WHERE cache_key = v_cache_key 
  AND expires_at > now();
  
  IF v_cached_result IS NOT NULL THEN
    RETURN v_cached_result;
  END IF;
  
  -- Calculate analytics
  WITH valuation_data AS (
    SELECT * FROM public.calculate_stock_valuation(
      p_item_code := p_filters->>'item_code',
      p_valuation_method := COALESCE(p_filters->>'valuation_method', 'WEIGHTED_AVG')
    )
  ),
  summary_stats AS (
    SELECT 
      COUNT(*) as total_items,
      SUM(total_value) as total_inventory_value,
      AVG(total_value) as avg_item_value,
      SUM(CASE WHEN total_value > 10000 THEN 1 ELSE 0 END) as high_value_items,
      SUM(CASE WHEN total_value BETWEEN 1000 AND 10000 THEN 1 ELSE 0 END) as medium_value_items,
      SUM(CASE WHEN total_value < 1000 THEN 1 ELSE 0 END) as low_value_items
    FROM valuation_data
  ),
  category_breakdown AS (
    SELECT 
      category_name,
      COUNT(*) as item_count,
      SUM(total_value) as category_value,
      AVG(unit_cost) as avg_unit_cost
    FROM valuation_data
    GROUP BY category_name
    ORDER BY SUM(total_value) DESC
  )
  SELECT jsonb_build_object(
    'summary', to_jsonb(summary_stats.*),
    'category_breakdown', jsonb_agg(to_jsonb(category_breakdown.*)),
    'calculation_method', COALESCE(p_filters->>'valuation_method', 'WEIGHTED_AVG'),
    'calculated_at', now(),
    'filters_applied', p_filters
  ) INTO v_result
  FROM summary_stats, category_breakdown;
  
  -- Calculate execution time
  v_calculation_time := EXTRACT(milliseconds FROM clock_timestamp() - v_start_time)::INTEGER;
  
  -- Cache result
  INSERT INTO public.valuation_analytics_cache (
    cache_key, cache_type, filters_hash, cached_data, 
    calculation_time_ms, record_count
  ) VALUES (
    v_cache_key, 'VALUATION_SUMMARY', v_filters_hash, v_result,
    v_calculation_time, (v_result->'summary'->>'total_items')::INTEGER
  )
  ON CONFLICT (cache_key) DO UPDATE SET
    cached_data = EXCLUDED.cached_data,
    calculated_at = now(),
    expires_at = now() + INTERVAL '1 hour',
    calculation_time_ms = EXCLUDED.calculation_time_ms;
  
  RETURN v_result;
END;
$$;