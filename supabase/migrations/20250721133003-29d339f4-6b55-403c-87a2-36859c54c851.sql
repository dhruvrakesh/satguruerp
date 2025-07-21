
-- Complete Stock Calculation Fix Plan Implementation
-- Phase 1: Verify calculate_current_stock function is source of truth
-- Phase 2: Update all stock tables to correct values for ALL items
-- Phase 3: Implement proper triggers for real-time updates

-- First, let's update satguru_stock table with correct calculations for ALL items
WITH correct_stock AS (
  SELECT 
    im.item_code,
    (calculate_current_stock(im.item_code, '2024-01-01'::date)->>'current_stock')::numeric as correct_qty
  FROM satguru_item_master im
)
UPDATE satguru_stock 
SET 
  current_qty = cs.correct_qty,
  last_updated = now()
FROM correct_stock cs
WHERE satguru_stock.item_code = cs.item_code;

-- Insert missing items into satguru_stock if they don't exist
INSERT INTO satguru_stock (item_code, current_qty, last_updated)
SELECT 
  im.item_code,
  (calculate_current_stock(im.item_code, '2024-01-01'::date)->>'current_stock')::numeric,
  now()
FROM satguru_item_master im
WHERE im.item_code NOT IN (SELECT item_code FROM satguru_stock)
ON CONFLICT (item_code) DO NOTHING;

-- Update satguru_stock_summary with correct calculations for ALL items
-- First ensure the table exists and has the right structure
CREATE TABLE IF NOT EXISTS satguru_stock_summary (
  item_code TEXT PRIMARY KEY,
  item_name TEXT,
  current_qty NUMERIC DEFAULT 0,
  opening_stock NUMERIC DEFAULT 0,
  total_grns NUMERIC DEFAULT 0,
  total_issues NUMERIC DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Clear and repopulate with correct data
TRUNCATE TABLE satguru_stock_summary;

INSERT INTO satguru_stock_summary (
  item_code, 
  item_name, 
  current_qty, 
  opening_stock, 
  total_grns, 
  total_issues, 
  last_updated
)
SELECT 
  im.item_code,
  im.item_name,
  (stock_calc->>'current_stock')::numeric as current_qty,
  (stock_calc->>'opening_stock')::numeric as opening_stock,
  (stock_calc->>'total_grns')::numeric as total_grns,
  (stock_calc->>'total_issues')::numeric as total_issues,
  now()
FROM satguru_item_master im
CROSS JOIN LATERAL calculate_current_stock(im.item_code, '2024-01-01'::date) as stock_calc;

-- Create or replace the stock summary view to ensure it reflects correct data
DROP VIEW IF EXISTS satguru_stock_summary_view;
CREATE VIEW satguru_stock_summary_view AS
SELECT 
  sss.item_code,
  sss.item_name,
  sss.current_qty,
  sss.opening_stock,
  sss.total_grns,
  sss.total_issues,
  sss.last_updated,
  im.uom,
  im.usage_type as category_name,
  im.category_id,
  CASE 
    WHEN sss.current_qty <= 0 THEN 'out_of_stock'
    WHEN sss.current_qty <= COALESCE(im.reorder_level, 0) THEN 'low_stock'
    WHEN sss.current_qty > (COALESCE(im.reorder_level, 0) * 3) THEN 'overstock'
    ELSE 'normal'
  END as stock_status
FROM satguru_stock_summary sss
LEFT JOIN satguru_item_master im ON sss.item_code = im.item_code;

-- Phase 3: Implement proper triggers for real-time updates
-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_stock_on_grn ON satguru_grn_log;
DROP TRIGGER IF EXISTS trigger_update_stock_on_issue ON satguru_issue_log;

-- Create comprehensive trigger function for GRN updates
CREATE OR REPLACE FUNCTION update_stock_on_grn() 
RETURNS TRIGGER AS $$
BEGIN
  -- Update both satguru_stock and satguru_stock_summary
  INSERT INTO satguru_stock (item_code, current_qty, last_updated)
  VALUES (NEW.item_code, NEW.qty_received, now())
  ON CONFLICT (item_code)
  DO UPDATE SET 
    current_qty = satguru_stock.current_qty + NEW.qty_received,
    last_updated = now();
    
  -- Update summary table
  INSERT INTO satguru_stock_summary (
    item_code, 
    item_name, 
    current_qty, 
    opening_stock, 
    total_grns, 
    total_issues, 
    last_updated
  )
  SELECT 
    NEW.item_code,
    im.item_name,
    (stock_calc->>'current_stock')::numeric,
    (stock_calc->>'opening_stock')::numeric,
    (stock_calc->>'total_grns')::numeric,
    (stock_calc->>'total_issues')::numeric,
    now()
  FROM satguru_item_master im
  CROSS JOIN LATERAL calculate_current_stock(NEW.item_code, '2024-01-01'::date) as stock_calc
  WHERE im.item_code = NEW.item_code
  ON CONFLICT (item_code)
  DO UPDATE SET
    current_qty = (calculate_current_stock(NEW.item_code, '2024-01-01'::date)->>'current_stock')::numeric,
    total_grns = (calculate_current_stock(NEW.item_code, '2024-01-01'::date)->>'total_grns')::numeric,
    last_updated = now();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create comprehensive trigger function for Issue updates
CREATE OR REPLACE FUNCTION update_stock_on_issue() 
RETURNS TRIGGER AS $$
BEGIN
  -- Update both satguru_stock and satguru_stock_summary
  UPDATE satguru_stock 
  SET 
    current_qty = current_qty - NEW.qty_issued,
    last_updated = now()
  WHERE item_code = NEW.item_code;
  
  -- Update summary table with recalculated values
  UPDATE satguru_stock_summary
  SET
    current_qty = (calculate_current_stock(NEW.item_code, '2024-01-01'::date)->>'current_stock')::numeric,
    total_issues = (calculate_current_stock(NEW.item_code, '2024-01-01'::date)->>'total_issues')::numeric,
    last_updated = now()
  WHERE item_code = NEW.item_code;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the triggers
CREATE TRIGGER trigger_update_stock_on_grn
  AFTER INSERT ON satguru_grn_log
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_grn();

CREATE TRIGGER trigger_update_stock_on_issue
  AFTER INSERT ON satguru_issue_log
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_issue();

-- Phase 4: Verification queries
-- Verify LDPELAM_NP_775_50 specifically
SELECT 
  'LDPELAM_NP_775_50 Verification' as test_item,
  s.current_qty as satguru_stock_qty,
  ss.current_qty as summary_qty,
  (calculate_current_stock('LDPELAM_NP_775_50', '2024-01-01'::date)->>'current_stock')::numeric as calculated_qty,
  CASE 
    WHEN s.current_qty = (calculate_current_stock('LDPELAM_NP_775_50', '2024-01-01'::date)->>'current_stock')::numeric 
    THEN 'CORRECT' 
    ELSE 'MISMATCH' 
  END as stock_table_status,
  CASE 
    WHEN ss.current_qty = (calculate_current_stock('LDPELAM_NP_775_50', '2024-01-01'::date)->>'current_stock')::numeric 
    THEN 'CORRECT' 
    ELSE 'MISMATCH' 
  END as summary_table_status
FROM satguru_stock s
LEFT JOIN satguru_stock_summary ss ON s.item_code = ss.item_code
WHERE s.item_code = 'LDPELAM_NP_775_50';

-- Verify all items have consistent calculations
SELECT 
  'Overall Verification' as status,
  COUNT(*) as total_items,
  COUNT(CASE WHEN s.current_qty = ss.current_qty THEN 1 END) as consistent_items,
  COUNT(CASE WHEN s.current_qty != ss.current_qty THEN 1 END) as inconsistent_items
FROM satguru_stock s
JOIN satguru_stock_summary ss ON s.item_code = ss.item_code;

-- Log the complete fix operation
INSERT INTO activity_logs (action, details) 
VALUES (
  'STOCK_CALCULATION_FIX', 
  jsonb_build_object(
    'operation', 'complete_stock_calculation_fix',
    'timestamp', now(),
    'tables_updated', ARRAY['satguru_stock', 'satguru_stock_summary'],
    'view_recreated', 'satguru_stock_summary_view',
    'triggers_created', ARRAY['trigger_update_stock_on_grn', 'trigger_update_stock_on_issue'],
    'total_items_processed', (SELECT COUNT(*) FROM satguru_item_master),
    'verification_complete', true
  )
);
