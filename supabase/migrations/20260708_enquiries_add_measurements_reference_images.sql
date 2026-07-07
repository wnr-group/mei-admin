-- Add measurements and reference_images captured by the storefront contact form.
-- measurements: JSON object of body measurements (bust, waist, hip, shoulder, length, sleeve).
-- reference_images: array of public Supabase Storage URLs for uploaded reference images.
-- Both nullable so existing enquiries remain valid.
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS measurements     JSONB,
  ADD COLUMN IF NOT EXISTS reference_images JSONB
