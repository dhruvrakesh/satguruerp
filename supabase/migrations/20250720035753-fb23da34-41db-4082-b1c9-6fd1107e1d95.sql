
-- Phase 1B: Core Integration Enhancements

-- Add BOM integration fields to material_flow_tracking
ALTER TABLE public.material_flow_tracking 
ADD COLUMN IF NOT EXISTS bom_variance_percentage NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS planned_consumption NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_vs_planned_variance NUMERIC DEFAULT 0;

-- Add order integration fields to material_flow_tracking
ALTER TABLE public.material_flow_tracking 
ADD COLUMN IF NOT EXISTS order_quantity NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_code TEXT,
ADD COLUMN IF NOT EXISTS fg_item_code TEXT;

-- Create material availability view for real-time checking
CREATE OR REPLACE VIEW public.material_availability_view AS
SELECT 
  uiorn,
  process_stage,
  output_good_quantity as available_quantity,
  quality_grade,
  recorded_at,
  operator_id,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM process_transfers pt 
      WHERE pt.uiorn = mft.uiorn 
      AND pt.from_process = mft.process_stage::text
      AND pt.transfer_status = 'RECEIVED'
    ) THEN 'TRANSFERRED'
    ELSE 'AVAILABLE'
  END as availability_status
FROM public.material_flow_tracking mft
WHERE output_good_quantity > 0
ORDER BY recorded_at DESC;

-- Create BOM consumption analysis function
CREATE OR REPLACE FUNCTION public.calculate_bom_variance(
  p_uiorn TEXT,
  p_process_stage TEXT
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
  bom_data RECORD;
  actual_consumption NUMERIC;
  planned_consumption NUMERIC;
  variance_percentage NUMERIC;
BEGIN
  -- Get actual consumption from material flow
  SELECT input_quantity INTO actual_consumption
  FROM material_flow_tracking
  WHERE uiorn = p_uiorn AND process_stage = p_process_stage::material_flow_stage
  LIMIT 1;
  
  -- Get planned consumption from BOM (using first available BOM record for now)
  SELECT quantity_required INTO planned_consumption
  FROM bill_of_materials
  LIMIT 1;
  
  -- Calculate variance
  IF planned_consumption > 0 AND actual_consumption IS NOT NULL THEN
    variance_percentage := ((actual_consumption - planned_consumption) / planned_consumption) * 100;
  ELSE
    variance_percentage := 0;
  END IF;
  
  result := jsonb_build_object(
    'planned_consumption', COALESCE(planned_consumption, 0),
    'actual_consumption', COALESCE(actual_consumption, 0),
    'variance_percentage', COALESCE(variance_percentage, 0),
    'status', CASE 
      WHEN ABS(COALESCE(variance_percentage, 0)) <= 5 THEN 'WITHIN_TOLERANCE'
      WHEN variance_percentage > 5 THEN 'OVER_CONSUMPTION'
      ELSE 'UNDER_CONSUMPTION'
    END
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create order progress tracking function
CREATE OR REPLACE FUNCTION public.get_order_material_progress(p_uiorn TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  total_processes INTEGER := 5;
  completed_processes INTEGER;
  current_stage TEXT;
  progress_percentage NUMERIC;
BEGIN
  -- Count completed material flow processes
  SELECT COUNT(*) INTO completed_processes
  FROM material_flow_tracking
  WHERE uiorn = p_uiorn AND output_good_quantity > 0;
  
  -- Get current stage
  SELECT process_stage::TEXT INTO current_stage
  FROM material_flow_tracking
  WHERE uiorn = p_uiorn
  ORDER BY recorded_at DESC
  LIMIT 1;
  
  -- Calculate progress
  progress_percentage := (completed_processes::NUMERIC / total_processes::NUMERIC) * 100;
  
  result := jsonb_build_object(
    'uiorn', p_uiorn,
    'completed_processes', completed_processes,
    'total_processes', total_processes,
    'current_stage', COALESCE(current_stage, 'NOT_STARTED'),
    'progress_percentage', ROUND(progress_percentage, 2),
    'status', CASE 
      WHEN completed_processes = 0 THEN 'NOT_STARTED'
      WHEN completed_processes = total_processes THEN 'COMPLETED'
      ELSE 'IN_PROGRESS'
    END
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT ON public.material_availability_view TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_bom_variance TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_material_progress TO authenticated;
