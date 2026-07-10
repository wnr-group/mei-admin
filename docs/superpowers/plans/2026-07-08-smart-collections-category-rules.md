# Smart Collections: Rule-Based Category Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins define rules on a category (field/operator/value, matched ALL or ANY) that automatically link matching products into that category via a new `product_categories` join table, while preserving today's manual single-category assignment — and switch the storefront's `/shop/[slug]` route to read from that join table.

**Architecture:** A new `product_categories` join table (`product_id`, `category_id`, `source: 'manual' | 'rule'`) sits alongside the existing `products.category_id` FK. Every product save reconciles two independent sets of rows in that table: a `'manual'` row mirroring `category_id`, and zero-or-more `'rule'` rows from evaluating every category's `category_rules` against the product. A "Re-evaluate All Products" action re-runs this reconciliation for every product (used for backfill and after editing rules). The storefront's category page switches from `products.category_id = X` to joining through `product_categories`, so a product can now appear under multiple categories.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS + `@supabase/ssr`), TanStack Query, Vitest + Testing Library. Two repositories share one hosted Supabase project: `mei-admin` (this repo, admin UI + schema) and `../mei` (storefront, sibling git repo at `C:\Users\Eshwar\WNR\mei`).

## Global Constraints

- Do not run `npx supabase functions deploy` with no arguments (deploys `test-expedite-retry` to prod) — irrelevant here but stated in `CLAUDE.md` as a standing rule.
- `.env.local` in both repos already points at the hosted Supabase project (per `CLAUDE.md`) — migrations applied via `npx supabase db push` from `mei-admin` land on the same database the storefront reads.
- Follow existing service-layer conventions exactly: `createClient()` from `@/lib/supabase/client`, errors normalized via `toAppError`/`AppError` from `@/lib/errors`, Supabase responses cast through an untyped intermediate (`as never` on writes, `as { data: X | null; error: ... }` on reads) — see `services/categories.ts` and `services/products.ts`.
- `types/database.ts` and `../mei/src/lib/supabase/database.ts` are **hand-maintained**, not generated (no `supabase gen types` script exists in this repo) — edit them directly, one line per table, matching the existing style.
- **Migration contract (locked, hybrid model):** `products.category_id` remains the legacy/manual field indefinitely — this plan never modifies or drops it. `product_categories` becomes the storefront's source of truth. Manual and rule-based membership are tracked as **separate rows** in `product_categories`, distinguished by a `source` column, and the uniqueness constraint is `UNIQUE(product_id, category_id, source)` — **not** `UNIQUE(product_id, category_id)` — so a manual row and a rule row can coexist for the very same product+category pair without colliding. Existing manual assignments are backfilled into `product_categories` exactly once, in the Task 1 migration; nothing in this plan ever bulk-deletes `source = 'manual'` rows.
- **Reconciliation rules (locked):**
  - On every product create/update (Task 6), sync **both** independently: rebuild `source = 'manual'` rows from the current `category_id`, and rebuild `source = 'rule'` rows from rule evaluation. Each sync only ever inserts/deletes rows carrying its own `source` value — a rule-sync pass never deletes a `'manual'` row, and nothing outside a manual-sync pass ever deletes a `'manual'` row.
  - "Re-evaluate All Products" (Tasks 5, 8) rebuilds **only** `source = 'rule'` rows across every product. It never reads, inserts, or deletes `source = 'manual'` rows — manual assignments are only ever touched by a product's own save.
  - A category with zero rules is simply excluded from rule evaluation (never matches anyone by rule) but keeps every product manually assigned to it — an empty rule set can never empty a category or break evaluation.
- **Storefront determinism (locked):** `/shop/[slug]` (Task 10) reads through `product_categories` and deduplicates in application code so a product linked by both a `'manual'` and a `'rule'` row for the same category still appears exactly once. A category with no rules yet is not a special case in this query — its manually-assigned products are already `'manual'` rows in `product_categories` via the Task 1 backfill, so the page is never empty just because no rules exist.
- **Rollback safety:** because `category_id` is never modified or removed, Task 10's `getProductsByCategory` change is a pure query swap — if the storefront misbehaves post-launch, reverting just that one commit in the `mei` repo instantly restores the old `category_id`-based query with zero data loss (`product_categories` keeps accumulating in the background either way).
- **Non-goal:** CSV bulk import (`lib/csv-import/**`) does not call `createProduct`/`updateProduct` and is **not** wired to auto-evaluate rules on import. A bulk-imported product's `source = 'manual'` row is created the next time an admin edits it and saves through the product form. "Re-evaluate All Products" does **not** backfill manual rows for such products (per the reconciliation rule above, it only touches `source = 'rule'` rows) — only rule-matched membership is backfillable in bulk; manual membership backfill happens once, in the Task 1 migration, for whatever `category_id` values already existed at that time.
- **Non-goal:** `getRelatedProducts` on the storefront product detail page keeps using `products.category_id` (single category) for "You May Also Like" — not in the acceptance criteria, left unchanged.

---

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

### Task 2: TypeScript types for the new tables

**Files:**
- Modify: `types/database.ts`
- Modify: `types/index.ts`

**Interfaces:**
- Consumes: schema from Task 1.
- Produces: `Database['public']['Tables']['category_rules']`, `Database['public']['Tables']['product_categories']`; exported types `CategoryRule`, `CategoryRuleInsert`, `CategoryRuleUpdate`, `ProductCategory`, `ProductCategoryInsert`, `RuleField`, `RuleOperator`, `CategoryMatchType`, `ProductCategorySource`; `Category` row/insert/update gain `rule_match_type`.

- [ ] **Step 1: Add `rule_match_type` to the `categories` table entry**

In `types/database.ts`, replace the `categories` block (currently lines 17-21):

```ts
      categories: {
        Row: { id: string; name: string; slug: string; subtitle: string | null; description: string | null; image_url: string | null; is_active: boolean; sort_order: number; rule_match_type: 'ALL' | 'ANY'; created_at: string; updated_at: string; deleted_at: string | null }
        Insert: { id?: string; name: string; slug: string; subtitle?: string | null; description?: string | null; image_url?: string | null; is_active?: boolean; sort_order?: number; rule_match_type?: 'ALL' | 'ANY' }
        Update: { name?: string; slug?: string; subtitle?: string | null; description?: string | null; image_url?: string | null; is_active?: boolean; sort_order?: number; rule_match_type?: 'ALL' | 'ANY'; deleted_at?: string | null }
      }
```

- [ ] **Step 2: Add `category_rules` and `product_categories` table entries**

In `types/database.ts`, insert immediately after the `categories` block (before the `products` block):

```ts
      category_rules: {
        Row: { id: string; category_id: string; field: 'name' | 'work_types' | 'price'; operator: 'contains' | 'is' | 'greater_than' | 'less_than'; value: string; created_at: string; updated_at: string }
        Insert: { id?: string; category_id: string; field: 'name' | 'work_types' | 'price'; operator: 'contains' | 'is' | 'greater_than' | 'less_than'; value: string }
        Update: { field?: 'name' | 'work_types' | 'price'; operator?: 'contains' | 'is' | 'greater_than' | 'less_than'; value?: string }
      }
      product_categories: {
        Row: { id: string; product_id: string; category_id: string; source: 'manual' | 'rule'; created_at: string }
        Insert: { id?: string; product_id: string; category_id: string; source: 'manual' | 'rule' }
        Update: { source?: 'manual' | 'rule' }
      }
```

- [ ] **Step 3: Add the new enums**

In `types/database.ts`, in the `Enums` block (currently lines 68-74), add:

```ts
      rule_field: 'name' | 'work_types' | 'price'
      rule_operator: 'contains' | 'is' | 'greater_than' | 'less_than'
      category_match_type: 'ALL' | 'ANY'
      product_category_source: 'manual' | 'rule'
```

- [ ] **Step 4: Export the new app-level types**

In `types/index.ts`, after the existing `export type CategoryUpdate = Tables['categories']['Update']` line, add:

```ts
export type CategoryRule = Tables['category_rules']['Row']
export type CategoryRuleInsert = Tables['category_rules']['Insert']
export type CategoryRuleUpdate = Tables['category_rules']['Update']
export type ProductCategory = Tables['product_categories']['Row']
export type ProductCategoryInsert = Tables['product_categories']['Insert']

export type RuleField = Database['public']['Enums']['rule_field']
export type RuleOperator = Database['public']['Enums']['rule_operator']
export type CategoryMatchType = Database['public']['Enums']['category_match_type']
export type ProductCategorySource = Database['public']['Enums']['product_category_source']
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (existing `Category` consumers still compile since `rule_match_type` is additive).

- [ ] **Step 6: Commit**

```bash
git add types/database.ts types/index.ts
git commit -m "feat(types): add category_rules and product_categories types"
```

---

### Task 3: Rule evaluation logic (pure, unit-tested)

**Files:**
- Create: `lib/category-rules.ts`
- Test: `__tests__/lib/category-rules.test.ts`

**Interfaces:**
- Consumes: `RuleField`, `RuleOperator`, `CategoryMatchType` from `@/types` (Task 2).
- Produces: `OPERATORS_BY_FIELD: Record<RuleField, RuleOperator[]>`, `RuleInput = { field: RuleField; operator: RuleOperator; value: string }`, `RuleEvaluableProduct = { name: string; work_types: string[]; price: number }`, `evaluateRule(product, rule): boolean`, `evaluateCategoryRules(product, rules, matchType): boolean`. These exact names/signatures are relied on by Tasks 5 and 8.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/category-rules.test.ts
import { describe, it, expect } from 'vitest'
import { evaluateRule, evaluateCategoryRules, OPERATORS_BY_FIELD } from '@/lib/category-rules'

const product = { name: 'Zardozi Bridal Lehenga', work_types: ['ZARDOZI', 'AARI'], price: 45000 }

describe('OPERATORS_BY_FIELD', () => {
  it('restricts name and work_types to contains/is', () => {
    expect(OPERATORS_BY_FIELD.name).toEqual(['contains', 'is'])
    expect(OPERATORS_BY_FIELD.work_types).toEqual(['contains', 'is'])
  })

  it('restricts price to is/greater_than/less_than', () => {
    expect(OPERATORS_BY_FIELD.price).toEqual(['is', 'greater_than', 'less_than'])
  })
})

describe('evaluateRule — name', () => {
  it('contains matches case-insensitive substring', () => {
    expect(evaluateRule(product, { field: 'name', operator: 'contains', value: 'bridal' })).toBe(true)
    expect(evaluateRule(product, { field: 'name', operator: 'contains', value: 'saree' })).toBe(false)
  })

  it('is matches case-insensitive exact name', () => {
    expect(evaluateRule(product, { field: 'name', operator: 'is', value: 'zardozi bridal lehenga' })).toBe(true)
    expect(evaluateRule(product, { field: 'name', operator: 'is', value: 'bridal' })).toBe(false)
  })
})

describe('evaluateRule — work_types', () => {
  it('contains matches when the array includes the value, case-insensitive', () => {
    expect(evaluateRule(product, { field: 'work_types', operator: 'contains', value: 'aari' })).toBe(true)
    expect(evaluateRule(product, { field: 'work_types', operator: 'contains', value: 'kundan' })).toBe(false)
  })

  it('is matches only when the array is exactly that single value', () => {
    expect(evaluateRule({ ...product, work_types: ['ZARDOZI'] }, { field: 'work_types', operator: 'is', value: 'zardozi' })).toBe(true)
    expect(evaluateRule(product, { field: 'work_types', operator: 'is', value: 'zardozi' })).toBe(false)
  })
})

describe('evaluateRule — price', () => {
  it('is matches exact price', () => {
    expect(evaluateRule(product, { field: 'price', operator: 'is', value: '45000' })).toBe(true)
    expect(evaluateRule(product, { field: 'price', operator: 'is', value: '1' })).toBe(false)
  })

  it('greater_than and less_than compare numerically', () => {
    expect(evaluateRule(product, { field: 'price', operator: 'greater_than', value: '40000' })).toBe(true)
    expect(evaluateRule(product, { field: 'price', operator: 'greater_than', value: '50000' })).toBe(false)
    expect(evaluateRule(product, { field: 'price', operator: 'less_than', value: '50000' })).toBe(true)
  })

  it('returns false when the rule value is not numeric', () => {
    expect(evaluateRule(product, { field: 'price', operator: 'greater_than', value: 'abc' })).toBe(false)
  })
})

describe('evaluateRule — invalid operator/field combination', () => {
  it('returns false for greater_than on name', () => {
    expect(evaluateRule(product, { field: 'name', operator: 'greater_than', value: '10' })).toBe(false)
  })
})

describe('evaluateCategoryRules', () => {
  const rules = [
    { field: 'work_types' as const, operator: 'contains' as const, value: 'zardozi' },
    { field: 'price' as const, operator: 'greater_than' as const, value: '40000' },
  ]

  it('ALL requires every rule to match', () => {
    expect(evaluateCategoryRules(product, rules, 'ALL')).toBe(true)
    expect(evaluateCategoryRules({ ...product, price: 100 }, rules, 'ALL')).toBe(false)
  })

  it('ANY requires at least one rule to match', () => {
    expect(evaluateCategoryRules({ ...product, price: 100 }, rules, 'ANY')).toBe(true)
    expect(evaluateCategoryRules({ ...product, price: 100, work_types: ['KUNDAN'] }, rules, 'ANY')).toBe(false)
  })

  it('returns false when there are no rules', () => {
    expect(evaluateCategoryRules(product, [], 'ALL')).toBe(false)
    expect(evaluateCategoryRules(product, [], 'ANY')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run __tests__/lib/category-rules.test.ts`
Expected: FAIL — `Cannot find module '@/lib/category-rules'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/category-rules.ts
import type { RuleField, RuleOperator, CategoryMatchType } from '@/types'

export const OPERATORS_BY_FIELD: Record<RuleField, RuleOperator[]> = {
  name: ['contains', 'is'],
  work_types: ['contains', 'is'],
  price: ['is', 'greater_than', 'less_than'],
}

export interface RuleInput {
  field: RuleField
  operator: RuleOperator
  value: string
}

export interface RuleEvaluableProduct {
  name: string
  work_types: string[]
  price: number
}

function evaluateNameRule(product: RuleEvaluableProduct, rule: RuleInput): boolean {
  const name = product.name.toLowerCase()
  const value = rule.value.toLowerCase()
  if (rule.operator === 'contains') return name.includes(value)
  if (rule.operator === 'is') return name === value
  return false
}

function evaluateWorkTypesRule(product: RuleEvaluableProduct, rule: RuleInput): boolean {
  const types = (product.work_types ?? []).map((t) => t.toLowerCase())
  const value = rule.value.toLowerCase()
  if (rule.operator === 'contains') return types.includes(value)
  if (rule.operator === 'is') return types.length === 1 && types[0] === value
  return false
}

function evaluatePriceRule(product: RuleEvaluableProduct, rule: RuleInput): boolean {
  const numericValue = Number(rule.value)
  if (Number.isNaN(numericValue)) return false
  if (rule.operator === 'is') return product.price === numericValue
  if (rule.operator === 'greater_than') return product.price > numericValue
  if (rule.operator === 'less_than') return product.price < numericValue
  return false
}

export function evaluateRule(product: RuleEvaluableProduct, rule: RuleInput): boolean {
  switch (rule.field) {
    case 'name': return evaluateNameRule(product, rule)
    case 'work_types': return evaluateWorkTypesRule(product, rule)
    case 'price': return evaluatePriceRule(product, rule)
    default: return false
  }
}

export function evaluateCategoryRules(
  product: RuleEvaluableProduct,
  rules: RuleInput[],
  matchType: CategoryMatchType
): boolean {
  if (rules.length === 0) return false
  return matchType === 'ALL' ? rules.every((r) => evaluateRule(product, r)) : rules.some((r) => evaluateRule(product, r))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run __tests__/lib/category-rules.test.ts`
Expected: PASS (17 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/category-rules.ts __tests__/lib/category-rules.test.ts
git commit -m "feat(category-rules): add pure rule evaluation logic"
```

---

### Task 4: Category rules CRUD service

**Files:**
- Create: `services/category-rules.ts`
- Test: `__tests__/services/category-rules.test.ts`

**Interfaces:**
- Consumes: `CategoryRule`, `CategoryRuleInsert`, `CategoryRuleUpdate` from `@/types` (Task 2); `createClient` from `@/lib/supabase/client`; `toAppError`, `AppError` from `@/lib/errors`; `OPERATORS_BY_FIELD` from `@/lib/category-rules` (Task 3).
- Produces: `getCategoryRules(categoryId: string): Promise<CategoryRule[]>`, `createCategoryRule(rule: CategoryRuleInsert): Promise<CategoryRule>`, `updateCategoryRule(id: string, updates: CategoryRuleUpdate): Promise<CategoryRule>`, `deleteCategoryRule(id: string): Promise<void>`. Relied on by Task 7 hooks. `createCategoryRule`/`updateCategoryRule` validate the operator is legal for the field *before* hitting the database, throwing a clean `AppError('VALIDATION_ERROR', ...)` instead of surfacing the raw Postgres `category_rules_valid_operator_for_field` CHECK violation from Task 1 — that DB constraint is the backstop, this is the friendly first line of defense.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/services/category-rules.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { getCategoryRules, createCategoryRule, updateCategoryRule, deleteCategoryRule } = await import('@/services/category-rules')

interface MockChain extends Record<string, unknown> {
  then: (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
}

function createMockChain(finalValue: unknown): MockChain {
  const chain: MockChain = {} as MockChain
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single']
  methods.forEach((m) => { chain[m] = vi.fn(() => chain) })
  const promise = Promise.resolve(finalValue)
  chain.then = (onFulfilled, onRejected) => promise.then(onFulfilled, onRejected)
  mockFrom.mockReturnValue(chain)
  return chain
}

describe('getCategoryRules', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns rules for a category ordered by created_at', async () => {
    createMockChain({ data: [{ id: 'r1', category_id: 'c1', field: 'name', operator: 'contains', value: 'lehenga' }], error: null })
    const result = await getCategoryRules('c1')
    expect(result).toHaveLength(1)
    expect(mockFrom).toHaveBeenCalledWith('category_rules')
  })

  it('returns empty array when no data', async () => {
    createMockChain({ data: null, error: null })
    const result = await getCategoryRules('c1')
    expect(result).toEqual([])
  })

  it('throws on Supabase error', async () => {
    createMockChain({ data: null, error: { message: 'DB error' } })
    await expect(getCategoryRules('c1')).rejects.toThrow('DB error')
  })
})

describe('createCategoryRule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates and returns a rule', async () => {
    const inserted = { id: 'r1', category_id: 'c1', field: 'price', operator: 'greater_than', value: '1000' }
    createMockChain({ data: inserted, error: null })
    const result = await createCategoryRule({ category_id: 'c1', field: 'price', operator: 'greater_than', value: '1000' })
    expect(result).toEqual(inserted)
    expect(mockFrom).toHaveBeenCalledWith('category_rules')
  })

  it('throws on Supabase error', async () => {
    createMockChain({ data: null, error: { message: 'Insert failed' } })
    await expect(createCategoryRule({ category_id: 'c1', field: 'price', operator: 'is', value: '1' })).rejects.toThrow('Insert failed')
  })

  it('rejects an operator that is invalid for the field before calling Supabase', async () => {
    createMockChain({ data: null, error: null })
    await expect(
      createCategoryRule({ category_id: 'c1', field: 'name', operator: 'greater_than', value: 'x' })
    ).rejects.toThrow('greater_than')
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('updateCategoryRule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates and returns the rule', async () => {
    const updated = { id: 'r1', category_id: 'c1', field: 'name', operator: 'is', value: 'saree' }
    const chain = createMockChain({ data: updated, error: null })
    const result = await updateCategoryRule('r1', { field: 'name', operator: 'is', value: 'saree' })
    expect(result).toEqual(updated)
    expect(chain.eq).toHaveBeenCalledWith('id', 'r1')
  })

  it('throws on Supabase error', async () => {
    createMockChain({ data: null, error: { message: 'Update failed' } })
    await expect(updateCategoryRule('r1', { value: 'x' })).rejects.toThrow('Update failed')
  })

  it('rejects an operator that is invalid for the field before calling Supabase', async () => {
    createMockChain({ data: null, error: null })
    await expect(
      updateCategoryRule('r1', { field: 'work_types', operator: 'less_than', value: 'x' })
    ).rejects.toThrow('less_than')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('allows a partial update that only changes value, without needing field/operator', async () => {
    const updated = { id: 'r1', category_id: 'c1', field: 'name', operator: 'contains', value: 'saree' }
    createMockChain({ data: updated, error: null })
    const result = await updateCategoryRule('r1', { value: 'saree' })
    expect(result).toEqual(updated)
  })
})

describe('deleteCategoryRule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes the rule', async () => {
    const chain = createMockChain({ error: null })
    await deleteCategoryRule('r1')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'r1')
  })

  it('throws on Supabase error', async () => {
    createMockChain({ error: { message: 'Delete failed' } })
    await expect(deleteCategoryRule('r1')).rejects.toThrow('Delete failed')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run __tests__/services/category-rules.test.ts`
Expected: FAIL — `Cannot find module '@/services/category-rules'`

- [ ] **Step 3: Write the implementation**

```ts
// services/category-rules.ts
import { createClient } from '@/lib/supabase/client'
import { toAppError, AppError } from '@/lib/errors'
import { OPERATORS_BY_FIELD } from '@/lib/category-rules'
import type { CategoryRule, CategoryRuleInsert, CategoryRuleUpdate } from '@/types'

// Only validates when both field and operator are present together (always true for
// createCategoryRule; for updateCategoryRule a value-only partial update skips this
// and relies on the category_rules_valid_operator_for_field DB CHECK from Task 1).
function assertValidOperatorForField(field?: CategoryRuleInsert['field'], operator?: CategoryRuleInsert['operator']) {
  if (!field || !operator) return
  if (!OPERATORS_BY_FIELD[field].includes(operator)) {
    throw new AppError('VALIDATION_ERROR', `Operator "${operator}" is not valid for field "${field}"`)
  }
}

export async function getCategoryRules(categoryId: string): Promise<CategoryRule[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('category_rules')
    .select('*')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: true })

  if (error) throw toAppError(new Error(error.message))
  return (data as CategoryRule[] | null) ?? []
}

export async function createCategoryRule(rule: CategoryRuleInsert): Promise<CategoryRule> {
  assertValidOperatorForField(rule.field, rule.operator)
  const supabase = createClient()
  const response = await supabase.from('category_rules').insert([rule] as never).select().single()
  const { data, error } = response as { data: CategoryRule | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))
  if (!data) throw new AppError('NOT_FOUND', 'Category rule not returned after insert')
  return data
}

export async function updateCategoryRule(id: string, updates: CategoryRuleUpdate): Promise<CategoryRule> {
  assertValidOperatorForField(updates.field, updates.operator)
  const supabase = createClient()
  const response = await supabase.from('category_rules').update(updates as never).eq('id', id).select().single()
  const { data, error } = response as { data: CategoryRule | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))
  if (!data) throw new AppError('NOT_FOUND', 'Category rule not returned after update')
  return data
}

export async function deleteCategoryRule(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('category_rules').delete().eq('id', id)
  if (error) throw toAppError(new Error(error.message))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run __tests__/services/category-rules.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add services/category-rules.ts __tests__/services/category-rules.test.ts
git commit -m "feat(category-rules): add CRUD service for category rules"
```

---

### Task 5: Product-category sync service (rule + manual reconciliation)

**Files:**
- Create: `services/product-categories.ts`
- Test: `__tests__/services/product-categories.test.ts`

**Interfaces:**
- Consumes: `evaluateCategoryRules`, `RuleInput` from `@/lib/category-rules` (Task 3); `createClient` from `@/lib/supabase/client`; `toAppError` from `@/lib/errors`.
- Produces: `RuleEvaluableProductRow = { id: string; name: string; work_types: string[]; price: number; category_id: string | null }`.
  - `syncRuleCategoryAssignments(product: RuleEvaluableProductRow): Promise<void>` — reconciles **only** `source = 'rule'` rows for this product against current rule matches. Never reads or writes `source = 'manual'` rows.
  - `syncManualCategoryAssignment(product: RuleEvaluableProductRow): Promise<void>` — reconciles **only** the single `source = 'manual'` row for this product against its current `category_id`. Never reads or writes `source = 'rule'` rows.
  - `syncProductCategoryAssignments(product: RuleEvaluableProductRow): Promise<void>` — calls both of the above. This is the full sync used on product save; relied on by Task 6.
  - `reevaluateAllProducts(): Promise<{ evaluated: number }>` — loops every non-deleted product calling **only** `syncRuleCategoryAssignments` (per the locked reconciliation rule: bulk re-evaluation never touches manual rows). Relied on by Task 7's hook.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/services/product-categories.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { syncProductCategoryAssignments, syncRuleCategoryAssignments, reevaluateAllProducts } = await import('@/services/product-categories')

interface MockChain extends Record<string, unknown> {
  then: (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
}

function chainResolving(finalValue: unknown): MockChain {
  const chain: MockChain = {} as MockChain
  const methods = ['select', 'insert', 'delete', 'eq', 'in', 'is', 'order']
  methods.forEach((m) => { chain[m] = vi.fn(() => chain) })
  const promise = Promise.resolve(finalValue)
  chain.then = (onFulfilled, onRejected) => promise.then(onFulfilled, onRejected)
  return chain
}

const product = { id: 'p1', name: 'Zardozi Lehenga', work_types: ['ZARDOZI'], price: 45000, category_id: 'cat-manual' }

// categories select returns categories-with-rules; product_categories select/insert/delete
// are dispatched per-call based on the arguments the code passes, in call order.
function mockSequence(responses: unknown[]) {
  let call = 0
  mockFrom.mockImplementation(() => {
    const response = responses[call] ?? { data: null, error: null }
    call += 1
    return chainResolving(response)
  })
}

describe('syncProductCategoryAssignments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts a rule row when a category rule matches, and a manual row from category_id', async () => {
    mockSequence([
      // 1. categories-with-rules
      { data: [{ id: 'cat-rule', rule_match_type: 'ALL', category_rules: [{ field: 'work_types', operator: 'contains', value: 'zardozi' }] }], error: null },
      // 2. existing rule rows for this product
      { data: [], error: null },
      // 3. insert rule rows
      { data: null, error: null },
      // 4. existing manual rows for this product
      { data: [], error: null },
      // 5. insert manual row
      { data: null, error: null },
    ])

    await syncProductCategoryAssignments(product)

    expect(mockFrom).toHaveBeenCalledWith('categories')
    expect(mockFrom).toHaveBeenCalledWith('product_categories')
  })

  it('removes a stale rule row when the product no longer matches', async () => {
    mockSequence([
      { data: [{ id: 'cat-rule', rule_match_type: 'ALL', category_rules: [{ field: 'price', operator: 'greater_than', value: '999999' }] }], error: null }, // no longer matches (price too low)
      { data: [{ id: 'row1', category_id: 'cat-rule' }], error: null }, // existing rule row for cat-rule
      { data: null, error: null }, // delete stale rule row
      { data: [], error: null }, // existing manual rows
      { data: null, error: null }, // insert manual row
    ])

    await syncProductCategoryAssignments(product)
    expect(mockFrom).toHaveBeenCalledWith('product_categories')
  })

  it('does not insert a manual row when category_id is null', async () => {
    mockSequence([
      { data: [], error: null }, // no categories with rules
      { data: [], error: null }, // existing rule rows
      { data: [], error: null }, // existing manual rows
    ])

    await syncProductCategoryAssignments({ ...product, category_id: null })
    // 3 calls total: categories, product_categories (rule read), product_categories (manual read) — no inserts
    expect(mockFrom).toHaveBeenCalledTimes(3)
  })

  it('ignores a category that has zero rules — an empty rule set never matches and never breaks evaluation', async () => {
    mockSequence([
      { data: [{ id: 'cat-empty', rule_match_type: 'ALL', category_rules: [] }], error: null }, // category exists but getCategoriesWithRules filters it out (0 rules)
      { data: [], error: null }, // existing rule rows — nothing to insert since cat-empty was filtered out
      { data: [], error: null }, // existing manual rows
    ])

    await syncProductCategoryAssignments({ ...product, category_id: null })
    // Same shape as "no categories with rules": categories, rule read, manual read — no inserts for cat-empty
    expect(mockFrom).toHaveBeenCalledTimes(3)
  })

  it('matches a product into multiple categories at once by rule', async () => {
    mockSequence([
      { data: [
        { id: 'cat-a', rule_match_type: 'ALL', category_rules: [{ field: 'work_types', operator: 'contains', value: 'zardozi' }] },
        { id: 'cat-b', rule_match_type: 'ALL', category_rules: [{ field: 'price', operator: 'greater_than', value: '1000' }] },
      ], error: null },
      { data: [], error: null }, // existing rule rows
      { data: null, error: null }, // insert rule rows for both cat-a and cat-b in one call
      { data: [], error: null }, // existing manual rows
      { data: null, error: null }, // insert manual row
    ])

    await syncProductCategoryAssignments(product)
    expect(mockFrom).toHaveBeenCalledTimes(5)
  })

  it('keeps only a manual row when the product matches no rules (manual-only membership)', async () => {
    mockSequence([
      { data: [], error: null }, // no categories with rules at all
      { data: [], error: null }, // existing rule rows
      { data: [], error: null }, // existing manual rows
      { data: null, error: null }, // insert manual row for product.category_id
    ])

    await syncProductCategoryAssignments(product) // product.category_id = 'cat-manual'
    expect(mockFrom).toHaveBeenCalledTimes(4)
  })

  it('keeps both a manual row and a rule row for the same category simultaneously', async () => {
    mockSequence([
      // cat-manual (== product.category_id) also independently matches a rule
      { data: [{ id: 'cat-manual', rule_match_type: 'ALL', category_rules: [{ field: 'work_types', operator: 'contains', value: 'zardozi' }] }], error: null },
      { data: [], error: null }, // existing rule rows
      { data: null, error: null }, // insert rule row: (product, cat-manual, source='rule')
      { data: [], error: null }, // existing manual rows
      { data: null, error: null }, // insert manual row: (product, cat-manual, source='manual') — distinct row, allowed by the 3-column unique constraint
    ])

    await syncProductCategoryAssignments(product)
    expect(mockFrom).toHaveBeenCalledTimes(5)
  })
})

describe('syncRuleCategoryAssignments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('only reads/writes rule rows — never touches manual rows', async () => {
    mockSequence([
      { data: [{ id: 'cat-rule', rule_match_type: 'ALL', category_rules: [{ field: 'work_types', operator: 'contains', value: 'zardozi' }] }], error: null },
      { data: [], error: null }, // existing rule rows
      { data: null, error: null }, // insert rule row
    ])

    await syncRuleCategoryAssignments(product)
    // Exactly 3 calls: categories, product_categories(read rule), product_categories(insert rule) — no manual-row calls at all
    expect(mockFrom).toHaveBeenCalledTimes(3)
  })
})

describe('reevaluateAllProducts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('syncs every non-deleted product and returns the count', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'products') {
        return chainResolving({ data: [product], error: null })
      }
      if (table === 'categories') {
        return chainResolving({ data: [], error: null })
      }
      return chainResolving({ data: [], error: null })
    })

    const result = await reevaluateAllProducts()
    expect(result).toEqual({ evaluated: 1 })
  })

  it('rebuilds only rule-based assignments and never reads or writes manual rows', async () => {
    const calledTables: string[] = []
    mockFrom.mockImplementation((table: string) => {
      calledTables.push(table)
      if (table === 'products') return chainResolving({ data: [product], error: null })
      if (table === 'categories') return chainResolving({ data: [], error: null })
      return chainResolving({ data: [], error: null }) // product_categories — read for source='rule' only
    })

    await reevaluateAllProducts()
    // products (fetch all) -> categories (rule lookup) -> product_categories (rule read) = 3 calls total.
    // If this ever grows to 4, it means a manual-row call snuck in — reevaluateAllProducts must never do that.
    expect(calledTables).toHaveLength(3)
  })

  it('throws on Supabase error fetching products', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'products') return chainResolving({ data: null, error: { message: 'DB error' } })
      return chainResolving({ data: [], error: null })
    })
    await expect(reevaluateAllProducts()).rejects.toThrow('DB error')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run __tests__/services/product-categories.test.ts`
Expected: FAIL — `Cannot find module '@/services/product-categories'`

- [ ] **Step 3: Write the implementation**

```ts
// services/product-categories.ts
import { createClient } from '@/lib/supabase/client'
import { toAppError } from '@/lib/errors'
import { evaluateCategoryRules, type RuleInput } from '@/lib/category-rules'
import type { CategoryMatchType, ProductCategorySource } from '@/types'

export interface RuleEvaluableProductRow {
  id: string
  name: string
  work_types: string[]
  price: number
  category_id: string | null
}

interface CategoryWithRules {
  id: string
  rule_match_type: CategoryMatchType
  category_rules: RuleInput[]
}

async function getCategoriesWithRules(): Promise<CategoryWithRules[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('id, rule_match_type, category_rules(field, operator, value)')
    .is('deleted_at', null)

  if (error) throw toAppError(new Error(error.message))
  return ((data as unknown as CategoryWithRules[] | null) ?? []).filter(
    (c) => (c.category_rules ?? []).length > 0
  )
}

async function reconcileSource(
  productId: string,
  source: ProductCategorySource,
  desiredCategoryIds: string[]
): Promise<void> {
  const supabase = createClient()

  const { data: existingRows, error: readError } = await supabase
    .from('product_categories')
    .select('id, category_id')
    .eq('product_id', productId)
    .eq('source', source)
  if (readError) throw toAppError(new Error(readError.message))

  const rows = (existingRows as { id: string; category_id: string }[] | null) ?? []
  const existingIds = new Set(rows.map((r) => r.category_id))
  const desiredIds = new Set(desiredCategoryIds)

  const toInsert = desiredCategoryIds.filter((id) => !existingIds.has(id))
  const staleRowIds = rows.filter((r) => !desiredIds.has(r.category_id)).map((r) => r.id)

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from('product_categories')
      .insert(toInsert.map((category_id) => ({ product_id: productId, category_id, source })) as never)
    // 23505 = unique_violation: another concurrent save already inserted this pair — safe to ignore
    if (error && error.code !== '23505') throw toAppError(new Error(error.message))
  }

  if (staleRowIds.length > 0) {
    const { error } = await supabase.from('product_categories').delete().in('id', staleRowIds)
    if (error) throw toAppError(new Error(error.message))
  }
}

// Reconciles ONLY source='rule' rows against current rule matches. Never reads
// or writes source='manual' rows — safe to call in bulk from reevaluateAllProducts
// without disturbing anyone's manual category assignment.
export async function syncRuleCategoryAssignments(product: RuleEvaluableProductRow): Promise<void> {
  const categoriesWithRules = await getCategoriesWithRules()
  const matchedCategoryIds = categoriesWithRules
    .filter((c) => evaluateCategoryRules(product, c.category_rules, c.rule_match_type))
    .map((c) => c.id)

  await reconcileSource(product.id, 'rule', matchedCategoryIds)
}

// Reconciles ONLY the single source='manual' row against the product's current
// category_id. Never reads or writes source='rule' rows.
export async function syncManualCategoryAssignment(product: RuleEvaluableProductRow): Promise<void> {
  await reconcileSource(product.id, 'manual', product.category_id ? [product.category_id] : [])
}

// Full sync used on every product create/update (Task 6) — runs both reconciliations.
export async function syncProductCategoryAssignments(product: RuleEvaluableProductRow): Promise<void> {
  await syncRuleCategoryAssignments(product)
  await syncManualCategoryAssignment(product)
}

// Bulk re-evaluation. Per the locked reconciliation rule, this rebuilds ONLY
// rule-based assignments across every product — it must never touch manual rows,
// so it calls syncRuleCategoryAssignments directly, not the full sync.
export async function reevaluateAllProducts(): Promise<{ evaluated: number }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, work_types, price, category_id')
    .is('deleted_at', null)
  if (error) throw toAppError(new Error(error.message))

  const products = (data as RuleEvaluableProductRow[] | null) ?? []
  for (const product of products) {
    await syncRuleCategoryAssignments(product)
  }
  return { evaluated: products.length }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run __tests__/services/product-categories.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add services/product-categories.ts __tests__/services/product-categories.test.ts
git commit -m "feat(category-rules): add product-category sync and re-evaluate-all service"
```

---

### Task 6: Wire sync into product create/update

**Files:**
- Modify: `services/products.ts`
- Modify: `__tests__/services/products.test.ts`

**Interfaces:**
- Consumes: `syncProductCategoryAssignments` from `@/services/product-categories` (Task 5).
- Produces: `createProduct` and `updateProduct` now call `syncProductCategoryAssignments` with the saved row after every successful write, swallowing (and logging) sync failures so a rule-sync bug never blocks a product save.

- [ ] **Step 1: Mock the new dependency in the existing test file so current assertions don't break**

At the top of `__tests__/services/products.test.ts`, after the existing `vi.mock('@/lib/supabase/client', ...)` block (around line 6), add:

```ts
const mockSyncProductCategoryAssignments = vi.fn().mockResolvedValue(undefined)
vi.mock('@/services/product-categories', () => ({
  syncProductCategoryAssignments: (...args: unknown[]) => mockSyncProductCategoryAssignments(...args),
}))
```

- [ ] **Step 2: Write the new failing tests**

In `__tests__/services/products.test.ts`, inside the existing `describe('createProduct', ...)` block, add:

```ts
  it('syncs product-category assignments after a successful create', async () => {
    const newProduct = { id: '2', name: 'New Product', price: 200, status: 'DRAFT', work_types: [], category_id: 'cat-1' }
    createMockChainForQuery({ data: newProduct, error: null })
    mockSyncProductCategoryAssignments.mockClear()
    await createProduct({ name: 'New Product', price: 200, category_id: 'cat-1' })
    expect(mockSyncProductCategoryAssignments).toHaveBeenCalledWith(newProduct)
  })
```

And inside the existing `describe('updateProduct', ...)` block, add:

```ts
  it('syncs product-category assignments after a successful update', async () => {
    const updated = { id: '1', name: 'Updated', price: 150, work_types: [], category_id: 'cat-2' }
    createMockChainForQuery({ data: updated, error: null })
    mockSyncProductCategoryAssignments.mockClear()
    await updateProduct('1', { name: 'Updated', price: 150 })
    expect(mockSyncProductCategoryAssignments).toHaveBeenCalledWith(updated)
  })
```

- [ ] **Step 3: Run the tests to verify the new ones fail and existing ones still pass**

Run: `npx vitest run __tests__/services/products.test.ts`
Expected: the two new tests FAIL (`mockSyncProductCategoryAssignments` never called); all pre-existing tests in this file still PASS, including the call-count assertion in `describe('createProduct — slug disambiguation', ...)`, because the sync call is fully mocked and never touches `mockFrom`.

- [ ] **Step 4: Wire the sync call into `createProduct` and `updateProduct`**

In `services/products.ts`, add the import at the top:

```ts
import { syncProductCategoryAssignments } from '@/services/product-categories'
```

Add a helper near the bottom of the file (after `isUniqueSlugViolation`, before `deleteProduct`):

```ts
async function syncCategoriesOrLog(product: Product) {
  try {
    await syncProductCategoryAssignments(product)
  } catch (err) {
    console.error('[products] Failed to sync category assignments:', err)
  }
}
```

In the no-slug branch of `createProduct` (the block starting `if (!productWithCode.slug) {`), change:

```ts
    await logAuditEvent({ action: 'CREATE', resourceType: 'product', resourceId: data.id, newData: data as Json })
    return data as Product
  }
```

to:

```ts
    await logAuditEvent({ action: 'CREATE', resourceType: 'product', resourceId: data.id, newData: data as Json })
    await syncCategoriesOrLog(data)
    return data as Product
  }
```

In the slug-disambiguation loop inside `createProduct`, change:

```ts
    await logAuditEvent({ action: 'CREATE', resourceType: 'product', resourceId: data.id, newData: data as Json })
    return data as Product
  }

  throw new AppError('VALIDATION_ERROR', 'Unable to generate a unique product slug. Please try again.')
```

to:

```ts
    await logAuditEvent({ action: 'CREATE', resourceType: 'product', resourceId: data.id, newData: data as Json })
    await syncCategoriesOrLog(data)
    return data as Product
  }

  throw new AppError('VALIDATION_ERROR', 'Unable to generate a unique product slug. Please try again.')
```

In `updateProduct`, change:

```ts
  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'product',
    resourceId: id,
    newData: updates as Json,
  })

  return data as Product
```

to:

```ts
  await logAuditEvent({
    action: 'UPDATE',
    resourceType: 'product',
    resourceId: id,
    newData: updates as Json,
  })
  await syncCategoriesOrLog(data)

  return data as Product
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run __tests__/services/products.test.ts`
Expected: PASS, including the previously-existing `expect(mockFrom).toHaveBeenCalledTimes(2)` assertion.

- [ ] **Step 6: Commit**

```bash
git add services/products.ts __tests__/services/products.test.ts
git commit -m "feat(category-rules): sync category assignments on every product save"
```

---

### Task 7: React Query hooks

**Files:**
- Create: `hooks/use-category-rules.ts`
- Create: `hooks/use-product-categories.ts`

**Interfaces:**
- Consumes: `getCategoryRules`, `createCategoryRule`, `updateCategoryRule`, `deleteCategoryRule` from `@/services/category-rules` (Task 4); `reevaluateAllProducts` from `@/services/product-categories` (Task 5); `CategoryRuleInsert`, `CategoryRuleUpdate` from `@/types`.
- Produces: `useCategoryRules(categoryId)`, `useCreateCategoryRule(categoryId)`, `useUpdateCategoryRule(categoryId)`, `useDeleteCategoryRule(categoryId)`, `useReevaluateAllProducts()`. Relied on by Task 8's components.

- [ ] **Step 1: Write `hooks/use-category-rules.ts`**

```ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCategoryRules, createCategoryRule, updateCategoryRule, deleteCategoryRule } from '@/services/category-rules'
import type { CategoryRuleInsert, CategoryRuleUpdate } from '@/types'

const queryKeys = {
  rules: (categoryId: string) => ['categories', categoryId, 'rules'] as const,
}

export function useCategoryRules(categoryId: string) {
  return useQuery({
    queryKey: queryKeys.rules(categoryId),
    queryFn: () => getCategoryRules(categoryId),
    enabled: !!categoryId,
  })
}

export function useCreateCategoryRule(categoryId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rule: CategoryRuleInsert) => createCategoryRule(rule),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rules(categoryId) }),
  })
}

export function useUpdateCategoryRule(categoryId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CategoryRuleUpdate }) => updateCategoryRule(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rules(categoryId) }),
  })
}

export function useDeleteCategoryRule(categoryId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCategoryRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rules(categoryId) }),
  })
}
```

- [ ] **Step 2: Write `hooks/use-product-categories.ts`**

```ts
'use client'

import { useMutation } from '@tanstack/react-query'
import { reevaluateAllProducts } from '@/services/product-categories'

export function useReevaluateAllProducts() {
  return useMutation({
    mutationFn: () => reevaluateAllProducts(),
  })
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (These hooks are exercised end-to-end by Task 8's component tests, matching the existing convention where `hooks/use-product-colors.ts` has no dedicated test file.)

- [ ] **Step 4: Commit**

```bash
git add hooks/use-category-rules.ts hooks/use-product-categories.ts
git commit -m "feat(category-rules): add React Query hooks for category rules and re-evaluation"
```

---

### Task 8: Conditions panel UI components

**Files:**
- Create: `components/categories/rules/RuleFormDialog.tsx`
- Create: `components/categories/rules/DeleteRuleDialog.tsx`
- Create: `components/categories/rules/RuleList.tsx`
- Test: `__tests__/components/categories/rules/RuleFormDialog.test.tsx`
- Test: `__tests__/components/categories/rules/RuleList.test.tsx`

**Interfaces:**
- Consumes: hooks from Task 7; `OPERATORS_BY_FIELD` from `@/lib/category-rules` (Task 3); `CategoryRule`, `RuleField`, `RuleOperator` from `@/types`; `EmptyState`, `ErrorState`, `Skeleton` from `@/components/ui/*`.
- Produces: `<RuleList categoryId matchType onMatchTypeChange />` — the single component Task 9 embeds into the category edit page. `matchType: 'ALL' | 'ANY'`, `onMatchTypeChange: (mt: 'ALL' | 'ANY') => void` are controlled by the parent, matching how the rest of `CategoryForm` batches field state.

- [ ] **Step 1: Write the failing test for `RuleFormDialog`**

```tsx
// __tests__/components/categories/rules/RuleFormDialog.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/category-rules', () => ({
  createCategoryRule: vi.fn().mockResolvedValue({ id: '1', category_id: 'c1', field: 'name', operator: 'contains', value: 'lehenga' }),
  updateCategoryRule: vi.fn().mockResolvedValue({ id: '1', category_id: 'c1', field: 'name', operator: 'contains', value: 'lehenga' }),
  getCategoryRules: vi.fn().mockResolvedValue([]),
  deleteCategoryRule: vi.fn(),
}))

const { default: RuleFormDialog } = await import('@/components/categories/rules/RuleFormDialog')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('RuleFormDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <RuleFormDialog categoryId="c1" open={false} onClose={() => {}} />,
      { wrapper }
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows Field, Operator, and Value inputs when open', () => {
    render(<RuleFormDialog categoryId="c1" open={true} onClose={() => {}} />, { wrapper })
    expect(screen.getByLabelText('Field')).toBeInTheDocument()
    expect(screen.getByLabelText('Operator')).toBeInTheDocument()
    expect(screen.getByLabelText('Value')).toBeInTheDocument()
  })

  it('restricts operator options to those valid for the selected field', () => {
    render(<RuleFormDialog categoryId="c1" open={true} onClose={() => {}} />, { wrapper })
    fireEvent.change(screen.getByLabelText('Field'), { target: { value: 'price' } })
    const operatorSelect = screen.getByLabelText('Operator') as HTMLSelectElement
    const optionValues = Array.from(operatorSelect.options).map((o) => o.value)
    expect(optionValues).toEqual(['is', 'greater_than', 'less_than'])
  })

  it('calls onClose when Cancel clicked', () => {
    const onClose = vi.fn()
    render(<RuleFormDialog categoryId="c1" open={true} onClose={onClose} />, { wrapper })
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows Edit Condition title when initialRule provided', () => {
    render(
      <RuleFormDialog
        categoryId="c1"
        open={true}
        onClose={() => {}}
        initialRule={{ id: '1', category_id: 'c1', field: 'name', operator: 'contains', value: 'lehenga', created_at: '', updated_at: '' }}
      />,
      { wrapper }
    )
    expect(screen.getByText('Edit Condition')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Write the failing test for `RuleList`**

```tsx
// __tests__/components/categories/rules/RuleList.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/category-rules', () => ({
  getCategoryRules: vi.fn().mockResolvedValue([
    { id: '1', category_id: 'c1', field: 'name', operator: 'contains', value: 'lehenga', created_at: '', updated_at: '' },
  ]),
  createCategoryRule: vi.fn(),
  updateCategoryRule: vi.fn(),
  deleteCategoryRule: vi.fn(),
}))
vi.mock('@/services/product-categories', () => ({
  reevaluateAllProducts: vi.fn().mockResolvedValue({ evaluated: 0 }),
}))

const { default: RuleList } = await import('@/components/categories/rules/RuleList')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('RuleList', () => {
  it('renders existing rules once loaded', async () => {
    render(<RuleList categoryId="c1" matchType="ALL" onMatchTypeChange={() => {}} />, { wrapper })
    expect(await screen.findByText(/lehenga/)).toBeInTheDocument()
  })

  it('shows the Add Condition button', async () => {
    render(<RuleList categoryId="c1" matchType="ALL" onMatchTypeChange={() => {}} />, { wrapper })
    expect(await screen.findByText('Add Condition')).toBeInTheDocument()
  })

  it('shows the Re-evaluate All Products action', async () => {
    render(<RuleList categoryId="c1" matchType="ALL" onMatchTypeChange={() => {}} />, { wrapper })
    expect(await screen.findByText('Re-evaluate All Products')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run __tests__/components/categories/rules`
Expected: FAIL — `Cannot find module '@/components/categories/rules/RuleFormDialog'` (and `RuleList`)

- [ ] **Step 4: Write `components/categories/rules/RuleFormDialog.tsx`**

```tsx
'use client'

import { useState, useRef } from 'react'
import { useCreateCategoryRule, useUpdateCategoryRule } from '@/hooks/use-category-rules'
import { OPERATORS_BY_FIELD } from '@/lib/category-rules'
import type { CategoryRule, RuleField, RuleOperator } from '@/types'

interface Props {
  categoryId: string
  open: boolean
  onClose: () => void
  initialRule?: CategoryRule
}

const FIELD_LABELS: Record<RuleField, string> = { name: 'Name', work_types: 'Work Type', price: 'Price' }
const OPERATOR_LABELS: Record<RuleOperator, string> = {
  contains: 'Contains',
  is: 'Is',
  greater_than: 'Greater Than',
  less_than: 'Less Than',
}

export default function RuleFormDialog({ categoryId, open, onClose, initialRule }: Props) {
  const [field, setField] = useState<RuleField>('name')
  const [operator, setOperator] = useState<RuleOperator>('contains')
  const [value, setValue] = useState('')

  const createRule = useCreateCategoryRule(categoryId)
  const updateRule = useUpdateCategoryRule(categoryId)
  const isPending = createRule.isPending || updateRule.isPending

  const prevOpenRef = useRef(open)
  const prevRuleRef = useRef(initialRule)

  // eslint-disable-next-line react-hooks/refs
  if (prevOpenRef.current !== open || prevRuleRef.current !== initialRule) {
    // eslint-disable-next-line react-hooks/refs
    prevOpenRef.current = open
    // eslint-disable-next-line react-hooks/refs
    prevRuleRef.current = initialRule
    if (open) {
      setField(initialRule?.field ?? 'name')
      setOperator(initialRule?.operator ?? 'contains')
      setValue(initialRule?.value ?? '')
    }
  }

  if (!open) return null

  const availableOperators = OPERATORS_BY_FIELD[field]

  function handleFieldChange(next: RuleField) {
    setField(next)
    if (!OPERATORS_BY_FIELD[next].includes(operator)) {
      setOperator(OPERATORS_BY_FIELD[next][0])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    if (initialRule) {
      await updateRule.mutateAsync({ id: initialRule.id, updates: { field, operator, value: value.trim() } })
    } else {
      await createRule.mutateAsync({ category_id: categoryId, field, operator, value: value.trim() })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{initialRule ? 'Edit Condition' : 'Add Condition'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="rule-field" className="block text-sm font-medium text-gray-700 mb-1">Field</label>
            <select
              id="rule-field"
              aria-label="Field"
              value={field}
              onChange={(e) => handleFieldChange(e.target.value as RuleField)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
            >
              {(Object.keys(FIELD_LABELS) as RuleField[]).map((f) => (
                <option key={f} value={f}>{FIELD_LABELS[f]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rule-operator" className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
            <select
              id="rule-operator"
              aria-label="Operator"
              value={operator}
              onChange={(e) => setOperator(e.target.value as RuleOperator)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
            >
              {availableOperators.map((op) => (
                <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rule-value" className="block text-sm font-medium text-gray-700 mb-1">Value</label>
            <input
              id="rule-value"
              aria-label="Value"
              type={field === 'price' ? 'number' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
            />
          </div>
          {(createRule.error || updateRule.error) && (
            <p className="text-sm text-red-600">Failed to save condition. Please try again.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50">
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write `components/categories/rules/DeleteRuleDialog.tsx`**

```tsx
'use client'

import { useDeleteCategoryRule } from '@/hooks/use-category-rules'
import type { CategoryRule } from '@/types'

interface Props {
  categoryId: string
  rule: CategoryRule | null
  onClose: () => void
}

export default function DeleteRuleDialog({ categoryId, rule, onClose }: Props) {
  const deleteRule = useDeleteCategoryRule(categoryId)

  if (!rule) return null

  async function handleConfirm() {
    await deleteRule.mutateAsync(rule!.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-2">Delete Condition</h2>
        <p className="text-sm text-gray-600 mb-4">
          Delete this condition? Products matched only through it will be unlinked from this category.
        </p>
        {deleteRule.error && <p className="text-sm text-red-600 mb-3">Failed to delete. Please try again.</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
          <button onClick={handleConfirm} disabled={deleteRule.isPending} className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50">
            {deleteRule.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Write `components/categories/rules/RuleList.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useCategoryRules } from '@/hooks/use-category-rules'
import { useReevaluateAllProducts } from '@/hooks/use-product-categories'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import RuleFormDialog from './RuleFormDialog'
import DeleteRuleDialog from './DeleteRuleDialog'
import type { CategoryRule, RuleField, RuleOperator, CategoryMatchType } from '@/types'

const FIELD_LABELS: Record<RuleField, string> = { name: 'Name', work_types: 'Work Type', price: 'Price' }
const OPERATOR_LABELS: Record<RuleOperator, string> = {
  contains: 'contains', is: 'is', greater_than: '>', less_than: '<',
}

interface Props {
  categoryId: string
  matchType: CategoryMatchType
  onMatchTypeChange: (matchType: CategoryMatchType) => void
}

export default function RuleList({ categoryId, matchType, onMatchTypeChange }: Props) {
  const { data: rules, isLoading, error, refetch } = useCategoryRules(categoryId)
  const reevaluate = useReevaluateAllProducts()
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CategoryRule | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<CategoryRule | null>(null)

  function openCreate() { setEditTarget(undefined); setFormOpen(true) }
  function openEdit(r: CategoryRule) { setEditTarget(r); setFormOpen(true) }
  function closeForm() { setFormOpen(false); setEditTarget(undefined) }

  async function handleReevaluate() {
    if (!confirm('Re-evaluate all products against every category’s conditions? This may take a moment.')) return
    const result = await reevaluate.mutateAsync()
    alert(`Re-evaluated ${result.evaluated} products.`)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Conditions</h3>
        <button type="button" onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f]">
          <Plus size={14} /> Add Condition
        </button>
      </div>

      {rules && rules.length > 0 && (
        <div className="flex items-center gap-4 text-[12px] text-zinc-700">
          <span className="font-medium">Match:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="match-type" checked={matchType === 'ALL'} onChange={() => onMatchTypeChange('ALL')} />
            All conditions
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="match-type" checked={matchType === 'ANY'} onChange={() => onMatchTypeChange('ANY')} />
            Any condition
          </label>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      )}
      {error && <ErrorState message="Could not load conditions." onRetry={refetch} />}
      {!isLoading && !error && rules?.length === 0 && (
        <EmptyState message="No conditions yet. Products stay manually assigned until you add one." />
      )}
      {!isLoading && !error && rules && rules.length > 0 && (
        <ul className="divide-y divide-[#E8E0D5] border border-[#E8E0D5]">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-[12px]">
              <span>
                <strong>{FIELD_LABELS[r.field]}</strong> {OPERATOR_LABELS[r.operator]} &quot;{r.value}&quot;
              </span>
              <span className="space-x-3 text-[10px] font-bold tracking-widest">
                <button type="button" onClick={() => openEdit(r)} className="text-[#B38B5D] hover:text-[#A37B4D] uppercase">EDIT</button>
                <button type="button" onClick={() => setDeleteTarget(r)} className="text-red-600 hover:text-red-700 uppercase">DELETE</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2">
        <button
          type="button"
          onClick={handleReevaluate}
          disabled={reevaluate.isPending}
          className="text-[10px] font-bold tracking-widest text-zinc-500 hover:text-zinc-800 uppercase disabled:opacity-50"
        >
          {reevaluate.isPending ? 'Re-evaluating…' : 'Re-evaluate All Products'}
        </button>
      </div>

      <RuleFormDialog categoryId={categoryId} open={formOpen} onClose={closeForm} initialRule={editTarget} />
      <DeleteRuleDialog categoryId={categoryId} rule={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </section>
  )
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run __tests__/components/categories/rules`
Expected: PASS (8 tests)

- [ ] **Step 8: Commit**

```bash
git add components/categories/rules __tests__/components/categories/rules
git commit -m "feat(category-rules): add Conditions panel UI components"
```

---

### Task 9: Embed the Conditions panel in the category edit page

**Files:**
- Modify: `app/(app)/categories/add/page.tsx`

**Interfaces:**
- Consumes: `RuleList` from `@/components/categories/rules/RuleList` (Task 8); `CategoryMatchType` from `@/types`.

- [ ] **Step 1: Add `rule_match_type` state and load it from the category**

In `app/(app)/categories/add/page.tsx`, add the import:

```tsx
import RuleList from '@/components/categories/rules/RuleList';
import type { CategoryMatchType } from '@/types';
```

Add state next to the existing `active` state (near line 29):

```tsx
  const [ruleMatchType, setRuleMatchType] = useState<CategoryMatchType>('ALL');
```

In the `loadCategory` effect, next to `setActive(cat.is_active ?? true);` (line 48), add:

```tsx
          setRuleMatchType(cat.rule_match_type ?? 'ALL');
```

- [ ] **Step 2: Include `rule_match_type` in the edit-flow save**

In `handleSubmit`, inside the `if (editId) { ... }` branch, add `rule_match_type: ruleMatchType,` to the `updateCategory` call:

```tsx
        await updateCategory(editId, {
          name: name.trim(),
          slug: slugVal,
          subtitle: subtitle.trim() || null,
          description: description.trim() || null,
          sort_order: sortOrder,
          is_active: active,
          image_url: finalImageUrl,
          rule_match_type: ruleMatchType,
        });
```

- [ ] **Step 3: Render the Conditions panel in edit mode**

After the closing `</div>` of the main form card (the `<div className="bg-white border border-[#E8E0D5] p-8 shadow-xs">...</div>` wrapping the `<form>`, just before the final closing `</div>` of the component's root), add:

```tsx
      {editId && (
        <div className="bg-white border border-[#E8E0D5] p-8 shadow-xs mt-6">
          <RuleList
            categoryId={editId}
            matchType={ruleMatchType}
            onMatchTypeChange={setRuleMatchType}
          />
        </div>
      )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev`
Navigate to `/categories`, click **Edit** on an existing category, confirm a "Conditions" panel appears below the form with an "Add Condition" button and a "Re-evaluate All Products" link. Add a condition (e.g. Field=Work Type, Operator=Contains, Value=Zardozi), confirm it appears in the list. Confirm the panel does **not** appear on `/categories/add` (create mode, no `editId`).

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/categories/add/page.tsx"
git commit -m "feat(category-rules): embed Conditions panel in category edit page"
```

---

### Task 10: Storefront — `/shop/[slug]` reads from `product_categories`

**Files:**
- Modify: `C:\Users\Eshwar\WNR\mei\src\lib\supabase\database.ts`
- Modify: `C:\Users\Eshwar\WNR\mei\src\lib\services\products.ts`
- Modify: `C:\Users\Eshwar\WNR\mei\src\lib\services\__tests__\products.test.ts`

This task is in the **`mei` repository** (sibling to `mei-admin`, its own git history) — commit it there, not in `mei-admin`. Both repos already point `.env.local` at the same hosted Supabase project (per `mei-admin/CLAUDE.md`), so the `product_categories` table from Task 1 is already visible here; no new migration is needed in this repo (it has no `supabase/migrations` directory).

**Interfaces:**
- Consumes: `product_categories` table (Task 1, `UNIQUE(product_id, category_id, source)` — a product can legitimately have both a `'manual'` and a `'rule'` row for the same category); existing `_mapDbRowToProduct`, `ProductWithRelations`, `SELECT` from `products.ts`.
- Produces: `getProductsByCategory(categorySlug: string): Promise<Product[]>` — same signature, callers (`src/app/shop/[slug]/page.tsx`) need no changes. Deduplicates by product id in application code, so a product with two `product_categories` rows for the same category (one manual, one rule) still appears exactly once in the result.

- [ ] **Step 1: Add the `product_categories` table type**

In `C:\Users\Eshwar\WNR\mei\src\lib\supabase\database.ts`, immediately after the `product_media` block, add:

```ts
      product_categories: {
        Row: { id: string; product_id: string; category_id: string; source: 'manual' | 'rule'; created_at: string }
        Insert: { id?: string; product_id: string; category_id: string; source: 'manual' | 'rule' }
        Update: { source?: 'manual' | 'rule' }
      }
```

- [ ] **Step 2: Update the existing `getProductsByCategory` test to match the new two-query implementation**

In `C:\Users\Eshwar\WNR\mei\src\lib\services\__tests__\products.test.ts`, replace the `describe("getProductsByCategory", ...)` block (lines 272-282) with:

```ts
describe("getProductsByCategory", () => {
  it("resolves the category by slug, then filters products via the product_categories join", async () => {
    const categoryChain = makeChain({ data: { id: "cat1" }, error: null });
    const productsChain = makeChain({ data: [{ products: fullProductRow }], error: null });
    productsChain.order = vi.fn().mockResolvedValue({ data: [{ products: fullProductRow }], error: null });

    const fromMock = vi.fn((table: string) => (table === "categories" ? categoryChain : productsChain));
    vi.mocked(createClient).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof createClient>);

    const result = await getProductsByCategory("lehengas");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
    expect(categoryChain.eq).toHaveBeenCalledWith("slug", "lehengas");
    expect(productsChain.eq).toHaveBeenCalledWith("category_id", "cat1");
  });

  it("returns an empty array when the category slug does not resolve", async () => {
    const categoryChain = makeChain({ data: null, error: null });
    const fromMock = vi.fn(() => categoryChain);
    vi.mocked(createClient).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof createClient>);

    const result = await getProductsByCategory("nonexistent");
    expect(result).toEqual([]);
  });

  it("deduplicates a product that has both a manual and a rule row for the same category", async () => {
    const categoryChain = makeChain({ data: { id: "cat1" }, error: null });
    // Two product_categories rows for the same product+category (source='manual' and source='rule')
    // join back to the same product row twice — the service must collapse this to one entry.
    const duplicateRows = [{ products: fullProductRow }, { products: fullProductRow }];
    const productsChain = makeChain({ data: duplicateRows, error: null });
    productsChain.order = vi.fn().mockResolvedValue({ data: duplicateRows, error: null });

    const fromMock = vi.fn((table: string) => (table === "categories" ? categoryChain : productsChain));
    vi.mocked(createClient).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof createClient>);

    const result = await getProductsByCategory("lehengas");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails against the current implementation**

Run: `cd C:\Users\Eshwar\WNR\mei && npx vitest run src/lib/services/__tests__/products.test.ts -t getProductsByCategory`
Expected: FAIL — the current implementation queries `products` with `.eq("categories.slug", ...)` in a single call, so `categoryChain.eq` is never called with `("slug", "lehengas")` the way the new test expects (the mock dispatch by table name means the old code path only ever hits `productsChain`).

- [ ] **Step 4: Rewrite `getProductsByCategory`**

In `C:\Users\Eshwar\WNR\mei\src\lib\services\products.ts`, replace the `getProductsByCategory` function (lines 110-133) with:

```ts
export async function getProductsByCategory(
  categorySlug: string
): Promise<Product[]> {
  return unstable_cache(
    async (): Promise<Product[]> => {
      const supabase = getServiceClient();

      const { data: category, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", categorySlug)
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle();

      if (categoryError) {
        console.error("[ProductsService:getProductsByCategory]", categoryError);
        throw categoryError;
      }
      if (!category) return [];

      const { data, error } = await supabase
        .from("product_categories")
        .select(`products!inner(${SELECT})`)
        .eq("category_id", category.id)
        .eq("products.status", "PUBLISHED")
        .is("products.deleted_at", null)
        .order("created_at", { ascending: false, referencedTable: "products" });

      if (error) {
        console.error("[ProductsService:getProductsByCategory]", error);
        throw error;
      }

      // A product can hold both a 'manual' and a 'rule' product_categories row for
      // this same category (see mei-admin's product_categories UNIQUE(product_id,
      // category_id, source) constraint) — that joins back to two rows here for one
      // product. Dedupe by id, keeping the first occurrence so the created_at DESC
      // ordering from the query is preserved.
      const seenProductIds = new Set<string>();
      const products: Product[] = [];
      for (const row of data as unknown as { products: ProductWithRelations }[]) {
        const mapped = _mapDbRowToProduct(row.products);
        if (seenProductIds.has(mapped.id)) continue;
        seenProductIds.add(mapped.id);
        products.push(mapped);
      }
      return products;
    },
    ["products-by-category", categorySlug],
    { tags: ["products"], revalidate: 60 }
  )();
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd C:\Users\Eshwar\WNR\mei && npx vitest run src/lib/services/__tests__/products.test.ts`
Expected: PASS (all tests in this file, including the untouched `_mapDbRowToProduct`, `getProducts`, `getProductBySlug`, `getProductById`, and `getRelatedProducts` suites, plus the new `getProductsByCategory` dedup test).

- [ ] **Step 6: Type-check the storefront**

Run: `cd C:\Users\Eshwar\WNR\mei && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Manually verify in the browser**

Run: `cd C:\Users\Eshwar\WNR\mei && npm run dev`
In `mei-admin`, open a category's edit page, add a condition that matches at least one existing published product (e.g. Work Type contains an existing tag), click **Re-evaluate All Products**. Then visit `http://localhost:3000/shop/<that-category-slug>` on the storefront and confirm the matched product appears. Also confirm a product that was only ever manually assigned to a *different* category (never edited since the Task 1 backfill) still shows up under its original category page.

- [ ] **Step 8: Commit (in the `mei` repository)**

```bash
cd "C:\Users\Eshwar\WNR\mei"
git add src/lib/supabase/database.ts src/lib/services/products.ts src/lib/services/__tests__/products.test.ts
git commit -m "feat(shop): read category product listings from product_categories join"
```

---

## Self-Review Notes

- **Spec coverage:** join table + unique constraint (Task 1) · Conditions panel with add/edit/delete (Tasks 8-9) · field/operator support (Task 3, restricted per-field via `OPERATORS_BY_FIELD`, enforced again at the DB layer via `category_rules_valid_operator_for_field`) · auto-evaluation on create/update (Task 6, both sources) · "Re-evaluate all products" (Tasks 5, 8, rule-only) · storefront `/shop/[slug]` via join with dedup (Task 10) · multi-category membership (schema has no single-category constraint; a product can match multiple categories' rules simultaneously, verified by `evaluateCategoryRules` running independently per category, and by the Task 5 "matches a product into multiple categories at once" test).
- **Manual-assignment safety net:** the Task 1 one-time backfill plus the Task 6 per-save `'manual'` sync means no product silently disappears from a category page it was already showing on before this feature shipped. This is enforced structurally, not just by convention: `UNIQUE(product_id, category_id, source)` (not `product_id, category_id`) means a manual row and a rule row for the same category are two separate rows that can't collide or silently overwrite each other, and `reevaluateAllProducts` calling `syncRuleCategoryAssignments` (not the combined `syncProductCategoryAssignments`) means bulk re-evaluation structurally cannot touch a manual row even by accident.
- **Test coverage beyond the happy path (Task 5 + Task 10):** category with zero rules, product matching multiple categories simultaneously, product with manual-category-only membership, product with both manual and rule membership on the *same* category, stale rule-row removal on update, re-evaluate-all backfill that provably never touches manual rows, and a storefront dedup test proving a double-sourced product still renders once.
- **Cross-repo:** Task 10 is the only task touching `../mei`; every other task is in `mei-admin`. Flagged explicitly since it's a separate git history and its own commit. Rollback is a single-commit revert in that repo since `category_id` is never modified.
