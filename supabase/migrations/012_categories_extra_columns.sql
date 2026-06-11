-- Add subtitle, image_url, is_active, and updated_at columns to categories table.
-- subtitle: short display text shown on storefront category cards
-- image_url: Supabase Storage URL for the category thumbnail
-- is_active: controls visibility on storefront (replaces the 'ACTIVE/INACTIVE' status enum used in mockDb)
-- updated_at: tracks last modification timestamp

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS subtitle TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Trigger to auto-update updated_at on every row update
CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
