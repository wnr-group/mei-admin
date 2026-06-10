-- Add rich product fields missing from initial schema
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug               TEXT,
  ADD COLUMN IF NOT EXISTS short_description  TEXT,
  ADD COLUMN IF NOT EXISTS compare_at_price   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS featured           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS new_arrival        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta_title         TEXT,
  ADD COLUMN IF NOT EXISTS meta_description   TEXT,
  ADD COLUMN IF NOT EXISTS meta_keywords      TEXT,
  ADD COLUMN IF NOT EXISTS color_variants     JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS available_sizes    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS custom_size_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blouse_options_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blouse_types       TEXT[] NOT NULL DEFAULT '{}';

-- Backfill slug from name for any existing rows
UPDATE public.products
SET slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- Now enforce NOT NULL + UNIQUE
ALTER TABLE public.products
  ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.products
  ADD CONSTRAINT products_slug_unique UNIQUE (slug);

-- Index for slug lookups (used by storefront)
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug) WHERE deleted_at IS NULL;
