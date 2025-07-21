
-- Emergency Stock Calculation Correction Plan
-- Phase 1: Fix the satguru_stock_summary_view to properly include opening stock

DROP VIEW IF EXISTS satguru_stock_summary_view;

CREATE VIEW satguru_stock_summary_view AS
WITH stock_calculations AS (
  SELECT 
    im.item_code,
    im.item_name,
    im.uom,
    im.usage_type as category_name,
    im.category_id,
    COALESCE(im.reorder_level, 0) as reorder_level,
    
    -- Calculate opening stock from GRN logs with transaction_type 'OPENING_STOCK'
    COALESCE((
      SELECT SUM(qty_received) 
      FROM satguru_grn_log 
      WHERE item_code = im.item_code 
      AND transaction_type = 'OPENING_STOCK'
    ), 0) as opening_stock,
    
    -- Calculate total GRNs (excluding opening stock to avoid double counting)
    COALESCE((
      SELECT SUM(qty_received) 
      FROM satguru_grn_log 
      WHERE item_code = im.item_code 
      AND (transaction_type IS NULL OR transaction_type != 'OPENING_STOCK')
    ), 0) as total_grns,
    
    -- Calculate total issues
    COALESCE((
      SELECT SUM(qty_issued) 
      FROM satguru_issue_log 
      WHERE item_code = im.item_code
    ), 0) as total_issues,
    
    -- Calculate current stock: opening + grns - issues
    COALESCE((
      SELECT SUM(qty_received) 
      FROM satguru_grn_log 
      WHERE item_code = im.item_code 
      AND transaction_type = 'OPENING_STOCK'
    ), 0) + 
    COALESCE((
      SELECT SUM(qty_received) 
      FROM satguru_grn_log 
      WHERE item_code = im.item_code 
      AND (transaction_type IS NULL OR transaction_type != 'OPENING_STOCK')
    ), 0) - 
    COALESCE((
      SELECT SUM(qty_issued) 
      FROM satguru_issue_log 
      WHERE item_code = im.item_code
    ), 0) as current_qty,
    
    -- Last updated timestamp
    GREATEST(
      COALESCE((SELECT MAX(date) FROM satguru_grn_log WHERE item_code = im.item_code), '1900-01-01'::date),
      COALESCE((SELECT MAX(date) FROM satguru_issue_log WHERE item_code = im.item_code), '1900-01-01'::date)
    ) as last_updated,
    
    -- 30-day metrics
    COALESCE((
      SELECT SUM(qty_received) 
      FROM satguru_grn_log 
      WHERE item_code = im.item_code 
      AND date >= (CURRENT_DATE - INTERVAL '30 days')
      AND (transaction_type IS NULL OR transaction_type != 'OPENING_STOCK')
    ), 0) as received_30_days,
    
    COALESCE((
      SELECT SUM(qty_issued) 
      FROM satguru_issue_log 
      WHERE item_code = im.item_code 
      AND date >= (CURRENT_DATE - INTERVAL '30 days')
    ), 0) as consumption_30_days
    
  FROM satguru_item_master im
  WHERE im.is_active = true
)
SELECT 
  sc.*,
  CASE 
    WHEN sc.current_qty <= 0 THEN 'out_of_stock'
    WHEN sc.current_qty <= sc.reorder_level THEN 'low_stock'
    WHEN sc.current_qty > (sc.reorder_level * 3) THEN 'overstock'
    ELSE 'normal'
  END as stock_status
FROM stock_calculations sc;

-- Phase 2: Recreate the missing triggers for real-time stock updates

-- Drop existing triggers and functions if they exist
DROP TRIGGER IF EXISTS satguru_grn_stock_update ON satguru_grn_log;
DROP TRIGGER IF EXISTS satguru_issue_stock_update ON satguru_issue_log;
DROP FUNCTION IF EXISTS satguru_update_stock_on_grn();
DROP FUNCTION IF EXISTS satguru_update_stock_on_issue();

-- Create GRN trigger function with proper opening stock handling
CREATE OR REPLACE FUNCTION satguru_update_stock_on_grn() 
RETURNS trigger 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update or insert stock record
    INSERT INTO public.satguru_stock (item_code, current_qty, last_updated)
    VALUES (NEW.item_code, NEW.qty_received, now())
    ON CONFLICT (item_code)
    DO UPDATE SET 
        current_qty = satguru_stock.current_qty + NEW.qty_received,
        last_updated = now();
    
    RETURN NEW;
END;
$$;

-- Create Issue trigger function
CREATE OR REPLACE FUNCTION satguru_update_stock_on_issue() 
RETURNS trigger 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update stock by subtracting issued quantity
    UPDATE public.satguru_stock 
    SET 
        current_qty = current_qty - NEW.qty_issued,
        last_updated = now()
    WHERE item_code = NEW.item_code;
    
    -- If item doesn't exist in stock table, create it with negative quantity
    IF NOT FOUND THEN
        INSERT INTO public.satguru_stock (item_code, current_qty, last_updated)
        VALUES (NEW.item_code, -NEW.qty_issued, now());
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create the triggers
CREATE TRIGGER satguru_grn_stock_update
    AFTER INSERT ON public.satguru_grn_log
    FOR EACH ROW
    EXECUTE FUNCTION public.satguru_update_stock_on_grn();

CREATE TRIGGER satguru_issue_stock_update
    AFTER INSERT ON public.satguru_issue_log
    FOR EACH ROW
    EXECUTE FUNCTION public.satguru_update_stock_on_issue();

-- Phase 3: Recalculate all stock values in satguru_stock table
-- This will sync the satguru_stock table with the corrected view calculations

WITH corrected_stock AS (
  SELECT 
    item_code,
    current_qty,
    last_updated
  FROM satguru_stock_summary_view
)
INSERT INTO satguru_stock (item_code, current_qty, last_updated)
SELECT 
  cs.item_code,
  cs.current_qty,
  COALESCE(cs.last_updated::timestamp with time zone, now())
FROM corrected_stock cs
ON CONFLICT (item_code) 
DO UPDATE SET
  current_qty = EXCLUDED.current_qty,
  last_updated = EXCLUDED.last_updated;

-- Phase 4: Verification query to check negative stock items
-- This will help us verify the fix worked
SELECT 
  item_code,
  item_name,
  current_qty,
  opening_stock,
  total_grns,
  total_issues,
  stock_status
FROM satguru_stock_summary_view 
WHERE current_qty < 0
ORDER BY current_qty ASC;
