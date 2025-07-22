-- FIXED Financial Year Implementation (Corrected table structure)

-- Step 1: Add data_source fields to track legacy vs frontend entries
ALTER TABLE satguru_grn_log 
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'LEGACY_BULK';

ALTER TABLE satguru_issue_log 
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'LEGACY_BULK';

-- Step 2: Mark all existing records as legacy data (handles corrupted dates from 2026/2027)
UPDATE satguru_grn_log 
SET data_source = 'LEGACY_BULK' 
WHERE data_source IS NULL;

UPDATE satguru_issue_log 
SET data_source = 'LEGACY_BULK' 
WHERE data_source IS NULL;

-- Step 3: Create operational cutoff date function (July 19, 2025)
CREATE OR REPLACE FUNCTION get_operational_cutoff_date() 
RETURNS DATE 
LANGUAGE SQL 
IMMUTABLE 
AS $$ 
SELECT '2025-07-19'::DATE;
$$;

-- Step 4: REBUILD satguru_stock_summary_view with correct Financial Year Logic
DROP VIEW IF EXISTS satguru_stock_summary_view;

CREATE VIEW satguru_stock_summary_view AS
WITH financial_year_stock AS (
  SELECT 
    im.item_code,
    im.item_name,
    COALESCE(im.uom, 'KG') as uom,
    COALESCE(im.usage_type, 'FINISHED_GOOD') as category_name,
    COALESCE(im.category_id::text, '') as category_id,
    0 as reorder_level, -- Default since column doesn't exist
    
    -- Opening Stock: End of day Mar 31, 2025 (uploaded Jul 20, 2025)
    COALESCE(opening_stock.opening_stock, 0) as opening_stock,
    
    -- Legacy Data: Apr 1 - Jul 18, 2025 (ALL legacy data regardless of corrupted dates)
    COALESCE(legacy_grns.legacy_grns, 0) as legacy_grns,
    COALESCE(legacy_issues.legacy_issues, 0) as legacy_issues,
    
    -- Legacy Baseline = Opening Stock + Legacy GRNs - Legacy Issues
    COALESCE(opening_stock.opening_stock, 0) + 
    COALESCE(legacy_grns.legacy_grns, 0) - 
    COALESCE(legacy_issues.legacy_issues, 0) as legacy_baseline,
    
    -- Operational Data: Jul 19, 2025 onwards (properly dated frontend entries)
    COALESCE(operational_grns.operational_grns, 0) as operational_grns,
    COALESCE(operational_issues.operational_issues, 0) as operational_issues,
    
    -- CURRENT STOCK = Legacy Baseline + Operational Movement
    COALESCE(opening_stock.opening_stock, 0) + 
    COALESCE(legacy_grns.legacy_grns, 0) - 
    COALESCE(legacy_issues.legacy_issues, 0) +
    COALESCE(operational_grns.operational_grns, 0) - 
    COALESCE(operational_issues.operational_issues, 0) as current_qty,
    
    -- Data Quality Tracking
    CASE 
      WHEN (COALESCE(opening_stock.opening_stock, 0) + 
            COALESCE(legacy_grns.legacy_grns, 0) - 
            COALESCE(legacy_issues.legacy_issues, 0)) < 0 
      THEN 'LEGACY_NEGATIVE'
      ELSE 'CLEAN'
    END as data_quality,
    
    -- 30-day metrics (operational data only - properly dated)
    COALESCE(operational_grns.received_30_days, 0) as received_30_days,
    COALESCE(operational_issues.consumption_30_days, 0) as consumption_30_days,
    
    -- Last activity tracking
    GREATEST(
      COALESCE(operational_grns.last_grn_date, '2025-07-19'::date),
      COALESCE(operational_issues.last_issue_date, '2025-07-19'::date)
    ) as last_updated
    
  FROM satguru_item_master im
  
  -- Opening Stock (Mar 31, 2025 baseline)
  LEFT JOIN (
    SELECT 
      item_code, 
      SUM(qty_received) as opening_stock
    FROM satguru_grn_log 
    WHERE transaction_type = 'OPENING_STOCK'
      AND data_source = 'LEGACY_BULK'
    GROUP BY item_code
  ) opening_stock ON im.item_code = opening_stock.item_code
  
  -- Legacy GRNs (Apr 1 - Jul 18, 2025 period, ignore corrupted dates)
  LEFT JOIN (
    SELECT 
      item_code, 
      SUM(qty_received) as legacy_grns
    FROM satguru_grn_log 
    WHERE (transaction_type IS NULL OR transaction_type != 'OPENING_STOCK')
      AND data_source = 'LEGACY_BULK'
    GROUP BY item_code
  ) legacy_grns ON im.item_code = legacy_grns.item_code
  
  -- Legacy Issues (Apr 1 - Jul 18, 2025 period, ignore corrupted dates)
  LEFT JOIN (
    SELECT 
      item_code, 
      SUM(qty_issued) as legacy_issues
    FROM satguru_issue_log 
    WHERE data_source = 'LEGACY_BULK'
    GROUP BY item_code
  ) legacy_issues ON im.item_code = legacy_issues.item_code
  
  -- Operational GRNs (Jul 19, 2025 onwards - properly dated)
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
  ) operational_grns ON im.item_code = operational_grns.item_code
  
  -- Operational Issues (Jul 19, 2025 onwards - properly dated)
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
  ) operational_issues ON im.item_code = operational_issues.item_code
  
  WHERE im.status = 'active' OR im.status IS NULL
)
SELECT 
  *,
  -- Calculated fields for compatibility
  (operational_grns - operational_issues) as net_operational_movement,
  
  -- Stock Status with Legacy Awareness (using 0 as reorder_level)
  CASE 
    WHEN current_qty <= 0 THEN 
      CASE WHEN data_quality = 'LEGACY_NEGATIVE' THEN 'ZERO' ELSE 'out_of_stock' END
    WHEN current_qty <= reorder_level THEN 'low_stock'
    WHEN current_qty > 1000 THEN 'overstock' -- Using fixed threshold
    ELSE 'normal'
  END as stock_status,
  
  -- Total GRNs and Issues for compatibility
  (legacy_grns + operational_grns) as total_grns,
  (legacy_issues + operational_issues) as total_issues
  
FROM financial_year_stock;

-- Step 5: Create validation triggers for operational entries
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
    
    -- For issues, validate stock availability using single source of truth
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