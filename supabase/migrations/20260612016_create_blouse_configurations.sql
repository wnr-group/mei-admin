CREATE TABLE blouse_configurations (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id                     UUID NOT NULL REFERENCES products(id),
  customization_type             customization_type,
  includes_blouse                BOOLEAN NOT NULL DEFAULT true,
  stitching_options              TEXT[] NOT NULL DEFAULT '{"STITCHED","UNSTITCHED"}',
  blouse_measurement_template_id UUID REFERENCES measurement_templates(id),
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_bc_unique_combination
  ON blouse_configurations (
    product_id,
    COALESCE(customization_type::TEXT, 'ALL_TYPES')
  );

ALTER TABLE blouse_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blouse_configurations_admin_all" ON blouse_configurations FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'));
