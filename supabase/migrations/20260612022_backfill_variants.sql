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
ON CONFLICT (product_id, COALESCE(color_id::text, 'NO_COLOR'), COALESCE(size_entry_id::text, 'NO_SIZE'), customization_type) DO NOTHING;

UPDATE products SET has_variants = true
WHERE deleted_at IS NULL
  AND id IN (SELECT DISTINCT product_id FROM product_variants WHERE deleted_at IS NULL);
