
-- Create customer-specifications storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('customer-specifications', 'customer-specifications', false);

-- Create customer specifications table
CREATE TABLE IF NOT EXISTS public.customer_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL,
  customer_code TEXT NOT NULL,
  specification_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING', 'APPROVED')),
  uploaded_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT unique_item_customer_spec UNIQUE(item_code, customer_code, specification_name)
);

-- Enable RLS on customer specifications
ALTER TABLE public.customer_specifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for customer specifications
CREATE POLICY "Approved users can manage customer specifications" ON public.customer_specifications
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    JOIN organizations o ON p.organization_id = o.id 
    WHERE p.id = auth.uid() AND p.is_approved = true 
    AND o.code IN ('DKEGL', 'SATGURU')
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_specifications_item_code ON public.customer_specifications(item_code);
CREATE INDEX IF NOT EXISTS idx_customer_specifications_customer ON public.customer_specifications(customer_code);
CREATE INDEX IF NOT EXISTS idx_customer_specifications_status ON public.customer_specifications(status);
CREATE INDEX IF NOT EXISTS idx_customer_specifications_upload_date ON public.customer_specifications(upload_date);

-- Create RLS policies for storage bucket
CREATE POLICY "Authenticated users can upload specifications" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'customer-specifications' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view specifications" ON storage.objects
FOR SELECT USING (
  bucket_id = 'customer-specifications' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update specifications" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'customer-specifications' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete specifications" ON storage.objects
FOR DELETE USING (
  bucket_id = 'customer-specifications' AND
  auth.role() = 'authenticated'
);

-- Add specification tracking columns to item_master
ALTER TABLE public.item_master 
ADD COLUMN IF NOT EXISTS specification_status TEXT DEFAULT 'NO_SPEC',
ADD COLUMN IF NOT EXISTS last_specification_update TIMESTAMP WITH TIME ZONE;

-- Create function to update item master when specifications change
CREATE OR REPLACE FUNCTION update_item_specification_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the item master specification status
  UPDATE public.item_master 
  SET 
    specification_status = CASE 
      WHEN NEW.status = 'ACTIVE' THEN 'HAS_SPEC'
      WHEN NEW.status = 'PENDING' THEN 'PENDING_SPEC'
      ELSE 'NO_SPEC'
    END,
    last_specification_update = NEW.updated_at
  WHERE item_code = NEW.item_code;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for specification status updates
DROP TRIGGER IF EXISTS trigger_update_item_specification_status ON public.customer_specifications;
CREATE TRIGGER trigger_update_item_specification_status
  AFTER INSERT OR UPDATE ON public.customer_specifications
  FOR EACH ROW EXECUTE FUNCTION update_item_specification_status();

-- Create view for specification summary
CREATE OR REPLACE VIEW public.item_specification_summary AS
SELECT 
  im.item_code,
  im.item_name,
  im.specification_status,
  im.last_specification_update,
  COUNT(cs.id) as total_specifications,
  COUNT(CASE WHEN cs.status = 'ACTIVE' THEN 1 END) as active_specifications,
  MAX(cs.upload_date) as latest_specification_date
FROM public.item_master im
LEFT JOIN public.customer_specifications cs ON im.item_code = cs.item_code
GROUP BY im.item_code, im.item_name, im.specification_status, im.last_specification_update
ORDER BY im.item_code;
