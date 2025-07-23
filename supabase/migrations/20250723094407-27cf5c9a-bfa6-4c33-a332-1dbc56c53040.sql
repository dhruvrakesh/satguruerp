-- Phase 3-5: Performance Optimization & Enterprise Features

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_satguru_categories_active ON satguru_categories(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_satguru_categories_parent ON satguru_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_satguru_item_master_category ON satguru_item_master(category_id);
CREATE INDEX IF NOT EXISTS idx_item_pricing_master_active ON item_pricing_master(item_code, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_satguru_grn_log_item_date ON satguru_grn_log(item_code, date DESC);

-- Category usage tracking table
CREATE TABLE IF NOT EXISTS category_usage_tracking (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid REFERENCES satguru_categories(id) ON DELETE CASCADE,
    usage_type text NOT NULL CHECK (usage_type IN ('VIEW', 'ITEM_ADDED', 'ITEM_REMOVED', 'UPDATED', 'SEARCHED')),
    user_id uuid REFERENCES auth.users(id),
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

-- Category approval workflow table
CREATE TABLE IF NOT EXISTS category_approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid REFERENCES satguru_categories(id) ON DELETE CASCADE,
    requested_by uuid REFERENCES auth.users(id),
    approved_by uuid REFERENCES auth.users(id),
    approval_status text NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    change_type text NOT NULL CHECK (change_type IN ('CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE')),
    change_data jsonb NOT NULL,
    business_justification text,
    approval_notes text,
    requested_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Category recommendations table
CREATE TABLE IF NOT EXISTS category_recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    suggested_category_name text NOT NULL,
    suggested_category_code text,
    confidence_score numeric(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    reasoning text,
    based_on_items text[], -- Array of item codes that suggested this category
    status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
    created_by uuid REFERENCES auth.users(id),
    processed_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone
);

-- Function to track category usage
CREATE OR REPLACE FUNCTION track_category_usage(
    p_category_id uuid,
    p_usage_type text,
    p_metadata jsonb DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO category_usage_tracking (category_id, usage_type, user_id, metadata)
    VALUES (p_category_id, p_usage_type, auth.uid(), p_metadata);
END;
$$;

-- Function to get category performance metrics
CREATE OR REPLACE FUNCTION get_category_performance_metrics(p_days integer DEFAULT 30)
RETURNS TABLE(
    category_id uuid,
    category_name text,
    view_count bigint,
    item_additions bigint,
    search_frequency bigint,
    last_activity timestamp with time zone,
    utilization_score numeric
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH usage_stats AS (
        SELECT 
            cut.category_id,
            COUNT(CASE WHEN cut.usage_type = 'VIEW' THEN 1 END) as view_count,
            COUNT(CASE WHEN cut.usage_type = 'ITEM_ADDED' THEN 1 END) as item_additions,
            COUNT(CASE WHEN cut.usage_type = 'SEARCHED' THEN 1 END) as search_frequency,
            MAX(cut.created_at) as last_activity
        FROM category_usage_tracking cut
        WHERE cut.created_at >= now() - interval '%s days' FORMAT(p_days)
        GROUP BY cut.category_id
    )
    SELECT 
        c.id,
        c.category_name,
        COALESCE(us.view_count, 0),
        COALESCE(us.item_additions, 0),
        COALESCE(us.search_frequency, 0),
        us.last_activity,
        -- Calculate utilization score (0-100)
        LEAST(100, (
            COALESCE(us.view_count, 0) * 0.1 +
            COALESCE(us.item_additions, 0) * 2 +
            COALESCE(us.search_frequency, 0) * 0.5
        )) as utilization_score
    FROM satguru_categories c
    LEFT JOIN usage_stats us ON c.id = us.category_id
    WHERE c.is_active = true
    ORDER BY utilization_score DESC;
END;
$$;

-- Function to generate category recommendations
CREATE OR REPLACE FUNCTION generate_category_recommendations()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_item record;
    v_suggested_name text;
    v_confidence numeric;
BEGIN
    -- Clear old recommendations
    DELETE FROM category_recommendations WHERE created_at < now() - interval '30 days';
    
    -- Find items without categories or in poorly named categories
    FOR v_item IN
        SELECT item_code, item_name
        FROM satguru_item_master
        WHERE category_id IS NULL 
        OR category_id IN (
            SELECT id FROM satguru_categories 
            WHERE category_name ILIKE '%misc%' OR category_name ILIKE '%other%'
        )
        LIMIT 50
    LOOP
        -- Simple pattern-based category suggestion
        v_suggested_name := NULL;
        v_confidence := 0.5;
        
        IF v_item.item_name ILIKE '%paper%' THEN
            v_suggested_name := 'Paper Products';
            v_confidence := 0.8;
        ELSIF v_item.item_name ILIKE '%ink%' OR v_item.item_name ILIKE '%colour%' THEN
            v_suggested_name := 'Inks & Colorants';
            v_confidence := 0.9;
        ELSIF v_item.item_name ILIKE '%adhesive%' OR v_item.item_name ILIKE '%glue%' THEN
            v_suggested_name := 'Adhesives';
            v_confidence := 0.85;
        ELSIF v_item.item_name ILIKE '%chemical%' THEN
            v_suggested_name := 'Chemicals';
            v_confidence := 0.7;
        END IF;
        
        -- Insert recommendation if we found a suggestion
        IF v_suggested_name IS NOT NULL THEN
            INSERT INTO category_recommendations (
                suggested_category_name,
                confidence_score,
                reasoning,
                based_on_items
            ) VALUES (
                v_suggested_name,
                v_confidence,
                'Pattern-based suggestion from item name: ' || v_item.item_name,
                ARRAY[v_item.item_code]
            ) ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END;
$$;

-- Function for category lifecycle management
CREATE OR REPLACE FUNCTION manage_category_lifecycle(
    p_category_id uuid,
    p_action text,
    p_justification text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_category record;
    v_item_count integer;
    v_result jsonb;
BEGIN
    -- Get category info
    SELECT * INTO v_category FROM satguru_categories WHERE id = p_category_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Category not found');
    END IF;
    
    -- Count items in category
    SELECT COUNT(*) INTO v_item_count 
    FROM satguru_item_master 
    WHERE category_id = p_category_id AND is_active = true;
    
    CASE p_action
        WHEN 'ARCHIVE' THEN
            IF v_item_count > 0 THEN
                RETURN jsonb_build_object(
                    'success', false, 
                    'error', 'Cannot archive category with active items',
                    'item_count', v_item_count
                );
            END IF;
            
            UPDATE satguru_categories 
            SET is_active = false, updated_at = now()
            WHERE id = p_category_id;
            
            v_result := jsonb_build_object('success', true, 'action', 'archived');
            
        WHEN 'RESTORE' THEN
            UPDATE satguru_categories 
            SET is_active = true, updated_at = now()
            WHERE id = p_category_id;
            
            v_result := jsonb_build_object('success', true, 'action', 'restored');
            
        WHEN 'DEPRECATE' THEN
            -- Mark as deprecated but keep active for existing items
            UPDATE satguru_categories 
            SET 
                category_name = category_name || ' (DEPRECATED)',
                description = COALESCE(description, '') || ' [DEPRECATED: ' || p_justification || ']',
                updated_at = now()
            WHERE id = p_category_id 
            AND category_name NOT ILIKE '%(DEPRECATED)%';
            
            v_result := jsonb_build_object('success', true, 'action', 'deprecated');
            
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'Unknown action: ' || p_action);
    END CASE;
    
    -- Log the lifecycle action
    PERFORM track_category_usage(p_category_id, 'LIFECYCLE_' || p_action, 
        jsonb_build_object('justification', p_justification, 'item_count', v_item_count));
    
    RETURN v_result;
END;
$$;

-- Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_category_usage_tracking_category ON category_usage_tracking(category_id, created_at);
CREATE INDEX IF NOT EXISTS idx_category_usage_tracking_type ON category_usage_tracking(usage_type, created_at);
CREATE INDEX IF NOT EXISTS idx_category_approvals_status ON category_approvals(approval_status, requested_at);
CREATE INDEX IF NOT EXISTS idx_category_recommendations_status ON category_recommendations(status, confidence_score DESC);

-- Enable RLS on new tables
ALTER TABLE category_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS policies for category usage tracking
CREATE POLICY "Authenticated users can track usage" ON category_usage_tracking
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Approved users can view usage tracking" ON category_usage_tracking
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles p 
        JOIN organizations o ON p.organization_id = o.id
        WHERE p.id = auth.uid() AND p.is_approved = true 
        AND o.code IN ('DKEGL', 'SATGURU')
    ));

-- RLS policies for category approvals
CREATE POLICY "Users can create approval requests" ON category_approvals
    FOR INSERT TO authenticated
    WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Approved users can manage approvals" ON category_approvals
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles p 
        JOIN organizations o ON p.organization_id = o.id
        WHERE p.id = auth.uid() AND p.is_approved = true 
        AND o.code IN ('DKEGL', 'SATGURU')
    ));

-- RLS policies for category recommendations
CREATE POLICY "Approved users can manage recommendations" ON category_recommendations
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles p 
        JOIN organizations o ON p.organization_id = o.id
        WHERE p.id = auth.uid() AND p.is_approved = true 
        AND o.code IN ('DKEGL', 'SATGURU')
    ));

-- Create background job to generate recommendations daily
CREATE OR REPLACE FUNCTION schedule_category_recommendations()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    PERFORM generate_category_recommendations();
END;
$$;