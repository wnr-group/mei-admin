-- Allow anonymous (storefront) reads on published products and active categories.
-- Existing admin policies are additive (OR); this does not weaken admin access.

CREATE POLICY "Public reads published products"
  ON public.products FOR SELECT
  USING (status = 'PUBLISHED' AND deleted_at IS NULL);

CREATE POLICY "Public reads active categories"
  ON public.categories FOR SELECT
  USING (deleted_at IS NULL);
