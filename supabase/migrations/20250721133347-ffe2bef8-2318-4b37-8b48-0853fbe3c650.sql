-- Create a simple working view that uses satguru_stock as primary source
DROP VIEW IF EXISTS satguru_stock_summary_view;
CREATE VIEW satguru_stock_summary_view AS
SELECT 
  s.item_code,
  im.item_name,
  s.current_qty,
  s.last_updated,
  im.uom,
  im.usage_type as category_name,
  im.category_id,
  0 as reorder_level,
  -- Add calculated fields that will be used by components
  0 as opening_stock,
  0 as total_grns,
  0 as total_issues,
  0 as received_30_days,
  0 as consumption_30_days,
  CASE 
    WHEN s.current_qty <= 0 THEN 'out_of_stock'
    WHEN s.current_qty <= 0 THEN 'low_stock'
    WHEN s.current_qty > 0 THEN 'normal'
    ELSE 'normal'
  END as stock_status
FROM satguru_stock s
LEFT JOIN satguru_item_master im ON s.item_code = im.item_code;