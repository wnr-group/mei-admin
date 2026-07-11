-- Capture customer-entered measurements on stitched orders.
-- (1) Store inches, not centimetres — Indian bridal tailoring works in inches,
--     and the storefront collects inches. Table has no data yet (no orders use
--     it), so a straight rename is safe.
-- (2) Support custom-named fields (field_key='custom' + free-text label),
--     mirroring measurement_template_fields. Multiple custom fields per item
--     must be allowed, so the single unique constraint is replaced with two
--     partial indexes.

ALTER TABLE public.order_item_measurements
  DROP CONSTRAINT IF EXISTS order_item_measurements_value_cm_check;

ALTER TABLE public.order_item_measurements
  RENAME COLUMN value_cm TO value_in;

ALTER TABLE public.order_item_measurements
  ADD CONSTRAINT order_item_measurements_value_in_check
  CHECK (value_in > 0 AND value_in < 200);

ALTER TABLE public.order_item_measurements
  ADD COLUMN IF NOT EXISTS label TEXT;

ALTER TABLE public.order_item_measurements
  DROP CONSTRAINT IF EXISTS order_item_measurements_order_item_id_field_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_oim_item_fixed_key
  ON public.order_item_measurements (order_item_id, field_key)
  WHERE field_key <> 'custom';

CREATE UNIQUE INDEX IF NOT EXISTS uq_oim_item_custom_label
  ON public.order_item_measurements (order_item_id, label)
  WHERE field_key = 'custom';
