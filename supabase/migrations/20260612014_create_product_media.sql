CREATE TABLE product_media (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES products(id),
  color_id       UUID REFERENCES product_colors(id),
  variant_id     UUID REFERENCES product_variants(id),
  url            TEXT NOT NULL,
  alt_text       TEXT,
  is_primary     BOOLEAN NOT NULL DEFAULT false,
  media_type     media_type NOT NULL DEFAULT 'IMAGE',
  thumbnail_url  TEXT,
  video_provider TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_pm_primary_product
  ON product_media (product_id)
  WHERE is_primary = true AND color_id IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX idx_pm_primary_color
  ON product_media (product_id, color_id)
  WHERE is_primary = true AND color_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_media_anon_select" ON product_media FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "product_media_admin_all" ON product_media FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'));
