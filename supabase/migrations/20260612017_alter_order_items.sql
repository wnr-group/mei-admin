ALTER TABLE order_items
  ADD COLUMN variant_id       UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  ADD COLUMN product_snapshot JSONB,
  ADD COLUMN variant_snapshot JSONB;

CREATE TABLE order_item_measurements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  field_key     measurement_field_key NOT NULL,
  value_cm      NUMERIC(6,1) NOT NULL CHECK (value_cm > 0),
  notes         TEXT,
  recorded_by   UUID REFERENCES auth.users(id),
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_item_id, field_key)
);

ALTER TABLE order_item_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_item_measurements_admin_all" ON order_item_measurements FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'));
