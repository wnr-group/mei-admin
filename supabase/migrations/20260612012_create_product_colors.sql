CREATE TABLE product_colors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id),
  label            TEXT NOT NULL,
  hex_code         TEXT,
  swatch_image_url TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

ALTER TABLE product_colors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_colors_anon_select" ON product_colors FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "product_colors_admin_all" ON product_colors FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'));
