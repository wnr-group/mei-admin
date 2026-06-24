ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_code                  TEXT,
  ADD COLUMN IF NOT EXISTS has_variants                  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS size_system_id                UUID REFERENCES size_systems(id),
  ADD COLUMN IF NOT EXISTS supported_customization_types customization_type[] NOT NULL DEFAULT '{}';

UPDATE products SET product_code = 'MEI-' || UPPER(LEFT(REGEXP_REPLACE(name, '\s+', '', 'g'), 6))
  || '-' || UPPER(SUBSTRING(id::TEXT, 1, 4))
  WHERE product_code IS NULL;

DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_product_code_key UNIQUE (product_code);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE products ALTER COLUMN product_code SET NOT NULL;

CREATE TABLE IF NOT EXISTS product_variants (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         UUID NOT NULL REFERENCES products(id),
  color_id           UUID REFERENCES product_colors(id),
  size_entry_id      UUID REFERENCES size_system_entries(id),
  size_label         TEXT,
  customization_type customization_type NOT NULL,
  sku                TEXT UNIQUE,
  price_override     NUMERIC(12,2),
  stock_quantity     INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  track_inventory    BOOLEAN NOT NULL DEFAULT false,
  allow_backorder    BOOLEAN NOT NULL DEFAULT true,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  is_available       BOOLEAN NOT NULL DEFAULT true,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_by         UUID REFERENCES auth.users(id),
  updated_by         UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

DO $$ BEGIN
  CREATE TRIGGER set_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pv_unique_combination
  ON product_variants (
    product_id,
    COALESCE(color_id::TEXT, 'NO_COLOR'),
    COALESCE(size_entry_id::TEXT, 'NO_SIZE'),
    customization_type
  )
  WHERE deleted_at IS NULL;

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "product_variants_anon_select" ON product_variants FOR SELECT USING (deleted_at IS NULL AND is_available = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "product_variants_admin_all" ON product_variants FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated' AND EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
