
-- Add new manufacturing stage enum values to process_status
ALTER TYPE process_status ADD VALUE IF NOT EXISTS 'ARTWORK_UPLOAD';
ALTER TYPE process_status ADD VALUE IF NOT EXISTS 'GRAVURE_PRINTING';
ALTER TYPE process_status ADD VALUE IF NOT EXISTS 'LAMINATION_COATING';
ALTER TYPE process_status ADD VALUE IF NOT EXISTS 'ADHESIVE_COATING';
ALTER TYPE process_status ADD VALUE IF NOT EXISTS 'SLITTING_PACKING';

-- Create function to handle stage transitions and update SE tables
CREATE OR REPLACE FUNCTION public.handle_manufacturing_stage_transition(
  p_uiorn TEXT,
  p_new_status process_status,
  p_user_id UUID DEFAULT auth.uid()
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_current_status process_status;
BEGIN
  -- Get current order status and ID
  SELECT id, status INTO v_order_id, v_current_status 
  FROM order_punching 
  WHERE uiorn = p_uiorn;
  
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_uiorn;
  END IF;
  
  -- Update order status
  UPDATE order_punching 
  SET status = p_new_status, updated_at = now()
  WHERE uiorn = p_uiorn;
  
  -- Create records in appropriate SE manufacturing tables based on new status
  CASE p_new_status
    WHEN 'GRAVURE_PRINTING' THEN
      -- Create gravure_printing record if it doesn't exist
      INSERT INTO gravure_printing (uiorn, status, created_at)
      VALUES (p_uiorn, 'PENDING', now())
      ON CONFLICT (uiorn) DO NOTHING;
      
    WHEN 'LAMINATION_COATING' THEN
      -- Mark gravure as completed and create lamination record
      UPDATE gravure_printing 
      SET status = 'COMPLETED', completed_at = now()
      WHERE uiorn = p_uiorn;
      
      INSERT INTO lamination (uiorn, status, created_at)
      VALUES (p_uiorn, 'PENDING', now())
      ON CONFLICT (uiorn) DO NOTHING;
      
      -- Update orders_dashboard_se timestamp
      UPDATE orders_dashboard_se 
      SET printing_done_at = now(), updated_at = now()
      WHERE uiorn = p_uiorn;
      
    WHEN 'ADHESIVE_COATING' THEN
      -- Mark lamination as completed and create adhesive coating record
      UPDATE lamination 
      SET status = 'COMPLETED', completed_at = now()
      WHERE uiorn = p_uiorn;
      
      INSERT INTO adhesive_coating (uiorn, status, created_at)
      VALUES (p_uiorn, 'PENDING', now())
      ON CONFLICT (uiorn) DO NOTHING;
      
      -- Update orders_dashboard_se timestamp
      UPDATE orders_dashboard_se 
      SET lamination_done_at = now(), updated_at = now()
      WHERE uiorn = p_uiorn;
      
    WHEN 'SLITTING_PACKING' THEN
      -- Mark adhesive coating as completed and create slitting record
      UPDATE adhesive_coating 
      SET status = 'COMPLETED', completed_at = now()
      WHERE uiorn = p_uiorn;
      
      INSERT INTO slitting (uiorn, status, created_at)
      VALUES (p_uiorn, 'PENDING', now())
      ON CONFLICT (uiorn) DO NOTHING;
      
      -- Update orders_dashboard_se timestamp
      UPDATE orders_dashboard_se 
      SET adhesive_coating_done_at = now(), updated_at = now()
      WHERE uiorn = p_uiorn;
      
    WHEN 'COMPLETED' THEN
      -- Mark slitting as completed
      UPDATE slitting 
      SET status = 'COMPLETED', completed_at = now()
      WHERE uiorn = p_uiorn;
      
      -- Update orders_dashboard_se final timestamps
      UPDATE orders_dashboard_se 
      SET slitting_done_at = now(), dispatch_done_at = now(), updated_at = now()
      WHERE uiorn = p_uiorn;
      
    ELSE
      -- For other statuses, just update the order
      NULL;
  END CASE;
  
  -- Log the stage transition in process_logs_se
  INSERT INTO process_logs_se (uiorn, stage, metric, txt_value, captured_by, captured_at)
  VALUES (
    p_uiorn, 
    p_new_status::TEXT::process_stage, 
    'stage_transition',
    'Status changed from ' || v_current_status::TEXT || ' to ' || p_new_status::TEXT,
    p_user_id,
    now()
  );
  
END;
$$;

-- Create function to get next valid stage for an order
CREATE OR REPLACE FUNCTION public.get_next_manufacturing_stage(
  p_current_status process_status
) RETURNS process_status
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE p_current_status
    WHEN 'PENDING' THEN 'ARTWORK_UPLOAD'::process_status
    WHEN 'ARTWORK_UPLOAD' THEN 'GRAVURE_PRINTING'::process_status
    WHEN 'GRAVURE_PRINTING' THEN 'LAMINATION_COATING'::process_status
    WHEN 'LAMINATION_COATING' THEN 'ADHESIVE_COATING'::process_status
    WHEN 'ADHESIVE_COATING' THEN 'SLITTING_PACKING'::process_status
    WHEN 'SLITTING_PACKING' THEN 'COMPLETED'::process_status
    ELSE NULL
  END;
END;
$$;

-- Create function to validate stage transition
CREATE OR REPLACE FUNCTION public.can_transition_to_stage(
  p_uiorn TEXT,
  p_target_status process_status
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_status process_status;
  v_next_stage process_status;
BEGIN
  SELECT status INTO v_current_status 
  FROM order_punching 
  WHERE uiorn = p_uiorn;
  
  IF v_current_status IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Can't move backwards or to same stage
  IF p_target_status = v_current_status THEN
    RETURN FALSE;
  END IF;
  
  -- Get next valid stage
  v_next_stage := get_next_manufacturing_stage(v_current_status);
  
  RETURN v_next_stage = p_target_status;
END;
$$;
