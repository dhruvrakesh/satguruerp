-- Fix the satguru_stock_summary_view to include all necessary columns
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
  -- Add 30-day metrics (these will be null in the view, components can calculate them)
  0 as received_30_days,
  0 as consumption_30_days,
  COALESCE(im.reorder_level, 0) as reorder_level,
  CASE 
    WHEN sss.current_qty <= 0 THEN 'out_of_stock'
    WHEN sss.current_qty <= COALESCE(im.reorder_level, 0) THEN 'low_stock'
    WHEN sss.current_qty > (COALESCE(im.reorder_level, 0) * 3) THEN 'overstock'
    ELSE 'normal'
  END as stock_status
FROM satguru_stock_summary sss
LEFT JOIN satguru_item_master im ON sss.item_code = im.item_code;