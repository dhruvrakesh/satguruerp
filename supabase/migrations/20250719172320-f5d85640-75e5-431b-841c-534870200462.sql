
-- Phase 1: Stock Data Population - Create opening stock from existing item master
INSERT INTO public.satguru_stock (item_code, current_qty, reorder_level, last_updated)
SELECT 
  item_code,
  CASE 
    WHEN usage_type IN ('RAW_MATERIAL', 'CONSUMABLE') THEN 
      FLOOR(RANDOM() * 500 + 50)::numeric  -- Random stock between 50-550 for RM/Consumables
    WHEN usage_type = 'FINISHED_GOOD' THEN
      FLOOR(RANDOM() * 100 + 10)::numeric  -- Random stock between 10-110 for FG
    ELSE 
      FLOOR(RANDOM() * 200 + 20)::numeric  -- Default range for other types
  END as current_qty,
  CASE 
    WHEN usage_type IN ('RAW_MATERIAL', 'CONSUMABLE') THEN 
      FLOOR(RANDOM() * 50 + 10)::numeric   -- Reorder level 10-60
    ELSE 
      FLOOR(RANDOM() * 20 + 5)::numeric    -- Reorder level 5-25
  END as reorder_level,
  NOW() as last_updated
FROM public.satguru_item_master 
WHERE item_code IS NOT NULL
ON CONFLICT (item_code) DO UPDATE SET
  current_qty = EXCLUDED.current_qty,
  reorder_level = EXCLUDED.reorder_level,
  last_updated = NOW();

-- Phase 2: Create sample GRN transaction history (last 30 days)
INSERT INTO public.satguru_grn_log (
  grn_number, item_code, qty_received, uom, vendor, date, amount_inr, remarks
)
SELECT 
  'GRN-' || LPAD((ROW_NUMBER() OVER())::TEXT, 6, '0') as grn_number,
  im.item_code,
  FLOOR(RANDOM() * 100 + 10)::numeric as qty_received,
  COALESCE(im.uom, 'KG') as uom,
  CASE (RANDOM() * 5)::INTEGER
    WHEN 0 THEN 'Supplier A Ltd'
    WHEN 1 THEN 'Raw Materials Co'
    WHEN 2 THEN 'Chemical Supplies Inc'
    WHEN 3 THEN 'Packaging Materials'
    ELSE 'General Suppliers'
  END as vendor,
  (CURRENT_DATE - (RANDOM() * 30)::INTEGER) as date,
  FLOOR(RANDOM() * 10000 + 500)::numeric as amount_inr,
  'Initial stock population' as remarks
FROM public.satguru_item_master im
WHERE im.usage_type IN ('RAW_MATERIAL', 'CONSUMABLE', 'PACKAGING')
  AND RANDOM() < 0.6  -- Create GRN for 60% of RM/Consumables
LIMIT 100;

-- Phase 3: Create sample issue transaction history (last 30 days)
INSERT INTO public.satguru_issue_log (
  item_code, qty_issued, total_issued_qty, purpose, date, remarks
)
SELECT 
  im.item_code,
  FLOOR(RANDOM() * 50 + 5)::numeric as qty_issued,
  FLOOR(RANDOM() * 50 + 5)::numeric as total_issued_qty,
  CASE (RANDOM() * 4)::INTEGER
    WHEN 0 THEN 'Production Job'
    WHEN 1 THEN 'Maintenance Work'
    WHEN 2 THEN 'Quality Testing'
    ELSE 'General Manufacturing'
  END as purpose,
  (CURRENT_DATE - (RANDOM() * 30)::INTEGER) as date,
  'Manufacturing consumption' as remarks
FROM public.satguru_item_master im
WHERE im.usage_type IN ('RAW_MATERIAL', 'CONSUMABLE')
  AND RANDOM() < 0.4  -- Create issues for 40% of RM/Consumables
LIMIT 80;

-- Phase 4: Create stock records for Finished Goods from artwork data
INSERT INTO public.satguru_stock (item_code, current_qty, reorder_level, last_updated)
SELECT DISTINCT
  ars.item_code,
  FLOOR(RANDOM() * 50 + 5)::numeric as current_qty,
  FLOOR(RANDOM() * 10 + 2)::numeric as reorder_level,
  NOW() as last_updated
FROM public._artworks_revised_staging ars
WHERE ars.item_code IS NOT NULL 
  AND ars.item_code != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.satguru_stock ss 
    WHERE ss.item_code = ars.item_code
  )
LIMIT 50;

-- Phase 5: Update stock quantities based on recent transactions
UPDATE public.satguru_stock 
SET current_qty = GREATEST(0, 
  current_qty 
  + COALESCE((
    SELECT SUM(qty_received) 
    FROM public.satguru_grn_log 
    WHERE item_code = satguru_stock.item_code
  ), 0)
  - COALESCE((
    SELECT SUM(qty_issued) 
    FROM public.satguru_issue_log 
    WHERE item_code = satguru_stock.item_code
  ), 0)
),
last_updated = NOW()
WHERE EXISTS (
  SELECT 1 FROM public.satguru_grn_log 
  WHERE item_code = satguru_stock.item_code
) OR EXISTS (
  SELECT 1 FROM public.satguru_issue_log 
  WHERE item_code = satguru_stock.item_code
);

-- Phase 6: Create stock summary view refresh
REFRESH MATERIALIZED VIEW IF EXISTS public.satguru_stock_summary_view;
