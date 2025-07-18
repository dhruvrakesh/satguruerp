
-- Add unique constraint on item_name in satguru_item_master
ALTER TABLE public.satguru_item_master 
ADD CONSTRAINT satguru_item_master_item_name_key UNIQUE (item_name);

-- Create composite unique constraint for better data integrity
ALTER TABLE public.satguru_item_master 
ADD CONSTRAINT satguru_item_master_name_code_unique 
UNIQUE (item_name, item_code);

-- Add foreign key relationship between satguru_item_master and categories
ALTER TABLE public.satguru_item_master 
ADD CONSTRAINT fk_satguru_item_master_category 
FOREIGN KEY (category_id) REFERENCES public.categories(id);
