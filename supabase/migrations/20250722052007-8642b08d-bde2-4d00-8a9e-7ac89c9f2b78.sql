
-- CORRECTED IMPLEMENTATION: Properly Handle Corrupted Legacy Dates
-- Phase 1: Fix Legacy Data Handling - Ignore ALL dates for LEGACY_BULK records

-- Update operational cutoff date function to July 21, 2025
DROP FUNCTION IF EXISTS get_operational_cutoff_date();
CREATE OR REPLACE FUNCTION get_operational_cutoff_date() 
RETURNS DATE 
LANGUAGE SQL 
IMMUTABLE 
AS $$ 
SELECT '2025-07-21'::DATE;
$$;

-- Phase 2: Apply Missing Validation Triggers
DROP TRIGGER IF EXISTS validate_grn_entry ON satguru_grn_log;
CREATE TRIGGER validate_grn_entry
  BEFORE INSERT OR UPDATE ON satguru_grn_log
  FOR EACH ROW EXECUTE FUNCTION validate_operational_entry();

DROP TRIGGER IF EXISTS validate_issue_entry ON satguru_issue_log;
CREATE TRIGGER validate_issue_entry
  BEFORE INSERT OR UPDATE ON satguru_issue_log
  FOR EACH ROW EXECUTE FUNCTION validate_operational_entry();

-- Phase 3: Rebuild Stock Summary View - IGNORE CORRUPTED DATES FOR LEGACY DATA
DROP VIEW IF EXISTS satguru_stock_summary_view;

CREATE VIEW satguru_stock_summary_view AS
WITH financial_year_stock AS (
  SELECT 
    im.item_code,
    im.item_name,
    COALESCE(im.uom, 'KG') as uom,
    COALESCE(im.usage_type, 'FINISHED_GOOD') as category_name,
    COALESCE(im.category_id::text, '') as category_id,
    0 as reorder_level,
    
    -- Opening Stock: End of day Mar 31, 2025 (Indian Financial Year)
    COALESCE(opening_stock.opening_stock, 0) as opening_stock,
    
    -- Legacy Data: IGNORE ALL DATES - Count ALL quantities from LEGACY_BULK records
    COALESCE(legacy_grns.legacy_grns, 0) as legacy_grns,
    COALESCE(legacy_issues.legacy_issues, 0) as legacy_issues,
    
    -- Legacy Baseline = Opening Stock + Legacy GRNs - Legacy Issues
    COALESCE(opening_stock.opening_stock, 0) + 
    COALESCE(legacy_grns.legacy_grns, 0) - 
    COALESCE(legacy_issues.legacy_issues, 0) as legacy_baseline,
    
    -- Operational Data: Jul 22, 2025 onwards with proper dates AND FRONTEND_ENTRY
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
    
    -- 30-day metrics: Show operational data if available, otherwise legacy totals with indicator
    COALESCE(operational_grns.received_30_days, 0) as received_30_days,
    COALESCE(operational_issues.consumption_30_days, 0) as consumption_30_days,
    
    -- For display purposes: Show legacy activity when no operational data
    CASE 
      WHEN operational_grns.operational_grns > 0 OR operational_issues.operational_issues > 0 
      THEN NULL 
      ELSE legacy_grns.legacy_grns 
    END as legacy_received_display,
    
    CASE 
      WHEN operational_grns.operational_grns > 0 OR operational_issues.operational_issues > 0 
      THEN NULL 
      ELSE legacy_issues.legacy_issues 
    END as legacy_consumed_display,
    
    -- Last activity tracking
    GREATEST(
      COALESCE(operational_grns.last_grn_date, '2025-07-21'::date),
      COALESCE(operational_issues.last_issue_date, '2025-07-21'::date)
    ) as last_updated
    
  FROM satguru_item_master im
  
  -- Opening Stock (Mar 31, 2025)
  LEFT JOIN (
    SELECT 
      item_code, 
      SUM(qty_received) as opening_stock
    FROM satguru_grn_log 
    WHERE transaction_type = 'OPENING_STOCK'
      AND data_source = 'LEGACY_BULK'
    GROUP BY item_code
  ) opening_stock ON im.item_code = opening_stock.item_code
  
  -- Legacy GRNs: ALL LEGACY_BULK records (IGNORE corrupted dates, count ALL quantities)
  LEFT JOIN (
    SELECT 
      item_code, 
      SUM(qty_received) as legacy_grns
    FROM satguru_grn_log 
    WHERE (transaction_type IS NULL OR transaction_type != 'OPENING_STOCK')
      AND data_source = 'LEGACY_BULK'
      -- NO DATE FILTERING - Count all quantities regardless of corrupted dates
    GROUP BY item_code
  ) legacy_grns ON im.item_code = legacy_grns.item_code
  
  -- Legacy Issues: ALL LEGACY_BULK records (IGNORE corrupted dates, count ALL quantities)
  LEFT JOIN (
    SELECT 
      item_code, 
      SUM(qty_issued) as legacy_issues
    FROM satguru_issue_log 
    WHERE data_source = 'LEGACY_BULK'
      -- NO DATE FILTERING - Count all quantities regardless of corrupted dates
    GROUP BY item_code
  ) legacy_issues ON im.item_code = legacy_issues.item_code
  
  -- Operational GRNs: Only properly dated entries after July 21, 2025
  LEFT JOIN (
    SELECT 
      item_code, 
      SUM(qty_received) as operational_grns,
      SUM(CASE WHEN date >= (CURRENT_DATE - INTERVAL '30 days') THEN qty_received ELSE 0 END) as received_30_days,
      MAX(date) as last_grn_date
    FROM satguru_grn_log 
    WHERE date > get_operational_cutoff_date()
      AND (transaction_type IS NULL OR transaction_type != 'OPENING_STOCK')
      AND data_source = 'FRONTEND_ENTRY'
    GROUP BY item_code
  ) operational_grns ON im.item_code = operational_grns.item_code
  
  -- Operational Issues: Only properly dated entries after July 21, 2025
  LEFT JOIN (
    SELECT 
      item_code, 
      SUM(qty_issued) as operational_issues,
      SUM(CASE WHEN date >= (CURRENT_DATE - INTERVAL '30 days') THEN qty_issued ELSE 0 END) as consumption_30_days,
      MAX(date) as last_issue_date
    FROM satguru_issue_log 
    WHERE date > get_operational_cutoff_date()
      AND data_source = 'FRONTEND_ENTRY'
    GROUP BY item_code
  ) operational_issues ON im.item_code = operational_issues.item_code
  
  WHERE im.status = 'active' OR im.status IS NULL
)
SELECT 
  *,
  -- Calculated fields for compatibility
  (operational_grns - operational_issues) as net_operational_movement,
  
  -- Stock Status
  CASE 
    WHEN current_qty <= 0 THEN 
      CASE WHEN data_quality = 'LEGACY_NEGATIVE' THEN 'ZERO' ELSE 'out_of_stock' END
    WHEN current_qty <= reorder_level THEN 'low_stock'
    WHEN current_qty > 1000 THEN 'overstock'
    ELSE 'normal'
  END as stock_status,
  
  -- Total GRNs and Issues for compatibility
  (legacy_grns + operational_grns) as total_grns,
  (legacy_issues + operational_issues) as total_issues,
  
  -- Data period indicator
  CASE 
    WHEN operational_grns > 0 OR operational_issues > 0 THEN 'OPERATIONAL_PERIOD'
    ELSE 'LEGACY_PERIOD'
  END as metrics_period
  
FROM financial_year_stock;

-- Phase 4: Ensure all existing records are marked as LEGACY_BULK
UPDATE satguru_grn_log 
SET data_source = 'LEGACY_BULK' 
WHERE data_source IS NULL;

UPDATE satguru_issue_log 
SET data_source = 'LEGACY_BULK' 
WHERE data_source IS NULL;

-- Verification Query
SELECT 
  'CORRUPTED_DATES_HANDLED' as verification_step,
  COUNT(*) as total_grn_records,
  COUNT(*) FILTER (WHERE date > '2026-01-01') as corrupted_dates_included,
  SUM(qty_received) as total_quantities_counted,
  COUNT(DISTINCT item_code) as unique_items
FROM satguru_grn_log 
WHERE data_source = 'LEGACY_BULK' AND (transaction_type IS NULL OR transaction_type != 'OPENING_STOCK')
UNION ALL
SELECT 
  'STOCK_CALCULATION_SAMPLE',
  COUNT(*),
  COUNT(*) FILTER (WHERE current_qty > 0),
  SUM(current_qty),
  COUNT(*) FILTER (WHERE metrics_period = 'LEGACY_PERIOD')
FROM satguru_stock_summary_view
LIMIT 10;
