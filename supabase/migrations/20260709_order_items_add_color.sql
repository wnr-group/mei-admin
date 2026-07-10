-- Update create_order_txn to persist color selection into product_snapshot JSONB.
-- No schema change required — product_snapshot already exists (migration 017).
-- color_id and color_label arrive in each p_items element as optional string fields.

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

  -- Upsert customer by email
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

  -- Server-side subtotal verification
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

  -- Shipping threshold — mirrors src/lib/config/shipping.ts exactly
  v_shipping := CASE WHEN v_subtotal >= 5000 THEN 0 ELSE 150 END;
  v_total    := v_subtotal + v_shipping;

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

  -- Insert order items; store color selection in product_snapshot JSONB
  INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, product_snapshot)
  SELECT
    v_order_id,
    (item->>'product_id')::uuid,
    item->>'name',
    (item->>'quantity')::integer,
    p.price,
    -- Preserve any color fields passed by the storefront; null fields are omitted via jsonb_strip_nulls
    jsonb_strip_nulls(jsonb_build_object(
      'color_id',    item->>'color_id',
      'color_label', item->>'color_label'
    ))
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
