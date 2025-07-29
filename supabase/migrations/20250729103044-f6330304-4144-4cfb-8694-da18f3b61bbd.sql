-- Create purchase order audit log table
CREATE TABLE public.purchase_order_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL,
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.purchase_order_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy for audit log access
CREATE POLICY "Users can view PO audit logs for their organization" 
ON public.purchase_order_audit_log 
FOR SELECT 
USING (
  purchase_order_id IN (
    SELECT id FROM public.purchase_orders 
    WHERE organization_id = (
      SELECT organization_id FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
);

-- Create audit logging function
CREATE OR REPLACE FUNCTION public.log_purchase_order_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.purchase_order_audit_log (
      purchase_order_id, action, new_value, changed_by
    ) VALUES (
      NEW.id, 'CREATED', to_jsonb(NEW), auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log specific field changes
    IF OLD.status != NEW.status THEN
      INSERT INTO public.purchase_order_audit_log (
        purchase_order_id, action, field_changed, old_value, new_value, changed_by
      ) VALUES (
        NEW.id, 'STATUS_CHANGED', 'status', 
        to_jsonb(OLD.status), to_jsonb(NEW.status), auth.uid()
      );
    END IF;
    
    IF OLD.approval_status != NEW.approval_status THEN
      INSERT INTO public.purchase_order_audit_log (
        purchase_order_id, action, field_changed, old_value, new_value, changed_by
      ) VALUES (
        NEW.id, 'APPROVAL_STATUS_CHANGED', 'approval_status',
        to_jsonb(OLD.approval_status), to_jsonb(NEW.approval_status), auth.uid()
      );
    END IF;
    
    IF OLD.total_amount != NEW.total_amount THEN
      INSERT INTO public.purchase_order_audit_log (
        purchase_order_id, action, field_changed, old_value, new_value, changed_by
      ) VALUES (
        NEW.id, 'AMOUNT_CHANGED', 'total_amount',
        to_jsonb(OLD.total_amount), to_jsonb(NEW.total_amount), auth.uid()
      );
    END IF;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.purchase_order_audit_log (
      purchase_order_id, action, old_value, changed_by
    ) VALUES (
      OLD.id, 'DELETED', to_jsonb(OLD), auth.uid()
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for purchase orders
CREATE TRIGGER purchase_order_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_purchase_order_audit();

-- Add last_modified tracking to purchase_orders
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create function to update last_modified fields
CREATE OR REPLACE FUNCTION public.update_po_last_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified_by = auth.uid();
  NEW.last_modified_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for last_modified updates
CREATE TRIGGER update_purchase_order_last_modified
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_po_last_modified();