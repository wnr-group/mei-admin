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

