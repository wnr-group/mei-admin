-- Add soft-delete column to banners (services/banners.ts already references it)
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
