# State-Wise Shipping Charges (Admin & Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin configure a shipping charge per Indian state and a global free-shipping threshold in Settings, and make `create_order_txn` derive the shipping charge for a paid order entirely server-side from that configuration — never from a client-sent value.

**Architecture:** Two new tables (`shipping_rates` — one row per state; `shipping_settings` — a singleton row for the global free-shipping rule) replace the hardcoded `₹150 flat / ₹5000 threshold` that currently lives inside `create_order_txn`. The admin UI follows the existing `settings/page.tsx` dirty-tracking editable-table pattern, now split across a `General` / `Shipping` tab pair under `/settings`. The `create-order` Edge Function is unchanged except for one new error branch — all shipping math still happens inside `create_order_txn`, which the Edge Function already calls via `service-role` RPC (bypassing RLS), so this plan does not need to touch how the storefront invokes order creation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict), Supabase (Postgres + RLS), TanStack Query, Vitest (integration tests hit the real hosted Supabase project per `CLAUDE.md`).

## Global Constraints

- Server must validate the shipping charge — a client-sent shipping amount must never be trusted or accepted (there already is no client-sent shipping value on the order-creation path; this plan preserves that by keeping `create_order_txn` the sole source of the charge).
- Free-shipping threshold is a single **global** rule applied across all states, not a per-state value.
- Admin-only RLS policy for writes on both new tables; public (anon) read for storefront fetch.
- At least these states must be pre-seeded with a charge: Tamil Nadu, Maharashtra, Karnataka, Delhi, Telangana, Kerala, Andhra Pradesh.
- This plan lives in the `mei-admin` repo. All commands below assume `cwd` = `C:\Users\Eshwar\WNR\mei-admin`.
- `.env.local` in this repo points at the hosted Supabase project (per `CLAUDE.md`) — `npx supabase db push` and the integration tests in `tests/database/` run against that same hosted project the storefront (`../mei`) reads from.

### Finalized decisions (production-readiness audit — 2026-07-09)

These are settled, not deferred. They exist so no implementer has to re-litigate them mid-task:

- **Concurrency / locking:** `upsertShippingRate` uses a single atomic `INSERT ... ON CONFLICT (state) DO UPDATE` — there is no read-modify-write window, so no optimistic/pessimistic locking is added. Two admins editing the *same* state's charge within the same few seconds is a last-write-wins race; this is acceptable for a 2-3-person internal admin tool editing a low-stakes config value, and is explicitly not fixed with version columns or locking — that complexity is disproportionate here.
- **RPC privilege boundary:** `create_order_txn` is `SECURITY DEFINER` and was never `REVOKE`d from `PUBLIC` in any prior migration (verified: zero `GRANT`/`REVOKE` statements exist anywhere in `supabase/migrations/`). By default Postgres grants `EXECUTE` on a new function to `PUBLIC`, which the `anon` role inherits — meaning the storefront's public anon key can very likely call `/rest/v1/rpc/create_order_txn` directly via PostgREST today, completely bypassing the Razorpay HMAC signature check that only lives inside the `create-order` Edge Function. Task 2 below locks this down (`REVOKE ... FROM PUBLIC, anon, authenticated; GRANT ... TO service_role`), since the Edge Function already exclusively uses the service-role key (verified) and loses no functionality.
- **Audit logging:** this codebase's existing convention for admin-mutated config (`services/settings.ts`) is to call `logAuditEvent()` on every write. Task 5 below extends `lib/audit.ts`'s `ResourceType` union and wires both `upsertShippingRate` and `updateShippingSettings` into it, so every shipping-config change is traceable via the existing `/audit` page — no new logging infrastructure is introduced.
- **Rollback strategy:** this repo has no down-migrations anywhere (all 30+ existing migration files are forward-only) — that is the established convention, not a gap this plan introduces. Each schema-changing task below instead documents the exact manual SQL to reverse it, inline, so a rollback decision never has to be improvised under pressure.

---

### Task 1: `shipping_rates` + `shipping_settings` schema, RLS, and seed data

**Files:**
- Create: `supabase/migrations/20260709090000_shipping_config_schema.sql`
- Modify: `tests/database/schema-verification.test.ts`

**Interfaces:**
- Produces: tables `public.shipping_rates (id, state, charge, updated_at)` and `public.shipping_settings (id, free_shipping_enabled, free_shipping_threshold, updated_at)`. `shipping_rates` is admin-`FOR ALL` / public-`SELECT`; `shipping_settings` is admin-`UPDATE`-only (no admin insert/delete — see rationale inline) / public-`SELECT`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260709090000_shipping_config_schema.sql`:

```sql
-- shipping_rates: admin-configurable per-state shipping charge
CREATE TABLE public.shipping_rates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state      TEXT NOT NULL UNIQUE,
  -- Upper bound is a sanity guard against fat-finger admin input (e.g. an
  -- extra zero), not a business rule — ₹100,000 is far above any realistic
  -- domestic shipping charge for this store.
  charge     NUMERIC(12,2) NOT NULL CHECK (charge >= 0 AND charge <= 100000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER shipping_rates_set_updated_at
  BEFORE UPDATE ON public.shipping_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- shipping_settings: singleton row for the global free-shipping rule.
-- A single-row table (id fixed to 1 via CHECK) rather than a column repeated on
-- every shipping_rates row — the rule is explicitly global per the spec, and
-- duplicating it per-state would need every row updated in lockstep whenever
-- the threshold changes.
CREATE TABLE public.shipping_settings (
  id                       INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  free_shipping_enabled    BOOLEAN NOT NULL DEFAULT false,
  -- NULL is a valid, intentional state: "enabled but no threshold set yet"
  -- must never accidentally make every order free, so the RPC treats
  -- NULL threshold as "rule does not apply" (see Task 2).
  free_shipping_threshold  NUMERIC(12,2) CHECK (free_shipping_threshold IS NULL OR free_shipping_threshold >= 0),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER shipping_settings_set_updated_at
  BEFORE UPDATE ON public.shipping_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed: pre-configured states from the spec's acceptance criteria (charges are
-- illustrative starting values — admin can edit them from Settings > Shipping).
INSERT INTO public.shipping_rates (state, charge) VALUES
  ('Tamil Nadu',      300),
  ('Maharashtra',     600),
  ('Karnataka',       350),
  ('Delhi',           250),
  ('Telangana',       350),
  ('Kerala',          400),
  ('Andhra Pradesh',  350)
ON CONFLICT (state) DO NOTHING;

-- Seed: preserve the flat ₹5000 free-shipping threshold that was previously
-- hardcoded in the storefront's src/lib/config/shipping.ts and in
-- create_order_txn, so existing behaviour doesn't regress the moment this
-- migration lands (Task 2 removes the hardcoded version from the RPC).
INSERT INTO public.shipping_settings (id, free_shipping_enabled, free_shipping_threshold)
VALUES (1, true, 5000)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.shipping_rates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage shipping_rates"
  ON public.shipping_rates FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- shipping_settings is a single seeded singleton row (id fixed to 1) that the
-- app only ever UPDATEs — admins get UPDATE only (no INSERT/DELETE), so
-- neither an admin-role bug nor a compromised admin session can delete the
-- only row and silently disable the free-shipping rule with no toggle left
-- to flip. Read access for admins is covered by the public SELECT policy
-- below (RLS policies for the same command are OR'd together, so a separate
-- admin-only SELECT policy would be redundant).
CREATE POLICY "Admins update shipping_settings"
  ON public.shipping_settings FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Storefront (anon) needs to read both tables to price shipping at checkout.
DO $$ BEGIN
  CREATE POLICY "Public reads shipping_rates"
    ON public.shipping_rates FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public reads shipping_settings"
    ON public.shipping_settings FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

- [ ] **Step 2: Apply the migration to the hosted Supabase project**

Run: `npx supabase db push`
Expected: CLI reports the new migration applied with no errors. This is the same hosted project `.env.local` points at, so both `mei-admin` and `../mei` see the new tables immediately.

- [ ] **Step 3: Extend the schema-verification integration test**

In `tests/database/schema-verification.test.ts`, find the `tables` array in the `'All tables exist with correct columns'` test (around line 15-20) and add the two new tables:

```ts
    const tables = [
      'size_systems', 'size_system_entries', 'product_colors',
      'product_variants', 'product_media', 'measurement_templates',
      'measurement_template_fields', 'blouse_configurations', 'order_item_measurements',
      'category_rules', 'product_categories',
      'shipping_rates', 'shipping_settings'
    ];
```

- [ ] **Step 4: Run the schema verification test**

Run: `npx vitest run tests/database/schema-verification.test.ts`
Expected: PASS (requires `.env.local` with `SUPABASE_SERVICE_ROLE_KEY` pointed at the hosted project, per `CLAUDE.md`).

- [ ] **Step 5: Write RLS and CHECK-constraint boundary tests**

These close two production risks: (a) nothing currently proves the `anon` role is actually blocked from writing to these tables — RLS misconfiguration is a silent failure mode; (b) nothing proves the CHECK constraints reject bad admin input at the DB layer, which is the real safety net beneath the browser-side validation in Task 7.

Create `tests/database/shipping-rls.test.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Unauthenticated anon client — exactly what the storefront and any other
// internet caller present. No admin session, no JWT.
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

describe('shipping_rates / shipping_settings — RLS', () => {
  test('anon can read shipping_rates', async () => {
    const { data, error } = await anonClient.from('shipping_rates').select('state, charge').limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('anon cannot insert into shipping_rates', async () => {
    const { error } = await anonClient
      .from('shipping_rates')
      .insert({ state: 'RLS Probe State', charge: 1 });
    expect(error).toBeDefined();
  });

  test('anon cannot update shipping_rates', async () => {
    const { error } = await anonClient
      .from('shipping_rates')
      .update({ charge: 999 })
      .eq('state', 'Tamil Nadu');
    // PostgREST returns no rows affected (not a hard error) when RLS silently
    // filters the target row — assert the value was NOT actually changed,
    // which is the behaviour that actually matters.
    expect(error).toBeNull();
    const { data } = await serviceClient.from('shipping_rates').select('charge').eq('state', 'Tamil Nadu').single();
    expect(Number(data!.charge)).not.toBe(999);
  });

  test('anon cannot delete from shipping_rates', async () => {
    await anonClient.from('shipping_rates').delete().eq('state', 'Tamil Nadu');
    const { data } = await serviceClient.from('shipping_rates').select('state').eq('state', 'Tamil Nadu').single();
    expect(data).not.toBeNull();
  });

  test('anon can read shipping_settings', async () => {
    const { data, error } = await anonClient.from('shipping_settings').select('*').eq('id', 1).single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  test('anon cannot update shipping_settings', async () => {
    await anonClient.from('shipping_settings').update({ free_shipping_enabled: false }).eq('id', 1);
    const { data } = await serviceClient.from('shipping_settings').select('free_shipping_enabled').eq('id', 1).single();
    // Untouched — still whatever the seed/prior tests left it as true by default
    expect(data!.free_shipping_enabled).toBe(true);
  });

  test('anon cannot delete the shipping_settings singleton row', async () => {
    await anonClient.from('shipping_settings').delete().eq('id', 1);
    const { data } = await serviceClient.from('shipping_settings').select('id').eq('id', 1).single();
    expect(data).not.toBeNull();
  });
});

describe('shipping_rates — CHECK constraint boundaries', () => {
  const probeState = 'CHECK Boundary Probe State';

  afterEach(async () => {
    await serviceClient.from('shipping_rates').delete().eq('state', probeState);
  });

  test('rejects a negative charge', async () => {
    const { error } = await serviceClient.from('shipping_rates').insert({ state: probeState, charge: -1 });
    expect(error).toBeDefined();
    expect(error!.message).toMatch(/check constraint|violates/i);
  });

  test('rejects a charge above the 100000 sanity ceiling', async () => {
    const { error } = await serviceClient.from('shipping_rates').insert({ state: probeState, charge: 100001 });
    expect(error).toBeDefined();
  });

  test('accepts a charge of exactly 0 (a legitimately free state)', async () => {
    const { error } = await serviceClient.from('shipping_rates').insert({ state: probeState, charge: 0 });
    expect(error).toBeNull();
  });

  test('accepts a charge of exactly 100000 (the ceiling is inclusive)', async () => {
    const { error } = await serviceClient.from('shipping_rates').insert({ state: probeState, charge: 100000 });
    expect(error).toBeNull();
  });
});

describe('shipping_settings — CHECK constraint boundaries', () => {
  let originalThreshold: number | null;

  beforeAll(async () => {
    const { data } = await serviceClient.from('shipping_settings').select('free_shipping_threshold').eq('id', 1).single();
    originalThreshold = data!.free_shipping_threshold;
  });

  afterAll(async () => {
    await serviceClient.from('shipping_settings').update({ free_shipping_threshold: originalThreshold }).eq('id', 1);
  });

  test('rejects a negative free_shipping_threshold', async () => {
    const { error } = await serviceClient.from('shipping_settings').update({ free_shipping_threshold: -1 }).eq('id', 1);
    expect(error).toBeDefined();
  });

  test('accepts a null free_shipping_threshold (rule present but unset)', async () => {
    const { error } = await serviceClient.from('shipping_settings').update({ free_shipping_threshold: null }).eq('id', 1);
    expect(error).toBeNull();
  });
});
```

- [ ] **Step 6: Run the RLS and boundary tests**

Run: `npx vitest run tests/database/shipping-rls.test.ts`
Expected: PASS (11 tests). If any `anon cannot ...` test fails, RLS is misconfigured — do not proceed to Task 2 until it passes.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260709090000_shipping_config_schema.sql tests/database/schema-verification.test.ts tests/database/shipping-rls.test.ts
git commit -m "feat(db): add shipping_rates and shipping_settings tables"
```

**Rollback (if this migration needs to be reversed after deploy):**

```sql
DROP POLICY IF EXISTS "Public reads shipping_settings" ON public.shipping_settings;
DROP POLICY IF EXISTS "Public reads shipping_rates" ON public.shipping_rates;
DROP POLICY IF EXISTS "Admins update shipping_settings" ON public.shipping_settings;
DROP POLICY IF EXISTS "Admins manage shipping_rates" ON public.shipping_rates;
DROP TABLE IF EXISTS public.shipping_settings;
DROP TABLE IF EXISTS public.shipping_rates;
```

Run this via `npx supabase db execute --sql "<statement>"` for each line, or paste into the Supabase SQL Editor. This can only be run before Task 2 lands — once `create_order_txn` is replaced to depend on these tables (Task 2), rolling back this migration also requires rolling back Task 2's migration first (see Task 2's own Rollback note), otherwise every order submission will start failing.

---

### Task 2: State-aware `create_order_txn` RPC

**Files:**
- Create: `supabase/migrations/20260709091500_shipping_aware_create_order_txn.sql`
- Create: `tests/database/shipping-rpc.test.ts`

**Interfaces:**
- Consumes: `shipping_rates`, `shipping_settings` from Task 1.
- Produces: `create_order_txn(...)` now derives `v_shipping` from `shipping_rates.charge` for `p_shipping_address->>'state'`, applying the global free-shipping rule from `shipping_settings`. Raises `SHIPPING_STATE_NOT_CONFIGURED:<state>` when the state has no configured rate, `SHIPPING_STATE_MISSING` when `shipping_address` has no `state` key at all (distinguishes a client bug from an admin configuration gap), and `INVALID_QUANTITY:<product_id>` when any line item has a non-positive quantity (mirrors the existing `PRODUCT_NOT_FOUND:<id>` pattern the Edge Function already parses). `EXECUTE` on this function is revoked from `PUBLIC`/`anon`/`authenticated` and granted only to `service_role`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260709091500_shipping_aware_create_order_txn.sql`:

```sql
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
```

- [ ] **Step 2: Apply the migration to the hosted Supabase project**

Run: `npx supabase db push`
Expected: CLI reports the migration applied with no errors.

- [ ] **Step 3: Write the RPC integration test**

Create `tests/database/shipping-rpc.test.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anonSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

describe('create_order_txn — state-based shipping', () => {
  const testState = 'RPC Test State';
  let testProductId: string;
  let testProductPrice: number;
  const createdOrderIds: string[] = [];
  const createdCustomerEmails: string[] = [];

  beforeAll(async () => {
    const { data: product, error } = await supabase
      .from('products')
      .select('id, price')
      .limit(1)
      .single();
    expect(error).toBeNull();
    testProductId = product!.id;
    testProductPrice = Number(product!.price);

    const { error: rateError } = await supabase
      .from('shipping_rates')
      .insert({ state: testState, charge: 777 });
    expect(rateError).toBeNull();
  });

  afterAll(async () => {
    for (const orderId of createdOrderIds) {
      await supabase.from('order_items').delete().eq('order_id', orderId);
      await supabase.from('orders').delete().eq('id', orderId);
    }
    for (const email of createdCustomerEmails) {
      await supabase.from('customers').delete().eq('email', email);
    }
    await supabase.from('shipping_rates').delete().eq('state', testState);
  }, 15000);

  test('charges the configured state rate when subtotal is below the free-shipping threshold', async () => {
    const email = `rpc-test-${Date.now()}@example.com`;
    createdCustomerEmails.push(email);

    const { data, error } = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 1 }],
      p_shipping_address: { state: testState, city: 'Test City', pincode: '000000' },
      p_payment_id: `rpc_test_${Date.now()}`,
      p_payment_provider: 'razorpay',
    });

    expect(error).toBeNull();
    expect(data.already_exists).toBe(false);
    createdOrderIds.push(data.order_id);
    expect(Number(data.total)).toBeCloseTo(testProductPrice + 777, 2);
  });

  test('rejects an unconfigured state without creating an order', async () => {
    const email = `rpc-test-${Date.now()}-2@example.com`;

    const { error } = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 1 }],
      p_shipping_address: { state: 'Nonexistent State ZZZ', city: 'Test City', pincode: '000000' },
      p_payment_id: `rpc_test_${Date.now()}_2`,
      p_payment_provider: 'razorpay',
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain('SHIPPING_STATE_NOT_CONFIGURED');

    // The exception rolls back the whole function invocation (plpgsql functions
    // are atomic per call), so the customer upsert above never persists either.
    const { data: leaked } = await supabase.from('customers').select('id').eq('email', email);
    expect(leaked).toEqual([]);
  });

  test('applies free shipping when subtotal meets the global threshold', async () => {
    const email = `rpc-test-${Date.now()}-3@example.com`;
    createdCustomerEmails.push(email);

    // shipping_settings is seeded with threshold=5000 by the schema migration;
    // request enough quantity to clear it regardless of the seed product's price.
    const qty = Math.ceil(5000 / testProductPrice) + 1;

    const { data, error } = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: qty }],
      p_shipping_address: { state: testState, city: 'Test City', pincode: '000000' },
      p_payment_id: `rpc_test_${Date.now()}_3`,
      p_payment_provider: 'razorpay',
    });

    expect(error).toBeNull();
    createdOrderIds.push(data.order_id);
    expect(Number(data.total)).toBeCloseTo(testProductPrice * qty, 2);
  });

  test('rejects a non-positive quantity without creating an order', async () => {
    const email = `rpc-test-${Date.now()}-4@example.com`;

    const { error } = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: -1 }],
      p_shipping_address: { state: testState, city: 'Test City', pincode: '000000' },
      p_payment_id: `rpc_test_${Date.now()}_4`,
      p_payment_provider: 'razorpay',
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain('INVALID_QUANTITY');

    const { data: leaked } = await supabase.from('customers').select('id').eq('email', email);
    expect(leaked).toEqual([]);
  });

  test('rejects a zero quantity', async () => {
    const email = `rpc-test-${Date.now()}-5@example.com`;

    const { error } = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 0 }],
      p_shipping_address: { state: testState, city: 'Test City', pincode: '000000' },
      p_payment_id: `rpc_test_${Date.now()}_5`,
      p_payment_provider: 'razorpay',
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain('INVALID_QUANTITY');
  });

  test('rejects a missing/blank state distinctly from an unconfigured state', async () => {
    const email = `rpc-test-${Date.now()}-6@example.com`;

    const { error: missingError } = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 1 }],
      p_shipping_address: { city: 'Test City', pincode: '000000' }, // no `state` key at all
      p_payment_id: `rpc_test_${Date.now()}_6`,
      p_payment_provider: 'razorpay',
    });
    expect(error).toBeDefined();
    expect(missingError!.message).toContain('SHIPPING_STATE_MISSING');

    const { error: blankError } = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 1 }],
      p_shipping_address: { state: '   ', city: 'Test City', pincode: '000000' }, // blank state
      p_payment_id: `rpc_test_${Date.now()}_6b`,
      p_payment_provider: 'razorpay',
    });
    expect(error).toBeDefined();
    expect(blankError!.message).toContain('SHIPPING_STATE_MISSING');
  });

  test('is idempotent under the new shipping-aware code path: replaying the same payment_id returns the original order without recharging', async () => {
    const email = `rpc-test-${Date.now()}-7@example.com`;
    createdCustomerEmails.push(email);
    const paymentId = `rpc_test_${Date.now()}_7`;

    const first = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 1 }],
      p_shipping_address: { state: testState, city: 'Test City', pincode: '000000' },
      p_payment_id: paymentId,
      p_payment_provider: 'razorpay',
    });
    expect(first.error).toBeNull();
    createdOrderIds.push(first.data.order_id);

    const second = await supabase.rpc('create_order_txn', {
      p_customer: { name: 'RPC Test', email, phone: '9999999999', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 1 }],
      p_shipping_address: { state: testState, city: 'Test City', pincode: '000000' },
      p_payment_id: paymentId, // same payment_id — simulates a client retry / double-submit
      p_payment_provider: 'razorpay',
    });
    expect(second.error).toBeNull();
    expect(second.data.already_exists).toBe(true);
    expect(second.data.order_id).toBe(first.data.order_id);
    expect(Number(second.data.total)).toBe(Number(first.data.total));

    // Confirm no duplicate order was actually persisted
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_id', paymentId);
    expect(count).toBe(1);
  });

  test('the anon role cannot call create_order_txn directly (bypassing Razorpay signature verification)', async () => {
    const { error } = await anonSupabase.rpc('create_order_txn', {
      p_customer: { name: 'Anon Probe', email: `anon-probe-${Date.now()}@example.com`, phone: '0000000000', city: 'Test City' },
      p_items: [{ product_id: testProductId, name: 'Test Item', quantity: 1 }],
      p_shipping_address: { state: testState, city: 'Test City', pincode: '000000' },
      p_payment_id: `anon_probe_${Date.now()}`,
      p_payment_provider: 'razorpay',
    });

    expect(error).toBeDefined();
    expect(error!.message).toMatch(/permission denied/i);
  });
});
```

- [ ] **Step 4: Run the RPC integration test**

Run: `npx vitest run tests/database/shipping-rpc.test.ts`
Expected: PASS (8 tests). Requires `.env.local` with `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and at least one row in `products`. If the last test ("anon role cannot call ...") fails, the `REVOKE`/`GRANT` statements in Step 1 did not apply — re-run `npx supabase db push` and confirm no errors before proceeding.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260709091500_shipping_aware_create_order_txn.sql tests/database/shipping-rpc.test.ts
git commit -m "feat(db): derive create_order_txn shipping charge from shipping_rates"
```

**Rollback (if this migration needs to be reversed after deploy):**

Restore the pre-existing flat-rate function by re-applying its original body (from `20260629_checkout_production.sql`) via a new forward migration — never edit or delete a migration file that has already been applied to the hosted project:

```sql
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
  SELECT id, order_number, total INTO v_existing FROM orders WHERE payment_id = p_payment_id;
  IF FOUND THEN
    RETURN jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number, 'total', v_existing.total, 'already_exists', true);
  END IF;

  INSERT INTO customers (name, email, phone, city)
  VALUES (trim(p_customer->>'name'), lower(trim(p_customer->>'email')), nullif(trim(p_customer->>'phone'), ''), nullif(trim(p_customer->>'city'), ''))
  ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, phone = COALESCE(EXCLUDED.phone, customers.phone), city = COALESCE(EXCLUDED.city, customers.city)
  RETURNING id INTO v_customer_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT price INTO v_price FROM products WHERE id = (v_item->>'product_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND:%', v_item->>'product_id'; END IF;
    v_subtotal := v_subtotal + v_price * (v_item->>'quantity')::integer;
  END LOOP;

  v_shipping := CASE WHEN v_subtotal >= 5000 THEN 0 ELSE 150 END;
  v_total := v_subtotal + v_shipping;

  INSERT INTO orders (customer_id, status, total, payment_id, payment_provider, payment_metadata, shipping_address)
  VALUES (v_customer_id, 'PENDING', v_total, p_payment_id, p_payment_provider, p_payment_metadata, p_shipping_address)
  RETURNING id, order_number INTO v_order_id, v_order_number;

  INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
  SELECT v_order_id, (item->>'product_id')::uuid, item->>'name', (item->>'quantity')::integer, p.price
  FROM jsonb_array_elements(p_items) AS item JOIN products p ON p.id = (item->>'product_id')::uuid;

  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'total', v_total, 'already_exists', false);
END;
$$;

-- Note: do NOT also revert the REVOKE/GRANT lockdown — that closes a real
-- security hole independent of the shipping feature and should stay in place
-- regardless of which version of the shipping logic is active.
```

Rolling this back re-introduces the flat `₹150`/`₹5000` behavior; it does not require rolling back Task 1's tables (they simply go unused by the RPC again).

---

### Task 3: TypeScript types for the new tables

**Files:**
- Modify: `types/database.ts`
- Modify: `types/index.ts`

**Interfaces:**
- Consumes: schema from Task 1.
- Produces: `Database['public']['Tables']['shipping_rates']`, `Database['public']['Tables']['shipping_settings']`; exported types `ShippingRate`, `ShippingRateInsert`, `ShippingRateUpdate`, `ShippingSettings`, `ShippingSettingsUpdate`.

- [ ] **Step 1: Add table entries to `types/database.ts`**

In `types/database.ts`, insert immediately after the `audit_logs` block (currently lines 72-76) and before the closing `}` of `Tables`:

```ts
      shipping_rates: {
        Row: { id: string; state: string; charge: number; updated_at: string }
        Insert: { id?: string; state: string; charge: number }
        Update: { charge?: number }
      }
      shipping_settings: {
        Row: { id: number; free_shipping_enabled: boolean; free_shipping_threshold: number | null; updated_at: string }
        Insert: never
        Update: { free_shipping_enabled?: boolean; free_shipping_threshold?: number | null }
      }
```

- [ ] **Step 2: Add exported types to `types/index.ts`**

In `types/index.ts`, append after the existing `SettingUpdate` export (currently line 49):

```ts
export type ShippingRate = Tables['shipping_rates']['Row']
export type ShippingRateInsert = Tables['shipping_rates']['Insert']
export type ShippingRateUpdate = Tables['shipping_rates']['Update']
export type ShippingSettings = Tables['shipping_settings']['Row']
export type ShippingSettingsUpdate = Tables['shipping_settings']['Update']
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add types/database.ts types/index.ts
git commit -m "feat(types): add ShippingRate and ShippingSettings types"
```

---

### Task 4: Canonical Indian states list

**Files:**
- Create: `lib/india-states.ts`
- Test: `lib/india-states.test.ts`

**Interfaces:**
- Produces: `INDIAN_STATES: readonly string[]` (29 entries — 28 states plus Delhi NCT), `IndianState` union type. Consumed by Task 7's admin table.

- [ ] **Step 1: Write the failing test**

Create `lib/india-states.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { INDIAN_STATES } from './india-states'

describe('INDIAN_STATES', () => {
  it('contains no duplicate entries', () => {
    expect(new Set(INDIAN_STATES).size).toBe(INDIAN_STATES.length)
  })

  it('includes every state pre-seeded by the shipping_rates migration', () => {
    const preSeeded = ['Tamil Nadu', 'Maharashtra', 'Karnataka', 'Delhi', 'Telangana', 'Kerala', 'Andhra Pradesh']
    preSeeded.forEach((state) => expect(INDIAN_STATES).toContain(state))
  })

  it('has 29 entries (28 states plus Delhi NCT)', () => {
    expect(INDIAN_STATES.length).toBe(29)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/india-states.test.ts`
Expected: FAIL with "Cannot find module './india-states'"

- [ ] **Step 3: Write the implementation**

Create `lib/india-states.ts`:

```ts
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
] as const

export type IndianState = (typeof INDIAN_STATES)[number]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/india-states.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/india-states.ts lib/india-states.test.ts
git commit -m "feat: add canonical Indian states list"
```

---

### Task 5: `services/shipping.ts` + `hooks/use-shipping.ts`

**Files:**
- Modify: `lib/audit.ts`
- Create: `services/shipping.ts`
- Create: `hooks/use-shipping.ts`

**Interfaces:**
- Consumes: `ShippingRate`, `ShippingRateInsert`, `ShippingSettings`, `ShippingSettingsUpdate` from Task 3; `createClient` from `@/lib/supabase/client`; `toAppError`, `AppError` from `@/lib/errors`; `logAuditEvent` from `@/lib/audit`.
- Produces: `getShippingRates()`, `upsertShippingRate(rate)`, `getShippingSettings()`, `updateShippingSettings(updates)` — the latter two now write an `audit_logs` row on every mutation, matching `services/settings.ts`'s existing convention; hooks `useShippingRates()`, `useUpsertShippingRate()`, `useShippingSettings()`, `useUpdateShippingSettings()` (query keys `['shipping', 'rates']` and `['shipping', 'settings']`). Consumed by Task 7's page.

This codebase has no unit-test precedent for its thin CRUD service/hook pairs (`services/settings.ts`, `services/category-rules.ts` are both untested directly — they're exercised indirectly through component tests that mock the service module, as Task 7 does here). This task follows that same convention: implementation only, verified by `tsc` and by Task 7's component test.

- [ ] **Step 1: Extend the audit-log resource type**

`services/settings.ts` already calls `logAuditEvent()` on every config write — this task wires shipping config into the same mechanism instead of introducing a parallel one, so every rate/threshold change is visible on the existing `/audit` page.

In `lib/audit.ts`, replace the `ResourceType` union and `RESOURCE_TYPES` array (currently lines 6-23):

```ts
type ResourceType =
  | 'product'
  | 'category'
  | 'order'
  | 'enquiry'
  | 'banner'
  | 'setting'
  | 'profile'
  | 'shipping_rate'
  | 'shipping_settings'

export const RESOURCE_TYPES = [
  'product',
  'category',
  'order',
  'enquiry',
  'banner',
  'setting',
  'profile',
  'shipping_rate',
  'shipping_settings',
] as const
```

- [ ] **Step 2: Write the service, with audit logging on every mutation**

Create `services/shipping.ts`:

```ts
import { createClient } from '@/lib/supabase/client'
import { toAppError, AppError } from '@/lib/errors'
import { logAuditEvent } from '@/lib/audit'
import type { ShippingRate, ShippingRateInsert, ShippingSettings, ShippingSettingsUpdate } from '@/types'
import type { Json } from '@/types/database'

export async function getShippingRates(): Promise<ShippingRate[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('shipping_rates')
    .select('*')
    .order('state', { ascending: true })

  if (error) throw toAppError(new Error(error.message))
  return (data as ShippingRate[] | null) ?? []
}

export async function upsertShippingRate(rate: ShippingRateInsert): Promise<ShippingRate> {
  const supabase = createClient()
  const response = await supabase
    .from('shipping_rates')
    .upsert(rate as never, { onConflict: 'state' })
    .select()
    .single()
  const { data, error } = response as { data: ShippingRate | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))
  if (!data) throw new AppError('NOT_FOUND', 'Shipping rate not returned after upsert')

  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'shipping_rate',
    resourceId: data.state,
    newData: { state: data.state, charge: data.charge } as Json,
  })

  return data
}

export async function getShippingSettings(): Promise<ShippingSettings> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('shipping_settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) throw toAppError(new Error(error.message))
  return data as ShippingSettings
}

export async function updateShippingSettings(updates: ShippingSettingsUpdate): Promise<ShippingSettings> {
  const supabase = createClient()
  const response = await supabase
    .from('shipping_settings')
    .update(updates as never)
    .eq('id', 1)
    .select()
    .single()
  const { data, error } = response as { data: ShippingSettings | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))
  if (!data) throw new AppError('NOT_FOUND', 'Shipping settings not returned after update')

  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'shipping_settings',
    resourceId: 'global',
    newData: { free_shipping_enabled: data.free_shipping_enabled, free_shipping_threshold: data.free_shipping_threshold } as Json,
  })

  return data
}
```

`logAuditEvent` already swallows its own errors internally (`lib/audit.ts`'s existing try/catch — "Audit logging must never break the main operation"), so a transient audit-log failure can never make a legitimate rate/threshold save appear to fail. No additional error handling is needed here to preserve that guarantee.

- [ ] **Step 3: Write the hooks**

Create `hooks/use-shipping.ts`:

```ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getShippingRates,
  upsertShippingRate,
  getShippingSettings,
  updateShippingSettings,
} from '@/services/shipping'
import type { ShippingRateInsert, ShippingSettingsUpdate } from '@/types'

export function useShippingRates() {
  return useQuery({
    queryKey: ['shipping', 'rates'],
    queryFn: () => getShippingRates(),
  })
}

export function useUpsertShippingRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rate: ShippingRateInsert) => upsertShippingRate(rate),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipping', 'rates'] }),
  })
}

export function useShippingSettings() {
  return useQuery({
    queryKey: ['shipping', 'settings'],
    queryFn: () => getShippingSettings(),
  })
}

export function useUpdateShippingSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (updates: ShippingSettingsUpdate) => updateShippingSettings(updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipping', 'settings'] }),
  })
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add lib/audit.ts services/shipping.ts hooks/use-shipping.ts
git commit -m "feat: add shipping rates/settings service and hooks with audit logging"
```

---

### Task 6: Settings tab navigation (General / Shipping)

**Files:**
- Create: `app/(app)/settings/layout.tsx`
- Modify: `app/(app)/settings/page.tsx`

**Interfaces:**
- Produces: a shared tab header ("GENERAL" / "SHIPPING") rendered above both `/settings` and `/settings/shipping` (Task 7).

- [ ] **Step 1: Create the settings layout with tab navigation**

Create `app/(app)/settings/layout.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/settings', label: 'GENERAL' },
  { href: '/settings/shipping', label: 'SHIPPING' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6 px-8 pt-10 font-inter relative animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold tracking-wider text-zinc-800 uppercase font-sans">
          Settings
        </h3>
      </div>

      <div className="flex gap-6 border-b border-[#E8E0D5]">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`pb-3 text-[11px] font-bold tracking-widest uppercase transition-colors ${
                isActive
                  ? 'text-[#B38B5D] border-b-2 border-[#B38B5D]'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
```

- [ ] **Step 2: Strip the now-duplicated wrapper and header from `page.tsx`**

In `app/(app)/settings/page.tsx`, replace the final `return` statement (currently lines 46-160, everything from `return (` through the final closing `)`) with:

```tsx
  return (
    <>
      {/* Loading overlay for mutations */}
      {updateSettingMutation.isPending && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">Saving settings...</div>
        </div>
      )}

      {/* Settings Table */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[25%]">
                  KEY
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[40%]">
                  VALUE
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[35%]">
                  DESCRIPTION
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {settings.map((setting) => {
                const currentValue = formValues[setting.key]

                return (
                  <tr key={setting.key} className="hover:bg-[#FAF8F5]/40 transition-colors">
                    <td className="px-6 py-3 text-[12px] font-medium text-zinc-800">
                      {setting.key}
                    </td>
                    <td className="px-6 py-3 space-y-2">
                      {typeof setting.value === 'boolean' ? (
                        <label className="flex items-center gap-2 text-[12px] text-zinc-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentValue as boolean}
                            onChange={(e) => handleFieldChange(setting.key, e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span>{currentValue ? 'Enabled' : 'Disabled'}</span>
                        </label>
                      ) : typeof setting.value === 'number' ? (
                        <input
                          type="number"
                          value={currentValue as number}
                          onChange={(e) => handleFieldChange(setting.key, parseInt(e.target.value, 10))}
                          className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(currentValue)}
                          onChange={(e) => handleFieldChange(setting.key, e.target.value)}
                          className="w-full border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] transition-colors"
                        />
                      )}
                    </td>
                    <td className="px-6 py-3 text-[12px] text-zinc-600">
                      {setting.description ?? '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#E8E0D5] px-8 py-5 flex gap-3 bg-[#FAF8F5]/30">
          <button
            onClick={() => {
              // Reset form values to original
              const values: Record<string, unknown> = {}
              settings.forEach((setting) => {
                values[setting.key] = setting.value
              })
              setFormValues(values)
            }}
            className="border border-zinc-200 hover:bg-zinc-50 text-[10px] font-bold tracking-widest text-zinc-500 py-2 px-4 transition-colors uppercase rounded-none"
          >
            Reset
          </button>
          <button
            onClick={() => {
              // Save all dirty fields
              const dirtySettings = settings.filter((s) => formValues[s.key] !== s.value)
              dirtySettings.forEach((setting) => {
                handleSave(setting)
              })
            }}
            className="bg-[#B38B5D] hover:bg-[#A37B4D] text-[10px] font-bold tracking-widest text-white py-2 px-4 transition-colors uppercase rounded-none"
          >
            Save All Changes
          </button>
        </div>

      </div>
    </>
  )
}
```

The `if (isLoading) return <TableSkeleton ... />`, `if (error) return <ErrorState ... />`, and `if (settings.length === 0) return <EmptyState ... />` early returns above it (lines 24-29) are unchanged — they already return bare, without the page wrapper, so moving the wrapper to the layout is a pure refactor with no behavior change to those states (and now the "Settings" header + tabs stay visible during them, which they previously did not).

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev`, visit `http://localhost:3000/settings`
Expected: "Settings" header with "GENERAL" (active, gold underline) and "SHIPPING" tabs. Clicking "SHIPPING" navigates to `/settings/shipping` (404 until Task 7 lands — that's expected here).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/settings/layout.tsx" "app/(app)/settings/page.tsx"
git commit -m "feat(settings): add General/Shipping tab navigation"
```

---

### Task 7: Shipping Configuration page

**Files:**
- Create: `app/(app)/settings/shipping/page.tsx`
- Test: `__tests__/components/settings/ShippingSettingsPage.test.tsx`

**Interfaces:**
- Consumes: `useShippingRates`, `useUpsertShippingRate`, `useShippingSettings`, `useUpdateShippingSettings` from Task 5; `INDIAN_STATES` from Task 4; `TableSkeleton`, `ErrorState` from `@/components/ui/*`.

- [ ] **Step 1: Write the failing component test**

Create `__tests__/components/settings/ShippingSettingsPage.test.tsx`:

```tsx
// __tests__/components/settings/ShippingSettingsPage.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/shipping', () => ({
  getShippingRates: vi.fn().mockResolvedValue([
    { id: 'r1', state: 'Tamil Nadu', charge: 300, updated_at: '' },
  ]),
  upsertShippingRate: vi.fn().mockResolvedValue({ id: 'r1', state: 'Tamil Nadu', charge: 300, updated_at: '' }),
  getShippingSettings: vi.fn().mockResolvedValue({ id: 1, free_shipping_enabled: true, free_shipping_threshold: 5000, updated_at: '' }),
  updateShippingSettings: vi.fn().mockResolvedValue({ id: 1, free_shipping_enabled: true, free_shipping_threshold: 5000, updated_at: '' }),
}))

const { default: ShippingSettingsPage } = await import('@/app/(app)/settings/shipping/page')
const { upsertShippingRate } = await import('@/services/shipping')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('ShippingSettingsPage', () => {
  it('renders every canonical Indian state as a row', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    expect(await screen.findByText('Karnataka')).toBeInTheDocument()
    expect(await screen.findByText('Tamil Nadu')).toBeInTheDocument()
  })

  it('pre-fills the charge input for a configured state', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    const row = (await screen.findByText('Tamil Nadu')).closest('tr')!
    const input = row.querySelector('input') as HTMLInputElement
    expect(input.value).toBe('300')
  })

  it('saves an edited charge when Save All Changes is clicked', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    const row = (await screen.findByText('Tamil Nadu')).closest('tr')!
    const input = row.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '350' } })
    fireEvent.click(screen.getByText('Save All Changes'))

    await waitFor(() => {
      expect(upsertShippingRate).toHaveBeenCalledWith({ state: 'Tamil Nadu', charge: 350 })
    })
  })

  it('shows the free shipping threshold from settings', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    expect(await screen.findByDisplayValue('5000')).toBeInTheDocument()
  })

  it('rejects a negative charge without calling upsertShippingRate, and shows an inline error', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    const row = (await screen.findByText('Tamil Nadu')).closest('tr')!
    const input = row.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '-50' } })
    fireEvent.click(screen.getByText('Save All Changes'))

    await waitFor(() => {
      expect(screen.getByText(/enter a number between 0 and 100000/i)).toBeInTheDocument()
    })
    expect(upsertShippingRate).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric charge without calling upsertShippingRate', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    const row = (await screen.findByText('Karnataka')).closest('tr')!
    const input = row.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.click(screen.getByText('Save All Changes'))

    await waitFor(() => {
      expect(screen.getByText(/enter a number between 0 and 100000/i)).toBeInTheDocument()
    })
    expect(upsertShippingRate).not.toHaveBeenCalled()
  })

  it('labels every charge input accessibly by state name', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    expect(await screen.findByLabelText('Shipping charge for Tamil Nadu')).toBeInTheDocument()
    expect(await screen.findByLabelText('Shipping charge for Karnataka')).toBeInTheDocument()
  })

  it('labels the free shipping threshold input accessibly', async () => {
    render(<ShippingSettingsPage />, { wrapper })
    expect(await screen.findByLabelText('Threshold (₹)')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/components/settings/ShippingSettingsPage.test.tsx`
Expected: FAIL with "Cannot find module '@/app/(app)/settings/shipping/page'"

- [ ] **Step 3: Write the page**

Create `app/(app)/settings/shipping/page.tsx`:

```tsx
'use client'

import React, { useState, useEffect } from 'react'
import {
  useShippingRates,
  useUpsertShippingRate,
  useShippingSettings,
  useUpdateShippingSettings,
} from '@/hooks/use-shipping'
import { TableSkeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { INDIAN_STATES } from '@/lib/india-states'

export default function ShippingSettingsPage() {
  const { data: rates = [], isLoading, error, refetch } = useShippingRates()
  const upsertRate = useUpsertShippingRate()
  const { data: settings, isLoading: settingsLoading } = useShippingSettings()
  const updateSettings = useUpdateShippingSettings()

  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(false)
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('')

  useEffect(() => {
    const values: Record<string, string> = {}
    INDIAN_STATES.forEach((state) => {
      const existing = rates.find((r) => r.state === state)
      values[state] = existing ? String(existing.charge) : ''
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormValues(values)
  }, [rates])

  useEffect(() => {
    if (!settings) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFreeShippingEnabled(settings.free_shipping_enabled)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFreeShippingThreshold(settings.free_shipping_threshold != null ? String(settings.free_shipping_threshold) : '')
  }, [settings])

  if (isLoading || settingsLoading) return <TableSkeleton rows={8} />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />

  const originalByState = new Map(rates.map((r) => [r.state, String(r.charge)]))

  const handleChargeChange = (state: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [state]: value }))
    if (rowErrors[state]) {
      setRowErrors((prev) => ({ ...prev, [state]: '' }))
    }
  }

  // Mirrors the DB CHECK constraint (charge >= 0 AND charge <= 100000) so the
  // admin gets immediate inline feedback instead of a generic failed-save
  // alert after a round trip. The DB constraint remains the authoritative
  // guard — this is a UX improvement layered on top of it, not a replacement.
  const isValidCharge = (raw: string) => {
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100000
  }

  const handleSaveRates = async () => {
    const dirtyStates = INDIAN_STATES.filter((state) => {
      const original = originalByState.get(state) ?? ''
      return formValues[state] !== original && formValues[state]?.trim() !== ''
    })

    const nextRowErrors: Record<string, string> = {}
    const validStates = dirtyStates.filter((state) => {
      if (!isValidCharge(formValues[state])) {
        nextRowErrors[state] = 'Enter a number between 0 and 100000'
        return false
      }
      return true
    })
    setRowErrors(nextRowErrors)
    if (validStates.length === 0) return

    try {
      for (const state of validStates) {
        await upsertRate.mutateAsync({ state, charge: Number(formValues[state]) })
      }
    } catch {
      alert('Failed to save shipping rates')
    }
  }

  const handleSaveFreeShipping = async () => {
    const parsedThreshold = freeShippingThreshold.trim() === '' ? null : Number(freeShippingThreshold)
    if (parsedThreshold !== null && (!Number.isFinite(parsedThreshold) || parsedThreshold < 0)) {
      alert('Threshold must be a non-negative number')
      return
    }

    try {
      await updateSettings.mutateAsync({
        free_shipping_enabled: freeShippingEnabled,
        free_shipping_threshold: parsedThreshold,
      })
    } catch {
      alert('Failed to save free shipping rule')
    }
  }

  return (
    <div className="space-y-6">
      {(upsertRate.isPending || updateSettings.isPending) && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="text-zinc-500 font-medium text-xs">Saving shipping settings...</div>
        </div>
      )}

      {/* Free shipping rule */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs p-6 space-y-4">
        <h4 className="text-[11px] font-bold tracking-widest text-zinc-800 uppercase">
          Free Shipping Rule
        </h4>
        <label className="flex items-center gap-2 text-[12px] text-zinc-700 cursor-pointer">
          <input
            type="checkbox"
            checked={freeShippingEnabled}
            onChange={(e) => setFreeShippingEnabled(e.target.checked)}
            className="w-4 h-4"
          />
          <span>Enable free shipping above a threshold</span>
        </label>
        <div className="flex items-center gap-3">
          <label htmlFor="free-shipping-threshold" className="text-[11px] text-zinc-500 uppercase tracking-widest">
            Threshold (₹)
          </label>
          <input
            id="free-shipping-threshold"
            type="number"
            min={0}
            value={freeShippingThreshold}
            onChange={(e) => setFreeShippingThreshold(e.target.value)}
            disabled={!freeShippingEnabled}
            className="w-32 border-b border-[#E8E0D5] py-2 text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] transition-colors disabled:opacity-40"
          />
        </div>
        <button
          onClick={handleSaveFreeShipping}
          className="bg-[#B38B5D] hover:bg-[#A37B4D] text-[10px] font-bold tracking-widest text-white py-2 px-4 transition-colors uppercase rounded-none"
        >
          Save Free Shipping Rule
        </button>
      </div>

      {/* State-wise rate table */}
      <div className="bg-white border border-[#E8E0D5] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[50%]">
                  STATE
                </th>
                <th className="px-6 py-2.5 text-[9px] font-bold tracking-widest text-zinc-900 uppercase w-[50%]">
                  CHARGE (₹)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D5]">
              {INDIAN_STATES.map((state) => (
                <tr key={state} className="hover:bg-[#FAF8F5]/40 transition-colors">
                  <td className="px-6 py-3 text-[12px] font-medium text-zinc-800">{state}</td>
                  <td className="px-6 py-3">
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      placeholder="Not set"
                      aria-label={`Shipping charge for ${state}`}
                      value={formValues[state] ?? ''}
                      onChange={(e) => handleChargeChange(state, e.target.value)}
                      className={`w-full border-b py-2 text-[13px] text-zinc-800 focus:outline-hidden focus:border-[#B38B5D] transition-colors ${
                        rowErrors[state] ? 'border-red-500' : 'border-[#E8E0D5]'
                      }`}
                    />
                    {rowErrors[state] && <p className="text-[11px] text-red-500 mt-1">{rowErrors[state]}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#E8E0D5] px-8 py-5 flex gap-3 bg-[#FAF8F5]/30">
          <button
            onClick={handleSaveRates}
            className="bg-[#B38B5D] hover:bg-[#A37B4D] text-[10px] font-bold tracking-widest text-white py-2 px-4 transition-colors uppercase rounded-none"
          >
            Save All Changes
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/components/settings/ShippingSettingsPage.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev`, visit `http://localhost:3000/settings/shipping`
Expected: All 29 states listed, the 7 seeded states pre-filled with their charges, free-shipping toggle checked with threshold 5000. Edit a charge, click "Save All Changes", refresh — the new value persists.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/settings/shipping/page.tsx" "__tests__/components/settings/ShippingSettingsPage.test.tsx"
git commit -m "feat(settings): add Shipping Configuration page"
```

---

### Task 8: Edge Function — handle unconfigured-state, missing-state, and invalid-quantity errors

**Files:**
- Modify: `supabase/functions/create-order/index.ts`

**Interfaces:**
- Consumes: the `SHIPPING_STATE_NOT_CONFIGURED:<state>`, `SHIPPING_STATE_MISSING`, and `INVALID_QUANTITY:<product_id>` exceptions raised by `create_order_txn` (Task 2).
- Produces: `400 { success: false, error: 'SHIPPING_STATE_NOT_CONFIGURED', state: '<state>' }`, `400 { success: false, error: 'SHIPPING_STATE_MISSING' }`, and `400 { success: false, error: 'INVALID_QUANTITY', product_id: '<id>' }` responses, mirroring the existing `PRODUCT_NOT_FOUND` branch.

- [ ] **Step 1: Add the new error branch**

In `supabase/functions/create-order/index.ts`, find the RPC error handling block (currently around line 130-148):

```ts
    if (error) {
      log('RPC error', {
        message: error.message,
        code: error.code,
        details: error.details
      });
      if (error.message?.includes('PRODUCT_NOT_FOUND')) {
        // Extract the failing product_id from the exception message (format: PRODUCT_NOT_FOUND:<uuid>)
        const failingId = error.message.split(':').slice(1).join(':').trim();
        log('product not found', {
          failing_product_id: failingId,
          supabase_url: supabaseUrl
        });
        return jsonResponse({
          success: false,
          error: 'PRODUCT_NOT_FOUND',
          product_id: failingId
        }, 400);
      }
      return jsonResponse({
        success: false,
        error: 'ORDER_CREATION_FAILED',
        detail: error.message
      }, 500);
    }
```

Replace it with:

```ts
    if (error) {
      log('RPC error', {
        message: error.message,
        code: error.code,
        details: error.details
      });
      if (error.message?.includes('PRODUCT_NOT_FOUND')) {
        // Extract the failing product_id from the exception message (format: PRODUCT_NOT_FOUND:<uuid>)
        const failingId = error.message.split(':').slice(1).join(':').trim();
        log('product not found', {
          failing_product_id: failingId,
          supabase_url: supabaseUrl
        });
        return jsonResponse({
          success: false,
          error: 'PRODUCT_NOT_FOUND',
          product_id: failingId
        }, 400);
      }
      if (error.message?.includes('SHIPPING_STATE_NOT_CONFIGURED')) {
        // Format: SHIPPING_STATE_NOT_CONFIGURED:<state>
        const failingState = error.message.split(':').slice(1).join(':').trim();
        log('shipping state not configured', {
          failing_state: failingState,
          supabase_url: supabaseUrl
        });
        return jsonResponse({
          success: false,
          error: 'SHIPPING_STATE_NOT_CONFIGURED',
          state: failingState
        }, 400);
      }
      if (error.message?.includes('SHIPPING_STATE_MISSING')) {
        log('shipping state missing from request', {
          supabase_url: supabaseUrl
        });
        return jsonResponse({
          success: false,
          error: 'SHIPPING_STATE_MISSING'
        }, 400);
      }
      if (error.message?.includes('INVALID_QUANTITY')) {
        // Format: INVALID_QUANTITY:<product_id>
        const failingProductId = error.message.split(':').slice(1).join(':').trim();
        log('invalid quantity', {
          failing_product_id: failingProductId,
          supabase_url: supabaseUrl
        });
        return jsonResponse({
          success: false,
          error: 'INVALID_QUANTITY',
          product_id: failingProductId
        }, 400);
      }
      return jsonResponse({
        success: false,
        error: 'ORDER_CREATION_FAILED',
        detail: error.message
      }, 500);
    }
```

- [ ] **Step 2: Deploy the function**

Run: `npx supabase functions deploy create-order`
Expected: CLI reports successful deployment. Per `CLAUDE.md`, deploy this function by name only — never run `npx supabase functions deploy` with no arguments (it would also redeploy `test-expedite-retry`).

- [ ] **Step 3: Manually verify all three new error branches**

With the Task 2 RPC live, POST to the deployed `create-order` function (via the storefront's bypass-mode checkout, or `curl` with a service-role bearer token — the function itself is public-facing but `create_order_txn` underneath it is now `service_role`-only per Task 2, which the function already satisfies):

1. A `shipping_address.state` with no matching `shipping_rates` row (e.g. `"Nonexistent State"`).
   Expected: HTTP 400, body `{"success":false,"error":"SHIPPING_STATE_NOT_CONFIGURED","state":"Nonexistent State"}`.
2. A `shipping_address` with no `state` key at all.
   Expected: HTTP 400, body `{"success":false,"error":"SHIPPING_STATE_MISSING"}`.
3. An item with `"quantity": 0` or a negative quantity.
   Expected: HTTP 400, body `{"success":false,"error":"INVALID_QUANTITY","product_id":"<the offending product id>"}`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/create-order/index.ts
git commit -m "feat(edge-function): handle SHIPPING_STATE_NOT_CONFIGURED, SHIPPING_STATE_MISSING, and INVALID_QUANTITY from create_order_txn"
```

- [ ] **Step 5: Full-repo verification gate**

Every earlier task ran `tsc --noEmit` scoped to its own change; this is the one point where lint and a full production build are verified across everything this plan touched. Do not consider this feature complete in `mei-admin` until all four pass:

Run: `npx tsc --noEmit`
Expected: No errors.

Run: `npx eslint .`
Expected: No errors. (Warnings pre-existing on `main` are acceptable; this plan's new/modified files — `services/shipping.ts`, `hooks/use-shipping.ts`, `app/(app)/settings/shipping/page.tsx`, `app/(app)/settings/layout.tsx`, `app/(app)/settings/page.tsx`, `lib/audit.ts`, `lib/india-states.ts` — must be clean.)

Run: `npm run build`
Expected: Production build succeeds with no errors (this also statically renders `/settings` and `/settings/shipping`, catching any server/client component boundary mistakes `tsc` alone would miss).

Run: `npx vitest run`
Expected: Full suite passes, including every test file this plan added (`tests/database/schema-verification.test.ts`, `tests/database/shipping-rls.test.ts`, `tests/database/shipping-rpc.test.ts`, `__tests__/components/settings/ShippingSettingsPage.test.tsx`, `lib/india-states.test.ts`) and every pre-existing test file (confirms no regression was introduced anywhere else in the app).

---

## Self-Review Notes

- **Spec coverage:** state-wise charge table (Task 7) ✓; add/edit/save per state (Task 5+7) ✓; persists to Supabase (Task 1) ✓; free-shipping toggle + global threshold (Task 1, 5, 7) ✓; admin-only write / public read RLS (Task 1) ✓; RPC/API to return charge per state (Task 5's `getShippingRates` for admin; the storefront plan's `GET /api/shipping/rate` for the public fetch) ✓; server-side validation ignoring client value (Task 2 — there was never a client-sent shipping value on this path, and this plan keeps it that way) ✓; 7 states pre-seeded (Task 1) ✓.
- **Cross-repo dependency:** the storefront plan (`../mei/docs/superpowers/plans/2026-07-09-state-shipping-charges-storefront.md`) depends on Task 1 and Task 2 of this plan being applied to the hosted Supabase project before its runtime code (not its unit tests, which all mock Supabase) will work end-to-end.
- **Production-readiness audit (2026-07-09), applied fixes:** (1) closed an anon-role privilege-escalation path on `create_order_txn` that predates this feature (Task 2 — `REVOKE`/`GRANT`); (2) added an `INVALID_QUANTITY` guard closing a subtotal-manipulation vector in the same function (Task 2); (3) distinguished a missing `state` from an unconfigured one via `SHIPPING_STATE_MISSING` (Task 2); (4) added CHECK-constraint bounds and dedicated RLS/boundary tests for both new tables (Task 1); (5) restricted `shipping_settings` to admin-`UPDATE`-only to protect the singleton row from deletion (Task 1); (6) wired shipping-config writes into the existing `audit_logs` mechanism (Task 5); (7) added client-side numeric validation and `aria-label`s to the admin UI (Task 7); (8) added idempotency-under-the-new-code-path and anon-cannot-call-RPC-directly tests (Task 2). Explicitly and intentionally **not** added, with reasoning: optimistic/pessimistic locking on `shipping_rates` (single atomic upsert already removes the race window; added complexity is disproportionate to a 2-3-person admin tool); a toast/notification library to replace `alert()` (matches this codebase's existing, unanimous convention — not a regression); automated down-migrations (this repo has zero precedent for them — manual rollback SQL is documented inline in Tasks 1 and 2 instead); APM/monitoring integration (no such tooling exists anywhere in this codebase — the existing `console.log`/`log()` JSON-structured logging in the Edge Function, extended in Task 8, is the established observability mechanism and is used consistently).
