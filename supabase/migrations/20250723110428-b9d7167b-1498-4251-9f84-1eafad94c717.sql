
-- Phase 2 & 3 Enhancements: Advanced Material Flow Orchestration

-- Create material type validation function
CREATE OR REPLACE FUNCTION validate_material_type_compatibility(
  p_from_process TEXT,
  p_to_process TEXT,
  p_material_type TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Define valid material type transitions
  RETURN CASE
    WHEN p_from_process = 'GRAVURE_PRINTING' AND p_to_process = 'LAMINATION' 
      AND p_material_type = 'PRINTED_MATERIAL' THEN true
    WHEN p_from_process = 'LAMINATION' AND p_to_process = 'ADHESIVE_COATING' 
      AND p_material_type = 'LAMINATED_MATERIAL' THEN true
    WHEN p_from_process = 'ADHESIVE_COATING' AND p_to_process = 'SLITTING' 
      AND p_material_type = 'COATED_MATERIAL' THEN true
    WHEN p_from_process = 'SLITTING' AND p_to_process = 'PACKAGING' 
      AND p_material_type = 'SLIT_MATERIAL' THEN true
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced rework routing function
CREATE OR REPLACE FUNCTION route_rework_material(
  p_uiorn TEXT,
  p_material_type TEXT,
  p_quality_grade TEXT,
  p_rework_quantity NUMERIC,
  p_current_process TEXT
) RETURNS JSONB AS $$
DECLARE
  v_target_process TEXT;
  v_routing_result JSONB;
BEGIN
  -- Determine target process for rework based on material type and issue
  v_target_process := CASE
    WHEN p_material_type = 'PRINTED_MATERIAL' AND p_quality_grade = 'REWORK' THEN 'GRAVURE_PRINTING'
    WHEN p_material_type = 'LAMINATED_MATERIAL' AND p_quality_grade = 'REWORK' THEN 'LAMINATION'
    WHEN p_material_type = 'COATED_MATERIAL' AND p_quality_grade = 'REWORK' THEN 'ADHESIVE_COATING'
    WHEN p_material_type = 'SLIT_MATERIAL' AND p_quality_grade = 'REWORK' THEN 'SLITTING'
    ELSE p_current_process
  END;
  
  -- Create rework routing record
  INSERT INTO process_transfers (
    uiorn,
    from_process,
    to_process,
    material_type,
    quantity_sent,
    unit_of_measure,
    transfer_status,
    quality_notes,
    sent_at
  ) VALUES (
    p_uiorn,
    p_current_process,
    v_target_process,
    p_material_type,
    p_rework_quantity,
    'KG',
    'REWORK_ROUTING',
    'Auto-routed rework material for reprocessing',
    NOW()
  );
  
  v_routing_result := jsonb_build_object(
    'success', true,
    'rework_routed_to', v_target_process,
    'quantity', p_rework_quantity,
    'material_type', p_material_type,
    'routing_timestamp', NOW()
  );
  
  RETURN v_routing_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process readiness assessment function
CREATE OR REPLACE FUNCTION assess_process_readiness(
  p_uiorn TEXT,
  p_target_process TEXT
) RETURNS JSONB AS $$
DECLARE
  v_readiness_data JSONB;
  v_available_materials INTEGER;
  v_total_quantity NUMERIC;
  v_quality_issues INTEGER;
  v_pending_transfers INTEGER;
BEGIN
  -- Count available materials from upstream processes
  SELECT COUNT(*), COALESCE(SUM(available_quantity), 0)
  INTO v_available_materials, v_total_quantity
  FROM get_available_upstream_materials(p_uiorn, p_target_process);
  
  -- Check for quality issues
  SELECT COUNT(*)
  INTO v_quality_issues
  FROM material_flow_tracking
  WHERE uiorn = p_uiorn
    AND quality_grade = 'REWORK'
    AND process_stage::TEXT = p_target_process;
  
  -- Check pending transfers
  SELECT COUNT(*)
  INTO v_pending_transfers
  FROM process_transfers
  WHERE uiorn = p_uiorn
    AND to_process = p_target_process
    AND transfer_status IN ('INITIATED', 'IN_TRANSIT');
  
  v_readiness_data := jsonb_build_object(
    'process', p_target_process,
    'is_ready', v_available_materials > 0 AND v_pending_transfers = 0,
    'available_materials', v_available_materials,
    'total_quantity', v_total_quantity,
    'quality_issues', v_quality_issues,
    'pending_transfers', v_pending_transfers,
    'readiness_score', CASE
      WHEN v_available_materials > 0 AND v_pending_transfers = 0 THEN 100
      WHEN v_available_materials > 0 THEN 75
      WHEN v_pending_transfers > 0 THEN 50
      ELSE 0
    END,
    'assessment_timestamp', NOW()
  );
  
  RETURN v_readiness_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- End-to-end yield calculation function
CREATE OR REPLACE FUNCTION calculate_end_to_end_yield(p_uiorn TEXT)
RETURNS JSONB AS $$
DECLARE
  v_yield_data JSONB;
  v_total_input NUMERIC := 0;
  v_total_output NUMERIC := 0;
  v_total_waste NUMERIC := 0;
  v_total_rework NUMERIC := 0;
  v_process_yields JSONB := '[]'::jsonb;
  v_process RECORD;
BEGIN
  -- Calculate yield for each process
  FOR v_process IN
    SELECT 
      process_stage,
      SUM(input_quantity) as stage_input,
      SUM(output_good_quantity) as stage_output,
      SUM(output_waste_quantity) as stage_waste,
      SUM(output_rework_quantity) as stage_rework,
      CASE 
        WHEN SUM(input_quantity) > 0 THEN 
          (SUM(output_good_quantity) / SUM(input_quantity)) * 100
        ELSE 0
      END as stage_yield
    FROM material_flow_tracking
    WHERE uiorn = p_uiorn
    GROUP BY process_stage
    ORDER BY 
      CASE process_stage
        WHEN 'GRAVURE_PRINTING' THEN 1
        WHEN 'LAMINATION' THEN 2
        WHEN 'ADHESIVE_COATING' THEN 3
        WHEN 'SLITTING' THEN 4
        WHEN 'PACKAGING' THEN 5
        ELSE 99
      END
  LOOP
    -- Add to totals
    v_total_input := v_total_input + v_process.stage_input;
    v_total_output := v_total_output + v_process.stage_output;
    v_total_waste := v_total_waste + v_process.stage_waste;
    v_total_rework := v_total_rework + v_process.stage_rework;
    
    -- Add process yield to array
    v_process_yields := v_process_yields || jsonb_build_object(
      'process', v_process.process_stage,
      'input_quantity', v_process.stage_input,
      'output_quantity', v_process.stage_output,
      'waste_quantity', v_process.stage_waste,
      'rework_quantity', v_process.stage_rework,
      'yield_percentage', ROUND(v_process.stage_yield, 2)
    );
  END LOOP;
  
  -- Calculate overall yield
  v_yield_data := jsonb_build_object(
    'uiorn', p_uiorn,
    'overall_yield_percentage', CASE 
      WHEN v_total_input > 0 THEN ROUND((v_total_output / v_total_input) * 100, 2)
      ELSE 0
    END,
    'total_input', v_total_input,
    'total_output', v_total_output,
    'total_waste', v_total_waste,
    'total_rework', v_total_rework,
    'waste_percentage', CASE 
      WHEN v_total_input > 0 THEN ROUND((v_total_waste / v_total_input) * 100, 2)
      ELSE 0
    END,
    'rework_percentage', CASE 
      WHEN v_total_input > 0 THEN ROUND((v_total_rework / v_total_input) * 100, 2)
      ELSE 0
    END,
    'process_yields', v_process_yields,
    'calculated_at', NOW()
  );
  
  RETURN v_yield_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bottleneck identification function
CREATE OR REPLACE FUNCTION identify_process_bottlenecks(p_uiorn TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_bottlenecks JSONB := '[]'::jsonb;
  v_process RECORD;
  v_where_clause TEXT := '';
BEGIN
  -- Build where clause if uiorn is provided
  IF p_uiorn IS NOT NULL THEN
    v_where_clause := 'WHERE uiorn = ' || quote_literal(p_uiorn);
  END IF;
  
  -- Identify bottlenecks by analyzing processing times and yields
  FOR v_process IN EXECUTE format($sql$
    SELECT 
      process_stage,
      COUNT(*) as process_count,
      AVG(yield_percentage) as avg_yield,
      AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_processing_hours,
      SUM(output_waste_quantity) as total_waste,
      SUM(output_rework_quantity) as total_rework
    FROM material_flow_tracking
    %s
    GROUP BY process_stage
    ORDER BY avg_yield ASC, avg_processing_hours DESC
  $sql$, v_where_clause)
  LOOP
    -- Calculate bottleneck score
    v_bottlenecks := v_bottlenecks || jsonb_build_object(
      'process', v_process.process_stage,
      'bottleneck_score', ROUND(
        (100 - COALESCE(v_process.avg_yield, 0)) + 
        (COALESCE(v_process.avg_processing_hours, 0) * 2) +
        (COALESCE(v_process.total_waste, 0) * 0.1) +
        (COALESCE(v_process.total_rework, 0) * 0.1)
      , 2),
      'avg_yield', ROUND(COALESCE(v_process.avg_yield, 0), 2),
      'avg_processing_hours', ROUND(COALESCE(v_process.avg_processing_hours, 0), 2),
      'total_waste', COALESCE(v_process.total_waste, 0),
      'total_rework', COALESCE(v_process.total_rework, 0),
      'recommendation', CASE
        WHEN v_process.avg_yield < 80 THEN 'Focus on quality improvement'
        WHEN v_process.avg_processing_hours > 4 THEN 'Optimize processing time'
        WHEN v_process.total_waste > 10 THEN 'Implement waste reduction measures'
        ELSE 'Monitor performance'
      END
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'bottlenecks', v_bottlenecks,
    'analysis_scope', CASE WHEN p_uiorn IS NOT NULL THEN 'single_order' ELSE 'all_orders' END,
    'analyzed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION validate_material_type_compatibility TO authenticated;
GRANT EXECUTE ON FUNCTION route_rework_material TO authenticated;
GRANT EXECUTE ON FUNCTION assess_process_readiness TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_end_to_end_yield TO authenticated;
GRANT EXECUTE ON FUNCTION identify_process_bottlenecks TO authenticated;
