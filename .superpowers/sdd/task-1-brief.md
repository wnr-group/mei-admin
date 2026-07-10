### Task 1: Database schema — `category_rules`, `product_categories`, and backfill

**Files:**
- Create: `supabase/migrations/20260708140000_smart_collections_schema.sql`
- Modify: `tests/database/schema-verification.test.ts`

**Interfaces:**
- Produces: tables `public.category_rules(id, category_id, field, operator, value, created_at, updated_at)` with `CHECK` constraint `category_rules_valid_operator_for_field`, and `public.product_categories(id, product_id, category_id, source, created_at)` with `UNIQUE(product_id, category_id, source)` (named `product_categories_product_category_source_unique` — note this is 3 columns, not 2, so a manual and a rule row can coexist for the same product+category pair); new column `public.categories.rule_match_type` (`'ALL' | 'ANY'`, default `'ALL'`); enums `rule_field`, `rule_operator`, `category_match_type`, `product_category_source`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260708140000_smart_collections_schema.sql

-- Enums for rule-based category assignment
CREATE TYPE public.rule_field AS ENUM ('name', 'work_types', 'price');
CREATE TYPE public.rule_operator AS ENUM ('contains', 'is', 'greater_than', 'less_than');
CREATE TYPE public.category_match_type AS ENUM ('ALL', 'ANY');
CREATE TYPE public.product_category_source AS ENUM ('manual', 'rule');

-- Categories gain a match-type toggle for their conditions
ALTER TABLE public.categories
  ADD COLUMN rule_match_type public.category_match_type NOT NULL DEFAULT 'ALL';

-- One or more rules per category
CREATE TABLE public.category_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  field       public.rule_field NOT NULL,
  operator    public.rule_operator NOT NULL,
  value       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Defense in depth: name/work_types only support contains|is; price only
  -- supports is|greater_than|less_than. The app layer (lib/category-rules.ts,
  -- RuleFormDialog) already enforces this, but a DB CHECK means no client —
  -- including a future one — can ever store an invalid combination.
  CONSTRAINT category_rules_valid_operator_for_field CHECK (
    (field IN ('name', 'work_types') AND operator IN ('contains', 'is'))
    OR
    (field = 'price' AND operator IN ('is', 'greater_than', 'less_than'))
  )
);

CREATE INDEX idx_category_rules_category ON public.category_rules(category_id);

CREATE TRIGGER category_rules_set_updated_at
  BEFORE UPDATE ON public.category_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Many-to-many product <-> category membership.
-- source='manual' mirrors products.category_id (single-select on the product form).
-- source='rule' is written/removed exclusively by rule evaluation.
-- The unique constraint includes `source` (not just product_id+category_id) so a
-- manual row and a rule row can coexist for the SAME product+category pair —
-- e.g. a product manually assigned to "Bridal Lehengas" that also independently
-- matches that category's rules holds two rows here, one per source. Deleting
-- the rule (because a rule no longer matches) must never delete the manual row,
-- and vice versa; a shared (product_id, category_id) constraint would prevent
-- both rows existing at all and break that guarantee.
CREATE TABLE public.product_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  source      public.product_category_source NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_categories_product_category_source_unique UNIQUE (product_id, category_id, source)
);

CREATE INDEX idx_product_categories_product  ON public.product_categories(product_id);
CREATE INDEX idx_product_categories_category ON public.product_categories(category_id);

-- RLS
ALTER TABLE public.category_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage category_rules"
  ON public.category_rules FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins manage product_categories"
  ON public.product_categories FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Storefront (anon) needs to read product_categories to join products by category.
-- The joined products/categories rows are still gated by their own public-read
-- policies (status = 'PUBLISHED', deleted_at IS NULL, etc.) — this policy only
-- exposes the link rows themselves, which carry no sensitive data.
DO $$ BEGIN
  CREATE POLICY "Public reads product_categories"
    ON public.product_categories FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: give every existing product's manual category_id a matching
-- 'manual' product_categories row, so the storefront cutover in a later task
-- has no gap between "migration applied" and "admin re-saves every product".
INSERT INTO public.product_categories (product_id, category_id, source)
SELECT id, category_id, 'manual'
FROM public.products
WHERE category_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT ON CONSTRAINT product_categories_product_category_source_unique DO NOTHING;
```

- [ ] **Step 2: Apply the migration to the hosted Supabase project**

Run: `npx supabase db push`
Expected: CLI reports the new migration applied with no errors. This is the same hosted project `.env.local` points at (per `CLAUDE.md`), so both `mei-admin` and `../mei` see the new tables immediately.

- [ ] **Step 3: Extend the existing schema-verification integration test**

In `tests/database/schema-verification.test.ts`, find the `tables` array in the `'All tables exist with correct columns'` test (around line 16-20) and add the two new tables:

```ts
    const tables = [
      'size_systems', 'size_system_entries', 'product_colors',
      'product_variants', 'product_media', 'measurement_templates',
      'measurement_template_fields', 'blouse_configurations', 'order_item_measurements',
      'category_rules', 'product_categories'
    ];
```

- [ ] **Step 4: Run the schema verification test**

Run: `npx vitest run tests/database/schema-verification.test.ts`
Expected: PASS (requires `.env.local` with `SUPABASE_SERVICE_ROLE_KEY` pointed at the hosted project, per `CLAUDE.md`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260708140000_smart_collections_schema.sql tests/database/schema-verification.test.ts
git commit -m "feat(db): add category_rules and product_categories tables for smart collections"
```

---

