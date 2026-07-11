-- Also persist order_items.stitching_type from the payload. The column has
-- existed since 20260710041218 but create_order_txn never populated it, so
-- admin couldn't tell stitched vs unstitched line items. This re-creates the
-- function (identical to 20260711131000) with the stitching_type insert added.

CREATE OR REPLACE FUNCTION public.create_order_txn(
  p_customer         jsonb,
  p_items            jsonb,
  p_shipping_address jsonb,
  p_payment_id       text,
  p_payment_provider text    DEFAULT 'razorpay',
  p_payment_metadata jsonb   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id  uuid;
  v_order_id     uuid;
  v_order_number text;
  v_subtotal     numeric(12,2) := 0;
  v_shipping     numeric(12,2);
  v_total        numeric(12,2);
  v_item         jsonb;
  v_price        numeric(12,2);
  v_existing     record;
  v_order_item_id uuid;
  v_measurement  jsonb;
  v_value_in     numeric;
BEGIN
  SELECT id, order_number, total
  INTO v_existing
  FROM orders
  WHERE payment_id = p_payment_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'order_id',       v_existing.id,
      'order_number',   v_existing.order_number,
      'total',          v_existing.total,
      'already_exists', true
    );
  END IF;

  INSERT INTO customers (name, email, phone, city)
  VALUES (
    trim(p_customer->>'name'),
    lower(trim(p_customer->>'email')),
    nullif(trim(p_customer->>'phone'), ''),
    nullif(trim(p_customer->>'city'),  '')
  )
  ON CONFLICT (email) DO UPDATE
    SET name  = EXCLUDED.name,
        phone = COALESCE(EXCLUDED.phone, customers.phone),
        city  = COALESCE(EXCLUDED.city,  customers.city)
  RETURNING id INTO v_customer_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT price INTO v_price
    FROM products
    WHERE id = (v_item->>'product_id')::uuid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_NOT_FOUND:%', v_item->>'product_id';
    END IF;

    v_subtotal := v_subtotal + v_price * (v_item->>'quantity')::integer;
  END LOOP;

  v_shipping := CASE WHEN v_subtotal >= 5000 THEN 0 ELSE 150 END;
  v_total    := v_subtotal + v_shipping;

  INSERT INTO orders (
    customer_id, status, total,
    payment_id, payment_provider, payment_metadata, shipping_address
  )
  VALUES (
    v_customer_id,
    'PENDING',
    v_total,
    p_payment_id,
    p_payment_provider,
    p_payment_metadata,
    p_shipping_address
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT price INTO v_price
    FROM products
    WHERE id = (v_item->>'product_id')::uuid;

    INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, stitching_type, product_snapshot)
    VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      v_item->>'name',
      (v_item->>'quantity')::integer,
      v_price,
      CASE WHEN v_item->>'stitching_type' IN ('stitched', 'unstitched')
           THEN v_item->>'stitching_type' ELSE NULL END,
      jsonb_strip_nulls(jsonb_build_object(
        'color_id',    v_item->>'color_id',
        'color_label', v_item->>'color_label'
      ))
    )
    RETURNING id INTO v_order_item_id;

    IF v_item ? 'measurements' AND jsonb_typeof(v_item->'measurements') = 'array' THEN
      FOR v_measurement IN SELECT * FROM jsonb_array_elements(v_item->'measurements')
      LOOP
        CONTINUE WHEN (v_measurement->>'value_in') IS NULL
                   OR btrim(v_measurement->>'value_in') = '';

        v_value_in := (v_measurement->>'value_in')::numeric;
        CONTINUE WHEN v_value_in <= 0 OR v_value_in >= 200;

        INSERT INTO order_item_measurements (order_item_id, field_key, label, value_in)
        VALUES (
          v_order_item_id,
          (v_measurement->>'field_key')::measurement_field_key,
          nullif(btrim(coalesce(v_measurement->>'label', '')), ''),
          v_value_in
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'order_id',       v_order_id,
    'order_number',   v_order_number,
    'total',          v_total,
    'already_exists', false
  );
END;
$$;
