
-- Create function to handle bulk cylinder upload from CSV
CREATE OR REPLACE FUNCTION upsert_satguru_cylinders_from_csv(csv_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec jsonb;
  ok_rows INT := 0;
  bad_rows jsonb[] := '{}';
  row_idx INT := 0;
  generated_code TEXT;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(csv_data) LOOP
    row_idx := row_idx + 1;
    BEGIN
      -- Generate cylinder code if not provided
      IF rec->>'cylinder_code' IS NULL OR TRIM(rec->>'cylinder_code') = '' THEN
        generated_code := (rec->>'item_code') || '-' || 
                         UPPER(rec->>'colour') || '-' || 
                         EXTRACT(YEAR FROM NOW())::text || '-' ||
                         LPAD(row_idx::text, 3, '0');
      ELSE
        generated_code := rec->>'cylinder_code';
      END IF;

      -- Insert or update cylinder
      INSERT INTO public.satguru_cylinders (
        cylinder_code,
        cylinder_name,
        item_code,
        colour,
        cylinder_size,
        type,
        manufacturer,
        location,
        mileage_m,
        last_run,
        remarks
      ) VALUES (
        generated_code,
        rec->>'cylinder_name',
        rec->>'item_code',
        rec->>'colour',
        COALESCE((rec->>'cylinder_size')::numeric, 0),
        COALESCE(rec->>'type', 'GRAVURE'),
        rec->>'manufacturer',
        rec->>'location',
        COALESCE((rec->>'mileage_m')::numeric, 0),
        rec->>'last_run',
        rec->>'remarks'
      ) ON CONFLICT (cylinder_code) DO UPDATE SET
        cylinder_name = EXCLUDED.cylinder_name,
        item_code = EXCLUDED.item_code,
        colour = EXCLUDED.colour,
        cylinder_size = EXCLUDED.cylinder_size,
        type = EXCLUDED.type,
        manufacturer = EXCLUDED.manufacturer,
        location = EXCLUDED.location,
        mileage_m = EXCLUDED.mileage_m,
        last_run = EXCLUDED.last_run,
        remarks = EXCLUDED.remarks,
        updated_at = now();

      ok_rows := ok_rows + 1;

    EXCEPTION WHEN OTHERS THEN
      bad_rows := array_append(
        bad_rows,
        jsonb_build_object(
          'rowNumber', row_idx,
          'data', rec,
          'error', SQLERRM,
          'category', 'processing_error'
        )
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'successCount', ok_rows,
    'errorCount', coalesce(array_length(bad_rows, 1), 0),
    'errors', to_jsonb(bad_rows)
  );
END;
$$;

-- Create cylinder usage tracking function
CREATE OR REPLACE FUNCTION update_cylinder_usage(
  p_cylinder_code text,
  p_mileage_increment numeric,
  p_last_run text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.satguru_cylinders
  SET 
    mileage_m = mileage_m + p_mileage_increment,
    last_run = COALESCE(p_last_run, last_run),
    updated_at = now()
  WHERE cylinder_code = p_cylinder_code;
END;
$$;
