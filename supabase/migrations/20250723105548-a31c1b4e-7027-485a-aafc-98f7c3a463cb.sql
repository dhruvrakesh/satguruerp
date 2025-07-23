
-- Enhanced material flow tracking with automated transfer capabilities
CREATE OR REPLACE FUNCTION get_available_upstream_materials(
  p_uiorn TEXT,
  p_current_process TEXT
) RETURNS TABLE(
  material_id UUID,
  process_stage TEXT,
  material_type TEXT,
  available_quantity NUMERIC,
  quality_grade TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE,
  operator_id UUID
) AS $$
BEGIN
  -- Get the process order mapping
  WITH process_order AS (
    SELECT 
      process_name,
      ROW_NUMBER() OVER (ORDER BY 
        CASE process_name
          WHEN 'GRAVURE_PRINTING' THEN 1
          WHEN 'LAMINATION' THEN 2
          WHEN 'ADHESIVE_COATING' THEN 3
          WHEN 'SLITTING' THEN 4
          WHEN 'PACKAGING' THEN 5
          ELSE 99
        END
      ) as process_order
    FROM (VALUES 
      ('GRAVURE_PRINTING'),
      ('LAMINATION'),
      ('ADHESIVE_COATING'),
      ('SLITTING'),
      ('PACKAGING')
    ) AS processes(process_name)
  ),
  current_order AS (
    SELECT process_order FROM process_order WHERE process_name = p_current_process
  ),
  upstream_processes AS (
    SELECT process_name 
    FROM process_order 
    WHERE process_order < (SELECT process_order FROM current_order)
  )
  
  RETURN QUERY
  SELECT 
    mft.id as material_id,
    mft.process_stage::TEXT,
    mft.input_material_type as material_type,
    mft.output_good_quantity as available_quantity,
    mft.quality_grade,
    mft.recorded_at,
    mft.operator_id
  FROM material_flow_tracking mft
  WHERE mft.uiorn = p_uiorn
    AND mft.process_stage::TEXT IN (SELECT process_name FROM upstream_processes)
    AND mft.output_good_quantity > 0
    AND mft.quality_grade IN ('GRADE_A', 'GRADE_B')
    AND NOT EXISTS (
      -- Check if material has already been transferred
      SELECT 1 FROM process_transfers pt
      WHERE pt.uiorn = p_uiorn
        AND pt.from_process = mft.process_stage::TEXT
        AND pt.quantity_sent >= mft.output_good_quantity
        AND pt.transfer_status = 'RECEIVED'
    )
  ORDER BY mft.recorded_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-transfer good materials between processes
CREATE OR REPLACE FUNCTION auto_transfer_good_materials(
  p_uiorn TEXT,
  p_from_process TEXT,
  p_to_process TEXT,
  p_operator_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_material RECORD;
  v_transfer_id UUID;
  v_transferred_count INTEGER := 0;
  v_total_quantity NUMERIC := 0;
  v_result JSONB;
BEGIN
  -- Get available materials from upstream process
  FOR v_material IN 
    SELECT * FROM get_available_upstream_materials(p_uiorn, p_to_process)
    WHERE process_stage = p_from_process
  LOOP
    -- Create transfer record
    INSERT INTO process_transfers (
      uiorn,
      from_process,
      to_process,
      material_type,
      quantity_sent,
      quantity_received,
      unit_of_measure,
      transfer_status,
      sent_by,
      received_by,
      sent_at,
      received_at,
      quality_notes
    ) VALUES (
      p_uiorn,
      p_from_process,
      p_to_process,
      v_material.material_type,
      v_material.available_quantity,
      v_material.available_quantity, -- Auto-receive for seamless flow
      'KG',
      'RECEIVED',
      v_material.operator_id,
      COALESCE(p_operator_id, v_material.operator_id),
      v_material.recorded_at,
      NOW(),
      'Auto-transferred: ' || v_material.quality_grade || ' material'
    ) RETURNING id INTO v_transfer_id;
    
    v_transferred_count := v_transferred_count + 1;
    v_total_quantity := v_total_quantity + v_material.available_quantity;
  END LOOP;
  
  v_result := jsonb_build_object(
    'success', true,
    'transferred_count', v_transferred_count,
    'total_quantity', v_total_quantity,
    'from_process', p_from_process,
    'to_process', p_to_process,
    'uiorn', p_uiorn
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate material flow continuity
CREATE OR REPLACE FUNCTION validate_material_flow_continuity(p_uiorn TEXT)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_process_gaps JSONB[];
  v_total_input NUMERIC;
  v_total_output NUMERIC;
  v_process RECORD;
BEGIN
  -- Check for gaps in material flow
  FOR v_process IN 
    SELECT 
      process_stage,
      SUM(input_quantity) as total_input,
      SUM(output_good_quantity + output_rework_quantity + output_waste_quantity) as total_output,
      COUNT(*) as entry_count
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
    -- Check for material balance issues
    IF ABS(v_process.total_input - v_process.total_output) > 0.1 THEN
      v_process_gaps := array_append(v_process_gaps, 
        jsonb_build_object(
          'process_stage', v_process.process_stage,
          'issue_type', 'material_balance',
          'input_quantity', v_process.total_input,
          'output_quantity', v_process.total_output,
          'variance', v_process.total_output - v_process.total_input
        )
      );
    END IF;
    
    -- Check for missing entries
    IF v_process.entry_count = 0 THEN
      v_process_gaps := array_append(v_process_gaps, 
        jsonb_build_object(
          'process_stage', v_process.process_stage,
          'issue_type', 'missing_data',
          'message', 'No material flow data found for this process'
        )
      );
    END IF;
  END LOOP;
  
  v_result := jsonb_build_object(
    'uiorn', p_uiorn,
    'is_valid', CASE WHEN array_length(v_process_gaps, 1) IS NULL THEN true ELSE false END,
    'gaps_found', COALESCE(array_length(v_process_gaps, 1), 0),
    'process_gaps', COALESCE(to_jsonb(v_process_gaps), '[]'::jsonb),
    'validation_timestamp', NOW()
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced material availability view with transfer status
CREATE OR REPLACE VIEW material_flow_continuity_view AS
SELECT 
  mft.id,
  mft.uiorn,
  mft.process_stage,
  mft.input_material_type,
  mft.output_good_quantity,
  mft.output_rework_quantity,
  mft.output_waste_quantity,
  mft.quality_grade,
  mft.recorded_at,
  mft.operator_id,
  -- Transfer status
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM process_transfers pt
      WHERE pt.uiorn = mft.uiorn
        AND pt.from_process = mft.process_stage::TEXT
        AND pt.quantity_sent >= mft.output_good_quantity
        AND pt.transfer_status = 'RECEIVED'
    ) THEN 'TRANSFERRED'
    WHEN mft.output_good_quantity > 0 THEN 'AVAILABLE'
    ELSE 'CONSUMED'
  END as availability_status,
  -- Next process suggestion
  CASE mft.process_stage
    WHEN 'GRAVURE_PRINTING' THEN 'LAMINATION'
    WHEN 'LAMINATION' THEN 'ADHESIVE_COATING'
    WHEN 'ADHESIVE_COATING' THEN 'SLITTING'
    WHEN 'SLITTING' THEN 'PACKAGING'
    ELSE NULL
  END as suggested_next_process,
  -- Material flow efficiency
  CASE 
    WHEN mft.input_quantity > 0 THEN 
      (mft.output_good_quantity / mft.input_quantity) * 100
    ELSE 0
  END as process_efficiency_percentage
FROM material_flow_tracking mft
WHERE mft.output_good_quantity > 0
ORDER BY mft.uiorn, mft.recorded_at DESC;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_available_upstream_materials TO authenticated;
GRANT EXECUTE ON FUNCTION auto_transfer_good_materials TO authenticated;
GRANT EXECUTE ON FUNCTION validate_material_flow_continuity TO authenticated;
GRANT SELECT ON material_flow_continuity_view TO authenticated;
