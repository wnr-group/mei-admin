CREATE TABLE IF NOT EXISTS measurement_templates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  category_id        UUID REFERENCES categories(id),
  product_id         UUID REFERENCES products(id),
  customization_type customization_type,
  version            INTEGER NOT NULL DEFAULT 1,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_by         UUID REFERENCES auth.users(id),
  updated_by         UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS measurement_template_fields (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES measurement_templates(id),
  field_key   measurement_field_key NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  help_text   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, field_key)
);

ALTER TABLE measurement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_template_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "measurement_templates_admin_all" ON measurement_templates FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'));
CREATE POLICY "measurement_template_fields_admin_all" ON measurement_template_fields FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'));
