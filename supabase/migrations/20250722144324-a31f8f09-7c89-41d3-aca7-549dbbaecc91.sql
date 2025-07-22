
-- Phase 1: Database & Performance Optimization

-- Create materialized view for category statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.category_stats_mv AS
SELECT 
  c.id,
  c.category_name,
  c.description,
  c.created_at,
  c.updated_at,
  COALESCE(stats.total_items, 0) as total_items,
  COALESCE(stats.active_items, 0) as active_items,
  COALESCE(stats.fg_items, 0) as fg_items,
  COALESCE(stats.rm_items, 0) as rm_items,
  COALESCE(stats.packaging_items, 0) as packaging_items,
  COALESCE(stats.consumable_items, 0) as consumable_items,
  COALESCE(stats.last_item_added, NULL) as last_item_added,
  COALESCE(stats.avg_item_value, 0) as avg_item_value
FROM public.satguru_categories c
LEFT JOIN (
  SELECT 
    category_id,
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE status = 'active') as active_items,
    COUNT(*) FILTER (WHERE usage_type = 'FINISHED_GOOD') as fg_items,
    COUNT(*) FILTER (WHERE usage_type = 'RAW_MATERIAL') as rm_items,
    COUNT(*) FILTER (WHERE usage_type = 'PACKAGING') as packaging_items,
    COUNT(*) FILTER (WHERE usage_type = 'CONSUMABLE') as consumable_items,
    MAX(created_at) as last_item_added,
    AVG(COALESCE(
      (SELECT current_price FROM public.item_pricing_master ipm 
       WHERE ipm.item_code = sim.item_code 
       ORDER BY effective_date DESC LIMIT 1), 0
    )) as avg_item_value
  FROM public.satguru_item_master sim
  WHERE category_id IS NOT NULL
  GROUP BY category_id
) stats ON c.id = stats.category_id;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_category_stats_mv_id ON public.category_stats_mv(id);
CREATE INDEX IF NOT EXISTS idx_category_stats_mv_name ON public.category_stats_mv USING gin(to_tsvector('english', category_name));
CREATE INDEX IF NOT EXISTS idx_satguru_categories_name_search ON public.satguru_categories USING gin(to_tsvector('english', category_name));

-- Enhance categories table with enterprise features
ALTER TABLE public.satguru_categories 
ADD COLUMN IF NOT EXISTS category_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS parent_category_id UUID REFERENCES public.satguru_categories(id),
ADD COLUMN IF NOT EXISTS category_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS category_type TEXT DEFAULT 'STANDARD' CHECK (category_type IN ('STANDARD', 'SYSTEM', 'TEMPORARY')),
ADD COLUMN IF NOT EXISTS business_rules JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- Create category audit log table
CREATE TABLE IF NOT EXISTS public.category_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.satguru_categories(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'MERGE', 'SPLIT')),
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  business_justification TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create category hierarchy view
CREATE OR REPLACE VIEW public.category_hierarchy_view AS
WITH RECURSIVE category_tree AS (
  -- Base case: root categories
  SELECT 
    id,
    category_name,
    category_code,
    parent_category_id,
    category_level,
    ARRAY[category_name] as path,
    category_name as full_path
  FROM public.satguru_categories 
  WHERE parent_category_id IS NULL AND is_active = true
  
  UNION ALL
  
  -- Recursive case: child categories
  SELECT 
    c.id,
    c.category_name,
    c.category_code,
    c.parent_category_id,
    c.category_level,
    ct.path || c.category_name,
    ct.full_path || ' > ' || c.category_name
  FROM public.satguru_categories c
  JOIN category_tree ct ON c.parent_category_id = ct.id
  WHERE c.is_active = true
)
SELECT * FROM category_tree;

-- Function to refresh category stats materialized view
CREATE OR REPLACE FUNCTION refresh_category_stats()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.category_stats_mv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-refresh materialized view when items change
CREATE OR REPLACE FUNCTION trigger_refresh_category_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Use pg_notify to trigger async refresh
  PERFORM pg_notify('refresh_category_stats', '');
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-refresh
DROP TRIGGER IF EXISTS refresh_category_stats_on_item_change ON public.satguru_item_master;
CREATE TRIGGER refresh_category_stats_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.satguru_item_master
  FOR EACH ROW EXECUTE FUNCTION trigger_refresh_category_stats();

DROP TRIGGER IF EXISTS refresh_category_stats_on_category_change ON public.satguru_categories;
CREATE TRIGGER refresh_category_stats_on_category_change
  AFTER INSERT OR UPDATE OR DELETE ON public.satguru_categories
  FOR EACH ROW EXECUTE FUNCTION trigger_refresh_category_stats();

-- Function for category validation
CREATE OR REPLACE FUNCTION validate_category_data(
  p_category_name TEXT,
  p_category_code TEXT DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_errors TEXT[] := '{}';
  v_warnings TEXT[] := '{}';
  v_suggestions TEXT[] := '{}';
BEGIN
  -- Validate category name
  IF p_category_name IS NULL OR trim(p_category_name) = '' THEN
    v_errors := array_append(v_errors, 'Category name is required');
  ELSIF length(p_category_name) < 2 THEN
    v_errors := array_append(v_errors, 'Category name must be at least 2 characters');
  ELSIF length(p_category_name) > 100 THEN
    v_errors := array_append(v_errors, 'Category name must be less than 100 characters');
  END IF;
  
  -- Check for duplicate names
  IF EXISTS (SELECT 1 FROM public.satguru_categories WHERE category_name = p_category_name) THEN
    v_errors := array_append(v_errors, 'Category name already exists');
  END IF;
  
  -- Validate category code if provided
  IF p_category_code IS NOT NULL THEN
    IF length(p_category_code) < 2 OR length(p_category_code) > 20 THEN
      v_errors := array_append(v_errors, 'Category code must be between 2-20 characters');
    ELSIF p_category_code !~ '^[A-Z0-9_-]+$' THEN
      v_errors := array_append(v_errors, 'Category code must contain only uppercase letters, numbers, underscores, and hyphens');
    ELSIF EXISTS (SELECT 1 FROM public.satguru_categories WHERE category_code = p_category_code) THEN
      v_errors := array_append(v_errors, 'Category code already exists');
    END IF;
  ELSE
    v_suggestions := array_append(v_suggestions, 'Consider adding a unique category code for better organization');
  END IF;
  
  -- Validate parent category
  IF p_parent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.satguru_categories WHERE id = p_parent_id AND is_active = true) THEN
      v_errors := array_append(v_errors, 'Parent category does not exist or is inactive');
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'valid', array_length(v_errors, 1) IS NULL,
    'errors', to_jsonb(v_errors),
    'warnings', to_jsonb(v_warnings),
    'suggestions', to_jsonb(v_suggestions)
  );
END;
$$;

-- Function for bulk category operations
CREATE OR REPLACE FUNCTION bulk_update_categories(
  p_operations JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  op JSONB;
  result JSONB := '{"success": 0, "failed": 0, "errors": []}';
  success_count INTEGER := 0;
  failed_count INTEGER := 0;
  errors JSONB[] := '{}';
BEGIN
  FOR op IN SELECT * FROM jsonb_array_elements(p_operations) LOOP
    BEGIN
      CASE op->>'action'
        WHEN 'update' THEN
          UPDATE public.satguru_categories 
          SET 
            category_name = COALESCE(op->>'category_name', category_name),
            description = COALESCE(op->>'description', description),
            category_code = COALESCE(op->>'category_code', category_code),
            is_active = COALESCE((op->>'is_active')::BOOLEAN, is_active),
            updated_at = NOW(),
            last_modified_by = auth.uid()
          WHERE id = (op->>'id')::UUID;
          
        WHEN 'delete' THEN
          -- Soft delete
          UPDATE public.satguru_categories 
          SET is_active = false, updated_at = NOW(), last_modified_by = auth.uid()
          WHERE id = (op->>'id')::UUID;
          
        WHEN 'merge' THEN
          -- Move all items from source to target category
          UPDATE public.satguru_item_master 
          SET category_id = (op->>'target_id')::UUID
          WHERE category_id = (op->>'source_id')::UUID;
          
          -- Deactivate source category
          UPDATE public.satguru_categories 
          SET is_active = false, updated_at = NOW(), last_modified_by = auth.uid()
          WHERE id = (op->>'source_id')::UUID;
      END CASE;
      
      success_count := success_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
      errors := array_append(errors, jsonb_build_object(
        'operation', op,
        'error', SQLERRM
      ));
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', success_count,
    'failed', failed_count,
    'errors', array_to_json(errors)
  );
END;
$$;

-- Update RLS policies for enhanced tables
ALTER TABLE public.category_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view category audit logs" ON public.category_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid() 
      AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

-- Grant necessary permissions
GRANT SELECT ON public.category_stats_mv TO authenticated;
GRANT SELECT ON public.category_hierarchy_view TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_category_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_category_data(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_update_categories(JSONB) TO authenticated;

-- Initial refresh of materialized view
SELECT refresh_category_stats();
