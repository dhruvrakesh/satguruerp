
-- Create the procurement_csv_uploads table for upload tracking
CREATE TABLE IF NOT EXISTS public.procurement_csv_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_type TEXT NOT NULL, -- 'purchase_order', 'supplier', 'reorder_rules', 'vendor_prices', 'item_pricing'
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  total_rows INTEGER DEFAULT 0,
  successful_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  error_details JSONB,
  batch_id UUID,
  status TEXT DEFAULT 'processing', -- 'processing', 'completed', 'failed'
  processing_time_ms INTEGER,
  file_size_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create the vendor_price_lists table for vendor pricing management
CREATE TABLE IF NOT EXISTS public.vendor_price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  item_code TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  minimum_order_quantity NUMERIC(10,2) DEFAULT 1,
  lead_time_days INTEGER DEFAULT 7,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  payment_terms TEXT,
  validity_days INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(supplier_id, item_code, effective_from)
);

-- Add RLS policies for procurement_csv_uploads
ALTER TABLE public.procurement_csv_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own procurement uploads" ON public.procurement_csv_uploads
  FOR ALL USING (uploaded_by = auth.uid());

-- Add RLS policies for vendor_price_lists
ALTER TABLE public.vendor_price_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can manage vendor price lists" ON public.vendor_price_lists
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      JOIN organizations o ON p.organization_id = o.id 
      WHERE p.id = auth.uid() AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_procurement_csv_uploads_user_type ON public.procurement_csv_uploads(uploaded_by, upload_type);
CREATE INDEX IF NOT EXISTS idx_procurement_csv_uploads_date ON public.procurement_csv_uploads(upload_date);
CREATE INDEX IF NOT EXISTS idx_vendor_price_lists_supplier_item ON public.vendor_price_lists(supplier_id, item_code);
CREATE INDEX IF NOT EXISTS idx_vendor_price_lists_active ON public.vendor_price_lists(is_active, effective_from, effective_to);

-- Add updated_at trigger for vendor_price_lists
CREATE OR REPLACE FUNCTION update_vendor_price_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER update_vendor_price_lists_updated_at
  BEFORE UPDATE ON public.vendor_price_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_price_lists_updated_at();
