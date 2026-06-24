INSERT INTO product_variants (
  product_id, customization_type, size_label, sku,
  price_override, stock_quantity, track_inventory, is_available
)
SELECT
  p.id,
  'STANDARD_SIZE',
  'Standard',
  generate_variant_sku(p.product_code, NULL, 'STD', 'STANDARD_SIZE'),
  NULL,
  0,
  false,
  true
FROM products p WHERE p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM product_variants pv
    WHERE pv.product_id = p.id
      AND pv.color_id IS NULL
      AND pv.size_entry_id IS NULL
      AND pv.customization_type = 'STANDARD_SIZE'
      AND pv.deleted_at IS NULL
  );

UPDATE products SET has_variants = true
WHERE deleted_at IS NULL
  AND id IN (SELECT DISTINCT product_id FROM product_variants WHERE deleted_at IS NULL);
