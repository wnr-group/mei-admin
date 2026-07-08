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
