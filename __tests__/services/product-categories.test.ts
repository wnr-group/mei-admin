import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { syncProductCategoryAssignments, syncManualCategoryAssignment, syncRuleCategoryAssignments, reevaluateAllProducts } = await import('@/services/product-categories')

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
      // 2. manually excluded rows for rule check
      { data: [], error: null },
      // 3. existing rule rows for this product
      { data: [], error: null },
      // 4. insert rule rows
      { data: null, error: null },
      // 5. existing manual rows for this product
      { data: [], error: null },
      // 6. insert manual row
      { data: null, error: null },
    ])

    await syncProductCategoryAssignments(product)

    expect(mockFrom).toHaveBeenCalledWith('categories')
    expect(mockFrom).toHaveBeenCalledWith('product_categories')
  })

  it('removes a stale rule row when the product no longer matches', async () => {
    mockSequence([
      // 1. categories-with-rules
      { data: [{ id: 'cat-rule', rule_match_type: 'ALL', category_rules: [{ field: 'price', operator: 'greater_than', value: '999999' }] }], error: null }, // no longer matches (price too low)
      // 2. manually excluded rows
      { data: [], error: null },
      // 3. existing rule row for cat-rule
      { data: [{ id: 'row1', category_id: 'cat-rule' }], error: null },
      // 4. delete stale rule row
      { data: null, error: null },
      // 5. existing manual rows
      { data: [], error: null },
      // 6. insert manual row
      { data: null, error: null },
    ])

    await syncProductCategoryAssignments(product)
    expect(mockFrom).toHaveBeenCalledWith('product_categories')
  })

  it('does not insert a manual row when category_id is null', async () => {
    mockSequence([
      // 1. categories-with-rules
      { data: [], error: null },
      // 2. manually excluded rows
      { data: [], error: null },
      // 3. existing rule rows
      { data: [], error: null },
      // 4. existing manual rows
      { data: [], error: null },
    ])

    await syncProductCategoryAssignments({ ...product, category_id: null })
    // 4 calls total: categories, manually excluded read, rule read, manual read — no inserts
    expect(mockFrom).toHaveBeenCalledTimes(4)
  })

  it('ignores a category that has zero rules — an empty rule set never matches and never breaks evaluation', async () => {
    mockSequence([
      // 1. categories-with-rules (empty since filtered out by getCategoriesWithRules)
      { data: [{ id: 'cat-empty', rule_match_type: 'ALL', category_rules: [] }], error: null },
      // 2. manually excluded rows
      { data: [], error: null },
      // 3. existing rule rows
      { data: [], error: null },
      // 4. existing manual rows
      { data: [], error: null },
    ])

    await syncProductCategoryAssignments({ ...product, category_id: null })
    // Same shape as "no categories with rules": categories, excluded read, rule read, manual read — no inserts
    expect(mockFrom).toHaveBeenCalledTimes(4)
  })

  it('matches a product into multiple categories at once by rule', async () => {
    mockSequence([
      // 1. categories-with-rules
      { data: [
        { id: 'cat-a', rule_match_type: 'ALL', category_rules: [{ field: 'work_types', operator: 'contains', value: 'zardozi' }] },
        { id: 'cat-b', rule_match_type: 'ALL', category_rules: [{ field: 'price', operator: 'greater_than', value: '1000' }] },
      ], error: null },
      // 2. manually excluded rows
      { data: [], error: null },
      // 3. existing rule rows
      { data: [], error: null },
      // 4. insert rule rows for both cat-a and cat-b in one call
      { data: null, error: null },
      // 5. existing manual rows
      { data: [], error: null },
      // 6. insert manual row
      { data: null, error: null },
    ])

    await syncProductCategoryAssignments(product)
    expect(mockFrom).toHaveBeenCalledTimes(6)
  })

  it('keeps only a manual row when the product matches no rules (manual-only membership)', async () => {
    mockSequence([
      // 1. categories-with-rules
      { data: [], error: null },
      // 2. manually excluded rows
      { data: [], error: null },
      // 3. existing rule rows
      { data: [], error: null },
      // 4. existing manual rows
      { data: [], error: null },
      // 5. insert manual row for product.category_id
      { data: null, error: null },
    ])

    await syncProductCategoryAssignments(product) // product.category_id = 'cat-manual'
    expect(mockFrom).toHaveBeenCalledTimes(5)
  })

  it('keeps both a manual row and a rule row for the same category simultaneously', async () => {
    mockSequence([
      // 1. categories-with-rules
      { data: [{ id: 'cat-manual', rule_match_type: 'ALL', category_rules: [{ field: 'work_types', operator: 'contains', value: 'zardozi' }] }], error: null },
      // 2. manually excluded rows
      { data: [], error: null },
      // 3. existing rule rows
      { data: [], error: null },
      // 4. insert rule row: (product, cat-manual, source='rule')
      { data: null, error: null },
      // 5. existing manual rows
      { data: [], error: null },
      // 6. insert manual row: (product, cat-manual, source='manual')
      { data: null, error: null },
    ])

    await syncProductCategoryAssignments(product)
    expect(mockFrom).toHaveBeenCalledTimes(6)
  })
})

describe('syncRuleCategoryAssignments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('only reads/writes rule rows — never touches manual rows', async () => {
    mockSequence([
      // 1. categories-with-rules
      { data: [{ id: 'cat-rule', rule_match_type: 'ALL', category_rules: [{ field: 'work_types', operator: 'contains', value: 'zardozi' }] }], error: null },
      // 2. manually excluded rows
      { data: [], error: null },
      // 3. existing rule rows
      { data: [], error: null },
      // 4. insert rule row
      { data: null, error: null },
    ])

    await syncRuleCategoryAssignments(product)
    // Exactly 4 calls: categories, excluded read, rule read, rule insert — no manual-row calls at all
    expect(mockFrom).toHaveBeenCalledTimes(4)
  })

  it('does not insert a rule row if the category is manually excluded', async () => {
    mockSequence([
      // 1. categories-with-rules
      { data: [{ id: 'cat-rule', rule_match_type: 'ALL', category_rules: [{ field: 'work_types', operator: 'contains', value: 'zardozi' }] }], error: null },
      // 2. manually excluded rows (cat-rule is manually excluded)
      { data: [{ category_id: 'cat-rule' }], error: null },
      // 3. existing rule rows
      { data: [], error: null },
    ])

    await syncRuleCategoryAssignments(product)
    // Only 3 calls (categories, excluded read, rule read) and NO insert/delete since it is manually excluded
    expect(mockFrom).toHaveBeenCalledTimes(3)
  })
})

describe('syncManualCategoryAssignment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not delete manual rows that are manually included or manually excluded', async () => {
    mockSequence([
      // 1. existing manual rows for this product
      { data: [
        { id: 'row-included', category_id: 'cat-inc', manually_included: true, manually_excluded: false },
        { id: 'row-excluded', category_id: 'cat-exc', manually_included: false, manually_excluded: true },
      ], error: null },
      // 2. insert manual row for the new target category
      { data: null, error: null },
    ])

    await syncManualCategoryAssignment(product)

    // Should only call select then insert (no delete because both existing rows have manual flags)
    expect(mockFrom).toHaveBeenCalledTimes(2)
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
    // products (fetch all) -> categories (rule lookup) -> product_categories (excluded read) -> product_categories (rule read) = 4 calls total.
    expect(calledTables).toHaveLength(4)
  })

  it('throws on Supabase error fetching products', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'products') return chainResolving({ data: null, error: { message: 'DB error' } })
      return chainResolving({ data: [], error: null })
    })
    await expect(reevaluateAllProducts()).rejects.toThrow('DB error')
  })
})
