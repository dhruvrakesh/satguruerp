-- Core Database Schema Enhancements for Satguru Engravures ERP
-- Phase 1: Validation & Business Logic Functions

-- Enhanced stock validation function
CREATE OR REPLACE FUNCTION public.satguru_validate_stock_transaction(
  p_item_code TEXT,
  p_transaction_type TEXT, -- 'GRN' or 'ISSUE'
  p_quantity NUMERIC
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stock NUMERIC;
  item_exists BOOLEAN;
BEGIN
  -- Check if item exists
  SELECT EXISTS(SELECT 1 FROM public.satguru_item_master WHERE item_code = p_item_code)
  INTO item_exists;
  
  IF NOT item_exists THEN
    RAISE EXCEPTION 'Item code % does not exist', p_item_code;
  END IF;
  
  -- Get current stock
  SELECT COALESCE(current_qty, 0) INTO current_stock
  FROM public.satguru_stock 
  WHERE item_code = p_item_code;
  
  -- Validate based on transaction type
  IF p_transaction_type = 'ISSUE' THEN
    IF current_stock < p_quantity THEN
      RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', current_stock, p_quantity;
    END IF;
  END IF;
  
  -- Validate quantity is positive
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Item code uniqueness validation function
CREATE OR REPLACE FUNCTION public.satguru_validate_unique_item_code(
  p_item_code TEXT,
  p_exclude_id UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  exists_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO exists_count
  FROM public.satguru_item_master
  WHERE item_code = p_item_code
    AND (p_exclude_id IS NULL OR id != p_exclude_id);
    
  IF exists_count > 0 THEN
    RAISE EXCEPTION 'Item code % already exists', p_item_code;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Stock level threshold alert function
CREATE OR REPLACE FUNCTION public.satguru_check_stock_thresholds()
RETURNS TABLE(
  item_code TEXT,
  item_name TEXT,
  current_qty NUMERIC,
  reorder_level NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.item_code,
    im.item_name,
    s.current_qty,
    COALESCE(s.reorder_level, 10) as reorder_level,
    CASE 
      WHEN s.current_qty <= 0 THEN 'OUT_OF_STOCK'
      WHEN s.current_qty <= COALESCE(s.reorder_level, 10) THEN 'LOW_STOCK'
      ELSE 'NORMAL'
    END as status
  FROM public.satguru_stock s
  JOIN public.satguru_item_master im ON s.item_code = im.item_code
  WHERE s.current_qty <= COALESCE(s.reorder_level, 10)
  ORDER BY s.current_qty ASC;
END;
$$;

-- Phase 2: Analytics & Reporting Infrastructure

-- Create stock analytics queries tracking table
CREATE TABLE IF NOT EXISTS public.stock_analytics_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  query_type TEXT NOT NULL, -- 'stock_summary', 'movement_analysis', 'consumption_report', etc.
  filters JSONB,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  execution_time_ms INTEGER,
  result_count INTEGER,
  organization_id UUID REFERENCES public.organizations(id)
);

-- Enable RLS on analytics table
ALTER TABLE public.stock_analytics_queries ENABLE ROW LEVEL SECURITY;

-- RLS policy for analytics queries - users can only see their org's data
CREATE POLICY "Users can view org analytics queries"
ON public.stock_analytics_queries
FOR ALL
USING (
  organization_id = (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Create optimized stock summary view
CREATE OR REPLACE VIEW public.satguru_stock_summary_view AS
SELECT 
  s.item_code,
  im.item_name,
  im.category_id,
  c.category_name,
  s.current_qty,
  s.reorder_level,
  s.last_updated,
  CASE 
    WHEN s.current_qty <= 0 THEN 'OUT_OF_STOCK'
    WHEN s.current_qty <= COALESCE(s.reorder_level, 10) THEN 'LOW_STOCK'
    ELSE 'NORMAL'
  END as stock_status,
  -- Calculate recent consumption (last 30 days)
  COALESCE((
    SELECT SUM(qty_issued)
    FROM public.satguru_issue_log il
    WHERE il.item_code = s.item_code
      AND il.issue_date >= CURRENT_DATE - INTERVAL '30 days'
  ), 0) as consumption_30_days,
  -- Calculate recent receipts (last 30 days)
  COALESCE((
    SELECT SUM(qty_received)
    FROM public.satguru_grn_log gl
    WHERE gl.item_code = s.item_code
      AND gl.grn_date >= CURRENT_DATE - INTERVAL '30 days'
  ), 0) as received_30_days
FROM public.satguru_stock s
JOIN public.satguru_item_master im ON s.item_code = im.item_code
LEFT JOIN public.satguru_categories c ON im.category_id = c.id
WHERE im.is_active = true;

-- Stock movement analysis function
CREATE OR REPLACE FUNCTION public.satguru_get_stock_movement_analysis(
  p_item_code TEXT DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  item_code TEXT,
  item_name TEXT,
  opening_stock NUMERIC,
  total_received NUMERIC,
  total_issued NUMERIC,
  closing_stock NUMERIC,
  net_movement NUMERIC,
  movement_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_date DATE := CURRENT_DATE - INTERVAL '1 day' * p_days;
BEGIN
  RETURN QUERY
  WITH stock_movements AS (
    SELECT 
      im.item_code,
      im.item_name,
      s.current_qty as closing_stock,
      COALESCE(SUM(CASE WHEN gl.grn_date >= start_date THEN gl.qty_received ELSE 0 END), 0) as received,
      COALESCE(SUM(CASE WHEN il.issue_date >= start_date THEN il.qty_issued ELSE 0 END), 0) as issued
    FROM public.satguru_item_master im
    LEFT JOIN public.satguru_stock s ON im.item_code = s.item_code
    LEFT JOIN public.satguru_grn_log gl ON im.item_code = gl.item_code
    LEFT JOIN public.satguru_issue_log il ON im.item_code = il.item_code
    WHERE im.is_active = true
      AND (p_item_code IS NULL OR im.item_code = p_item_code)
      AND (p_category_id IS NULL OR im.category_id = p_category_id)
    GROUP BY im.item_code, im.item_name, s.current_qty
  )
  SELECT 
    sm.item_code,
    sm.item_name,
    (sm.closing_stock - sm.received + sm.issued) as opening_stock,
    sm.received as total_received,
    sm.issued as total_issued,
    sm.closing_stock,
    (sm.received - sm.issued) as net_movement,
    CASE 
      WHEN (sm.closing_stock - sm.received + sm.issued) > 0 
      THEN ((sm.received - sm.issued) / (sm.closing_stock - sm.received + sm.issued)) * 100
      ELSE 0
    END as movement_percentage
  FROM stock_movements sm
  ORDER BY sm.item_code;
END;
$$;

-- Phase 3: Performance Enhancements - Add strategic indexes

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_satguru_grn_log_item_date 
ON public.satguru_grn_log(item_code, grn_date);

CREATE INDEX IF NOT EXISTS idx_satguru_issue_log_item_date 
ON public.satguru_issue_log(item_code, issue_date);

CREATE INDEX IF NOT EXISTS idx_satguru_stock_reorder 
ON public.satguru_stock(current_qty, reorder_level) 
WHERE current_qty <= reorder_level;

CREATE INDEX IF NOT EXISTS idx_satguru_item_master_category 
ON public.satguru_item_master(category_id) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_stock_analytics_user_org 
ON public.stock_analytics_queries(user_id, organization_id, executed_at);

-- Enhanced GRN trigger with validation
CREATE OR REPLACE FUNCTION public.satguru_enhanced_grn_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate the transaction
  PERFORM public.satguru_validate_stock_transaction(NEW.item_code, 'GRN', NEW.qty_received);
  
  -- Update or insert stock record
  INSERT INTO public.satguru_stock (item_code, current_qty, last_updated, reorder_level)
  VALUES (NEW.item_code, NEW.qty_received, NOW(), 10)
  ON CONFLICT (item_code)
  DO UPDATE SET 
    current_qty = satguru_stock.current_qty + NEW.qty_received,
    last_updated = NOW();
    
  RETURN NEW;
END;
$$;

-- Enhanced Issue trigger with validation
CREATE OR REPLACE FUNCTION public.satguru_enhanced_issue_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate the transaction
  PERFORM public.satguru_validate_stock_transaction(NEW.item_code, 'ISSUE', NEW.qty_issued);
  
  -- Update stock record
  UPDATE public.satguru_stock 
  SET 
    current_qty = current_qty - NEW.qty_issued,
    last_updated = NOW()
  WHERE item_code = NEW.item_code;
  
  -- Ensure stock record exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock record not found for item code: %', NEW.item_code;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing triggers and create enhanced ones
DROP TRIGGER IF EXISTS satguru_grn_stock_update ON public.satguru_grn_log;
DROP TRIGGER IF EXISTS satguru_issue_stock_update ON public.satguru_issue_log;

CREATE TRIGGER satguru_grn_stock_update
  AFTER INSERT ON public.satguru_grn_log
  FOR EACH ROW
  EXECUTE FUNCTION public.satguru_enhanced_grn_trigger();

CREATE TRIGGER satguru_issue_stock_update
  AFTER INSERT ON public.satguru_issue_log
  FOR EACH ROW
  EXECUTE FUNCTION public.satguru_enhanced_issue_trigger();

-- Add reorder_level column to stock table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'satguru_stock' 
    AND column_name = 'reorder_level'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.satguru_stock ADD COLUMN reorder_level NUMERIC DEFAULT 10;
  END IF;
END $$;

-- Function to track analytics queries
CREATE OR REPLACE FUNCTION public.satguru_log_analytics_query(
  p_query_type TEXT,
  p_filters JSONB DEFAULT NULL,
  p_execution_time_ms INTEGER DEFAULT NULL,
  p_result_count INTEGER DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_id UUID;
  user_org_id UUID;
BEGIN
  -- Get user's organization
  SELECT organization_id INTO user_org_id
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- Insert analytics log
  INSERT INTO public.stock_analytics_queries (
    user_id,
    query_type,
    filters,
    execution_time_ms,
    result_count,
    organization_id
  ) VALUES (
    auth.uid(),
    p_query_type,
    p_filters,
    p_execution_time_ms,
    p_result_count,
    user_org_id
  ) RETURNING id INTO query_id;
  
  RETURN query_id;
END;
$$;