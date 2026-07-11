-- Storefront needs to read measurement templates + fields to show the right
-- measurement inputs when a customer picks "stitched". These rows carry no
-- sensitive data (field names/flags only), mirroring the public read on
-- product_categories. Admin write policies remain unchanged.
DO $$ BEGIN
  CREATE POLICY "Public reads measurement_templates"
    ON public.measurement_templates FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public reads measurement_template_fields"
    ON public.measurement_template_fields FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Data cleanup (app has no real users): remove orphaned override templates
-- left over from earlier testing — rows with a product_id but zero fields.
-- Genuine overrides always carry at least one field, so this only sweeps junk.
DELETE FROM public.measurement_templates t
WHERE t.product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.measurement_template_fields f
    WHERE f.template_id = t.id
  );
