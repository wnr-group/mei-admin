-- One-off backfill: copy existing price into price_stitched for products
-- that pre-date the stitched/unstitched pricing feature.
-- Only touches rows where both stitching prices are still NULL.
UPDATE public.products
SET price_stitched = price
WHERE price_stitched IS NULL
  AND price_unstitched IS NULL;
