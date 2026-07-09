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
