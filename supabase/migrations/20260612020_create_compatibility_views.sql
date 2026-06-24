CREATE OR REPLACE VIEW v_products_storefront AS
SELECT
  p.*,
  COALESCE(
    (SELECT pm.url FROM product_media pm
     WHERE pm.product_id = p.id AND pm.is_primary = true
       AND pm.color_id IS NULL AND pm.deleted_at IS NULL
   ORDER BY pm.created_at DESC LIMIT 1),
    p.image_url
  ) AS primary_image_url,
  COALESCE(
    (SELECT MIN(COALESCE(pv.price_override, p.price))
     FROM product_variants pv
     WHERE pv.product_id = p.id AND pv.deleted_at IS NULL AND pv.is_available = true),
    p.price
  ) AS effective_min_price
FROM products p WHERE p.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_product_colors_storefront AS
SELECT
  pc.*,
  (SELECT pm.url FROM product_media pm
   WHERE pm.product_id = pc.product_id AND pm.color_id = pc.id
     AND pm.is_primary = true AND pm.deleted_at IS NULL
   ORDER BY pm.created_at DESC LIMIT 1) AS primary_image_url
FROM product_colors pc WHERE pc.deleted_at IS NULL;
