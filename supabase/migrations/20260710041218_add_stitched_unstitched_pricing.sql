-- Add stitched/unstitched pricing columns to products
ALTER TABLE public.products
  ADD COLUMN price_unstitched NUMERIC(12,2) CHECK (price_unstitched >= 0),
  ADD COLUMN price_stitched   NUMERIC(12,2) CHECK (price_stitched >= 0);

-- Add stitching_type to order_items to record customer's selection at purchase time
ALTER TABLE public.order_items
  ADD COLUMN stitching_type TEXT CHECK (stitching_type IN ('stitched', 'unstitched'));