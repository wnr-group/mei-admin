-- Reconciliation migration.
--
-- Two feature branches independently redefined create_order_txn:
--   * MEI-48 (20260709091500) added state-wise shipping (shipping_rates /
--     shipping_settings) plus an INVALID_QUANTITY guard, but used a set-based
--     order_items insert with no measurements/stitching.
--   * The stitched/unstitched + measurements work (20260711131000 /
--     20260711132000) switched to a per-item loop that persists stitching_type
--     and order_item_measurements, but reverted shipping to the old flat rule
--     (>= 5000 free, else 150).
--
-- Applied in timestamp order, 20260711132000 ran last and silently clobbered
-- MEI-48's state-wise shipping. This migration is the union of both: state-wise
-- shipping + INVALID_QUANTITY from MEI-48, and the per-item loop with
-- stitching_type + measurements from the later work.

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
  v_customer_id     uuid;
  v_order_id        uuid;
  v_order_number    text;
  v_subtotal        numeric(12,2) := 0;
  v_shipping        numeric(12,2);
  v_total           numeric(12,2);
  v_item            jsonb;
  v_price           numeric(12,2);
  v_existing        record;
  v_state           text;
  v_state_charge    numeric(12,2);
  v_free_enabled    boolean;
  v_free_threshold  numeric(12,2);
  v_order_item_id   uuid;
  v_measurement     jsonb;
  v_value_in        numeric;
BEGIN
  -- Idempotency: if this payment_id was already processed, return the existing order
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

  -- Upsert customer by email (customers.email is UNIQUE from migration 003)
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

  -- Server-side subtotal: fetch actual product prices from DB — never trust the client
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT price INTO v_price
    FROM products
    WHERE id = (v_item->>'product_id')::uuid;

    IF NOT FOUND THEN
      -- Colon separator so callers can parse the product_id from the message
      RAISE EXCEPTION 'PRODUCT_NOT_FOUND:%', v_item->>'product_id';
    END IF;

    -- Reject non-positive quantity. Without this, a crafted negative quantity
    -- subtracts from v_subtotal (and a zero quantity contributes nothing while
    -- still occupying an order_items row) — either lets a client manipulate the
    -- charged total.
    IF (v_item->>'quantity')::integer <= 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY:%', v_item->>'product_id';
    END IF;

    v_subtotal := v_subtotal + v_price * (v_item->>'quantity')::integer;
  END LOOP;

  -- State-wise shipping — never trust a client-sent shipping amount (there
  -- isn't one: the client only sends shipping_address, and this RPC is the
  -- only place a charge is derived). Errors rather than guessing a price for
  -- a state the admin hasn't configured yet.
  v_state := nullif(trim(p_shipping_address->>'state'), '');

  IF v_state IS NULL THEN
    RAISE EXCEPTION 'SHIPPING_STATE_MISSING';
  END IF;

  SELECT charge INTO v_state_charge
  FROM shipping_rates
  WHERE state = v_state;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHIPPING_STATE_NOT_CONFIGURED:%', v_state;
  END IF;

  SELECT free_shipping_enabled, free_shipping_threshold
  INTO v_free_enabled, v_free_threshold
  FROM shipping_settings
  WHERE id = 1;

  IF v_free_enabled AND v_free_threshold IS NOT NULL AND v_subtotal >= v_free_threshold THEN
    v_shipping := 0;
  ELSE
    v_shipping := v_state_charge;
  END IF;

  v_total := v_subtotal + v_shipping;

  -- Create order
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

  -- Insert order items one-by-one so each row's id can anchor its measurements.
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

    -- Measurements (optional). Skip blanks; sanity-check values.
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

-- Preserve the EXECUTE lockdown from 20260709091500: this SECURITY DEFINER
-- function must never be callable by anon/authenticated (that would bypass the
-- Razorpay HMAC check in the create-order Edge Function). CREATE OR REPLACE
-- keeps existing grants, but we re-assert them so the state is explicit.
REVOKE EXECUTE ON FUNCTION public.create_order_txn(jsonb, jsonb, jsonb, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_order_txn(jsonb, jsonb, jsonb, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_order_txn(jsonb, jsonb, jsonb, text, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_txn(jsonb, jsonb, jsonb, text, text, jsonb) TO service_role;
