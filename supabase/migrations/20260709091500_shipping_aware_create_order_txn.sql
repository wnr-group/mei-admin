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

    -- Reject non-positive quantity. Without this, a crafted negative
    -- quantity subtracts from v_subtotal (and a zero quantity contributes
    -- nothing while still occupying an order_items row) — either lets a
    -- client manipulate the charged total. This validates the pre-existing
    -- subtotal loop too, not just the new shipping logic below.
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

  -- Insert order items using DB prices (not client-supplied unit_price)
  INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
  SELECT
    v_order_id,
    (item->>'product_id')::uuid,
    item->>'name',
    (item->>'quantity')::integer,
    p.price
  FROM jsonb_array_elements(p_items) AS item
  JOIN products p ON p.id = (item->>'product_id')::uuid;

  RETURN jsonb_build_object(
    'order_id',       v_order_id,
    'order_number',   v_order_number,
    'total',          v_total,
    'already_exists', false
  );
END;
$$;

-- Security: this SECURITY DEFINER function was never explicitly REVOKEd from
-- PUBLIC in any prior migration (verified — no GRANT/REVOKE statement exists
-- anywhere in supabase/migrations/), and Postgres grants EXECUTE on a new
-- function to PUBLIC by default. PUBLIC privileges are inherited by every
-- role including `anon`, so the storefront's public anon key can very likely
-- call POST /rest/v1/rpc/create_order_txn directly today, completely
-- bypassing the Razorpay HMAC signature verification that only lives inside
-- the create-order Edge Function (supabase/functions/create-order/index.ts).
-- That Edge Function exclusively uses the service-role key to invoke this
-- RPC (verified in its source), so locking EXECUTE down to service_role only
-- changes nothing for the legitimate path.
REVOKE EXECUTE ON FUNCTION public.create_order_txn(jsonb, jsonb, jsonb, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_order_txn(jsonb, jsonb, jsonb, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_order_txn(jsonb, jsonb, jsonb, text, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_txn(jsonb, jsonb, jsonb, text, text, jsonb) TO service_role;
