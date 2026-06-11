-- Add slug and short_description columns to products table
-- slug: URL-friendly identifier (nullable to allow existing rows without one)
-- short_description: brief product summary shown in listings
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT;

-- Partial unique index: only enforce uniqueness among non-null slugs
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug
  ON public.products(slug)
  WHERE slug IS NOT NULL AND deleted_at IS NULL;
