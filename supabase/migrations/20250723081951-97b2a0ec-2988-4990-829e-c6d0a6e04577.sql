
-- Create vendor price lists table
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
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(supplier_id, item_code, effective_from)
);

-- Create reorder rules table
CREATE TABLE IF NOT EXISTS public.reorder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id),
  minimum_stock_level NUMERIC(10,2) NOT NULL,
  reorder_quantity NUMERIC(10,2) NOT NULL,
  safety_stock_level NUMERIC(10,2) DEFAULT 0,
  consumption_rate_per_day NUMERIC(10,2) DEFAULT 0,
  lead_time_days INTEGER DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(item_code, supplier_id)
);

-- Create procurement CSV upload logs table
CREATE TABLE IF NOT EXISTS public.procurement_csv_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_type TEXT NOT NULL, -- 'purchase_order', 'supplier', 'reorder_rules', 'vendor_prices'
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  total_rows INTEGER DEFAULT 0,
  successful_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  error_details JSONB,
  batch_id UUID,
  status TEXT DEFAULT 'processing' -- 'processing', 'completed', 'failed'
);

-- Add RLS policies
ALTER TABLE public.vendor_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reorder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_csv_uploads ENABLE ROW LEVEL SECURITY;

-- RLS policies for vendor price lists
CREATE POLICY "Approved users can manage vendor price lists" ON public.vendor_price_lists
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      JOIN organizations o ON p.organization_id = o.id 
      WHERE p.id = auth.uid() AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

-- RLS policies for reorder rules  
CREATE POLICY "Approved users can manage reorder rules" ON public.reorder_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      JOIN organizations o ON p.organization_id = o.id 
      WHERE p.id = auth.uid() AND p.is_approved = true 
      AND o.code IN ('DKEGL', 'SATGURU')
    )
  );

-- RLS policies for procurement CSV uploads
CREATE POLICY "Users can manage their own procurement uploads" ON public.procurement_csv_uploads
  FOR ALL USING (uploaded_by = auth.uid());
