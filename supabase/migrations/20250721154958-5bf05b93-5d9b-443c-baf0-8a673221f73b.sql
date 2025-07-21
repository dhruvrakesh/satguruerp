
-- Clean Cutoff Implementation Plan - Phase 1: Data Freeze & Baseline Lock

-- Add data_source field to track legacy vs frontend entries
ALTER TABLE satguru_grn_log 
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'LEGACY_BULK';

ALTER TABLE satguru_issue_log 
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'LEGACY_BULK';

-- Mark all existing records as legacy data
UPDATE satguru_grn_log 
SET data_source = 'LEGACY_BULK' 
WHERE data_source IS NULL OR data_source = 'LEGACY_BULK';

UPDATE satguru_issue_log 
SET data_source = 'LEGACY_BULK' 
WHERE data_source IS NULL OR data_source = 'LEGACY_BULK';

-- Create operational cutoff date (July 19, 2025)
CREATE OR REPLACE FUNCTION get_operational_cutoff_date() 
RETURNS DATE 
LANGUAGE SQL 
IMMUTABLE 
AS $$ 
SELECT '2025-07-19'::DATE;
$$;

-- Enhanced stock summary view with data source awareness
DROP VIEW IF EXISTS satguru_stock_summary_view;

CREATE VIEW satguru_stock_summary_view AS
WITH operational_data AS (
  -- Only include operational data (post-cutoff) for real calculations
  SELECT 
    im.item_code,
    im.item_name,
    COALESCE(im.uom, 'KG') as uom,
    COALESCE(im.usage_type, 'FINISHED_GOOD') as category_name,
    COALESCE(im.category_id::text, '') as category_id,
    COALESCE(im.reorder_level, 0) as reorder_level,
    
    -- Legacy baseline (all legacy data combined)
    COALESCE(legacy_opening.opening_stock, 0) + 
    COALESCE(legacy_grns.total_grns, 0) - 
    COALESCE(legacy_issues.total_issues, 0) as legacy_baseline,
    
    -- Operational transactions (post July 19, 2025)
    COALESCE(op_grns.operational_grns, 0) as operational_grns,
    COALESCE(op_issues.operational_issues, 0) as operational_issues,
    
    -- Current stock = Legacy baseline + Operational transactions
    COALESCE(legacy_opening.opening_stock, 0) + 
    COALESCE(legacy_grns.total_grns, 0) - 
    COALESCE(legacy_issues.total_issues, 0) +
    COALESCE(op_grns.operational_grns, 0) - 
    COALESCE(op_issues.operational_issues, 0) as current_qty,
    
    -- Track data quality
    CASE 
      WHEN (COALESCE(legacy_opening.opening_stock, 0) + 
            COALESCE(legacy_grns.total_grns, 0) - 
            COALESCE(legacy_issues.total_issues, 0)) < 0 
      THEN 'LEGACY_NEGATIVE'
      ELSE 'CLEAN'
    END as data_quality,
    
    -- 30-day metrics (operational data only)
    COALESCE(op_grns.received_30_days, 0) as received_30_days,
    COALESCE(op_issues.consumption_30_days, 0) as consumption_30_days,
    
    -- Last updated from operational data
    GREATEST(
      COALESCE(op_grns.last_grn_date, '2025-07-19'::date),
      COALESCE(op_issues.last_issue_date, '2025-07-19'::date)
    ) as last_updated
    
  FROM satguru_item_master im
  
  -- Legacy opening stock
  LEFT JOIN (
    SELECT 
      item_code, 
      SUM(qty_received) as opening_stock
    FROM satguru_grn_log 
    WHERE transaction_type = 'OPENING_STOCK'
      AND data_source = 'LEGACY_BULK'
    GROUP BY item_code
  ) legacy_opening ON im.item_code = legacy_opening.item_code
  
  -- Legacy GRNs (exclude opening stock)
  LEFT JOIN (
    SELECT 
      item_code, 
      SUM(qty_received) as total_grns
    FROM satguru_grn_log 
    WHERE (transaction_type IS NULL OR transaction_type != 'OPENING_STOCK')
      AND data_source = 'LEGACY_BULK'
    GROUP BY item_code
  ) legacy_grns ON im.item_code = legacy_grns.item_code
  
  -- Legacy Issues
  LEFT JOIN (
    SELECT 
      item_code, 
      SUM(qty_issued) as total_issues
    FROM satguru_issue_log 
    WHERE data_source = 'LEGACY_BULK'
    GROUP BY item_code
  ) legacy_issues ON im.item_code = legacy_issues.item_code
  
  -- Operational GRNs (post cutoff)
  LEFT JOIN (
    SELECT 
      item_code, 
      SUM(qty_received) as operational_grns,
      SUM(CASE WHEN date >= (CURRENT_DATE - INTERVAL '30 days') THEN qty_received ELSE 0 END) as received_30_days,
      MAX(date) as last_grn_date
    FROM satguru_grn_log 
    WHERE date >= get_operational_cutoff_date()
      AND (transaction_type IS NULL OR transaction_type != 'OPENING_STOCK')
      AND (data_source = 'FRONTEND_ENTRY' OR data_source IS NULL)
    GROUP BY item_code
  ) op_grns ON im.item_code = op_grns.item_code
  
  -- Operational Issues (post cutoff)
  LEFT JOIN (
    SELECT 
      item_code, 
      SUM(qty_issued) as operational_issues,
      SUM(CASE WHEN date >= (CURRENT_DATE - INTERVAL '30 days') THEN qty_issued ELSE 0 END) as consumption_30_days,
      MAX(date) as last_issue_date
    FROM satguru_issue_log 
    WHERE date >= get_operational_cutoff_date()
      AND (data_source = 'FRONTEND_ENTRY' OR data_source IS NULL)
    GROUP BY item_code
  ) op_issues ON im.item_code = op_issues.item_code
  
  WHERE im.status = 'active' OR im.status IS NULL
)
SELECT 
  *,
  -- Additional calculated fields
  legacy_baseline as opening_stock,
  (operational_grns - operational_issues) as net_operational_movement,
  
  -- Stock status with legacy awareness
  CASE 
    WHEN current_qty <= 0 THEN 
      CASE WHEN data_quality = 'LEGACY_NEGATIVE' THEN 'ZERO' ELSE 'out_of_stock' END
    WHEN current_qty <= reorder_level THEN 'low_stock'
    WHEN current_qty > (reorder_level * 3) THEN 'overstock'
    ELSE 'normal'
  END as stock_status,
  
  -- Total GRNs and Issues for compatibility
  (COALESCE(legacy_baseline, 0) + operational_grns) as total_grns,
  operational_issues as total_issues
  
FROM operational_data;

-- Create validation function for new entries
CREATE OR REPLACE FUNCTION validate_operational_entry() 
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only validate operational entries (post cutoff)
  IF NEW.date >= get_operational_cutoff_date() THEN
    -- Mark as frontend entry
    NEW.data_source := 'FRONTEND_ENTRY';
    
    -- Prevent future dates
    IF NEW.date > CURRENT_DATE THEN
      RAISE EXCEPTION 'Entry date cannot be in the future. Date: %, Today: %', NEW.date, CURRENT_DATE;
    END IF;
    
    -- For issues, validate stock availability (only check against operational stock)
    IF TG_TABLE_NAME = 'satguru_issue_log' THEN
      DECLARE
        available_stock NUMERIC;
      BEGIN
        SELECT current_qty INTO available_stock
        FROM satguru_stock_summary_view
        WHERE item_code = NEW.item_code;
        
        IF available_stock < NEW.qty_issued THEN
          RAISE EXCEPTION 'Insufficient stock for item %. Available: %, Requested: %', 
            NEW.item_code, available_stock, NEW.qty_issued;
        END IF;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply validation triggers
DROP TRIGGER IF EXISTS validate_grn_entry ON satguru_grn_log;
CREATE TRIGGER validate_grn_entry
  BEFORE INSERT OR UPDATE ON satguru_grn_log
  FOR EACH ROW EXECUTE FUNCTION validate_operational_entry();

DROP TRIGGER IF EXISTS validate_issue_entry ON satguru_issue_log;
CREATE TRIGGER validate_issue_entry
  BEFORE INSERT OR UPDATE ON satguru_issue_log
  FOR EACH ROW EXECUTE FUNCTION validate_operational_entry();

-- Add audit trail for operational entries
CREATE TABLE IF NOT EXISTS operational_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  record_id UUID,
  item_code TEXT,
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on audit trail
ALTER TABLE operational_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Satguru users can view audit trail" ON operational_audit_trail
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() AND o.code = 'SATGURU'
  )
);

-- Verification query
SELECT 
  'IMPLEMENTATION_STATUS' as status,
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE stock_status = 'ZERO') as legacy_negative,
  COUNT(*) FILTER (WHERE data_quality = 'CLEAN') as clean_items,
  COUNT(*) FILTER (WHERE current_qty > 0) as positive_stock_items
FROM satguru_stock_summary_view;
