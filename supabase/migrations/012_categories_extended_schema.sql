-- Add missing columns to categories table
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS subtitle  TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Slug uniqueness: database-level constraint prevents race conditions
-- Partial index allows reuse of slugs from soft-deleted categories
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_active_unique
  ON public.categories(slug)
  WHERE deleted_at IS NULL;

-- Create category-images storage bucket
-- Public = true because storefront displays category images to end users
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-images', 'category-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for category-images (safe to run multiple times via DO blocks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Admins can upload category images'
  ) THEN
    CREATE POLICY "Admins can upload category images"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'category-images' AND public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Admins can update category images'
  ) THEN
    CREATE POLICY "Admins can update category images"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'category-images' AND public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Admins can delete category images'
  ) THEN
    CREATE POLICY "Admins can delete category images"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'category-images' AND public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Public can read category images'
  ) THEN
    CREATE POLICY "Public can read category images"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'category-images');
  END IF;
END $$;
