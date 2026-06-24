-- Add occasion and budget fields captured by storefront contact form.
-- Both nullable so existing enquiries remain valid.
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS occasion TEXT,
  ADD COLUMN IF NOT EXISTS budget   TEXT
