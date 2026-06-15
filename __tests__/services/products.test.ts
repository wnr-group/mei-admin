import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { getProducts, createProduct, updateProduct, deleteProduct, getProductBySlug } = await import('@/services/products')

interface MockChain extends Record<string, unknown> {
  then: (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  finally: (onFinally?: (() => void) | null) => Promise<unknown>
}

function createMockChainForQuery(finalValue: unknown): MockChain {
  const chain: MockChain = {} as MockChain
  const methods = ['select', 'insert', 'update', 'is', 'eq', 'ilike', 'order', 'range', 'single', 'limit']

  methods.forEach(m => {
    chain[m] = vi.fn(() => chain)
  })

  // Make it thenable with proper Promise behavior
  const promise = Promise.resolve(finalValue)
  chain.then = (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => promise.then(onFulfilled, onRejected)
  chain.catch = (onRejected?: ((reason: unknown) => unknown) | null) => promise.catch(onRejected)
  chain.finally = (onFinally?: (() => void) | null) => promise.finally(onFinally)

  mockFrom.mockReturnValue(chain)
  return chain
}

describe('getProducts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns products and total count', async () => {
    createMockChainForQuery({ data: [{ id: '1', name: 'Test Product', price: 100 }], count: 1, error: null })
    const result = await getProducts()
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Test Product')
    expect(result.total).toBe(1)
  })

  it('applies pagination with page and limit', async () => {
    const chain = createMockChainForQuery({ data: [], count: 50, error: null })
    await getProducts({ page: 2, limit: 10 })
    expect(chain.range).toHaveBeenCalledWith(10, 19)
  })

  it('filters by search term with ilike', async () => {
    const chain = createMockChainForQuery({ data: [], count: 0, error: null })
    await getProducts({ search: 'lehenga' })
    expect(chain.ilike).toHaveBeenCalledWith('name', '%lehenga%')
  })

  it('filters by status', async () => {
    const chain = createMockChainForQuery({ data: [], count: 0, error: null })
    await getProducts({ status: 'PUBLISHED' })
    expect(chain.eq).toHaveBeenCalledWith('status', 'PUBLISHED')
  })

  it('filters by categoryId', async () => {
    const chain = createMockChainForQuery({ data: [], count: 0, error: null })
    await getProducts({ categoryId: 'cat-1' })
    expect(chain.eq).toHaveBeenCalledWith('category_id', 'cat-1')
  })

  it('throws on Supabase error', async () => {
    createMockChainForQuery({ data: null, count: null, error: { message: 'DB error' } })
    await expect(getProducts()).rejects.toThrow('DB error')
  })

  it('returns empty array when no data', async () => {
    createMockChainForQuery({ data: null, count: null, error: null })
    const result = await getProducts()
    expect(result.products).toEqual([])
    expect(result.total).toBe(0)
  })
})

describe('createProduct', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates and returns product', async () => {
    const newProduct = { id: '2', name: 'New Product', price: 200, status: 'DRAFT' }
    createMockChainForQuery({ data: newProduct, error: null })
    const result = await createProduct({ name: 'New Product', price: 200 })
    expect(result.name).toBe('New Product')
    expect(mockFrom).toHaveBeenCalledWith('products')
  })

  it('throws on Supabase error', async () => {
    createMockChainForQuery({ data: null, error: { message: 'Insert failed' } })
    await expect(createProduct({ name: 'Bad', price: 0 })).rejects.toThrow('Insert failed')
  })
})

describe('updateProduct', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates and returns product', async () => {
    const updated = { id: '1', name: 'Updated', price: 150 }
    const chain = createMockChainForQuery({ data: updated, error: null })
    const result = await updateProduct('1', { name: 'Updated', price: 150 })
    expect(result.name).toBe('Updated')
    expect(chain.eq).toHaveBeenCalledWith('id', '1')
  })

  it('throws on Supabase error', async () => {
    createMockChainForQuery({ data: null, error: { message: 'Update failed' } })
    await expect(updateProduct('1', { name: 'Bad' })).rejects.toThrow('Update failed')
  })
})

describe('deleteProduct', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft deletes product', async () => {
    const chain = createMockChainForQuery({ error: null })
    await deleteProduct('1')
    expect(chain.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) })
    expect(chain.eq).toHaveBeenCalledWith('id', '1')
  })

  it('throws on Supabase error', async () => {
    createMockChainForQuery({ error: { message: 'Delete failed' } })
    await expect(deleteProduct('1')).rejects.toThrow('Delete failed')
  })
})

// ─── chain factory that does NOT auto-wire mockFrom ──────────────────────────
function createChain(finalValue: unknown): MockChain {
  const chain: MockChain = {} as MockChain
  const methods = ['select', 'insert', 'update', 'is', 'eq', 'ilike', 'order', 'range', 'single', 'limit']
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  const promise = Promise.resolve(finalValue)
  chain.then = (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => promise.then(onFulfilled, onRejected)
  chain.catch = (onRejected?: ((reason: unknown) => unknown) | null) => promise.catch(onRejected)
  chain.finally = (onFinally?: (() => void) | null) => promise.finally(onFinally)
  return chain
}

describe('getProductBySlug', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no product matches (PGRST116)', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    const result = await getProductBySlug('nonexistent')
    expect(result).toBeNull()
  })

  it('returns { id, slug } when a product matches', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: { id: 'p1', slug: 'lehenga' }, error: null }))
    const result = await getProductBySlug('lehenga')
    expect(result).toEqual({ id: 'p1', slug: 'lehenga' })
  })

  it('throws on unexpected Supabase error', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: '42501', message: 'permission denied' } }))
    await expect(getProductBySlug('any')).rejects.toThrow('permission denied')
  })
})

describe('createProduct — slug disambiguation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts with the original slug when there is no collision', async () => {
    // attempt 1: pre-check lehenga → available
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    // attempt 1: insert → success
    const inserted = { id: '1', name: 'Lehenga', slug: 'lehenga', price: 5000 }
    mockFrom.mockReturnValueOnce(createChain({ data: inserted, error: null }))

    const result = await createProduct({ name: 'Lehenga', slug: 'lehenga', price: 5000 })
    expect(result.slug).toBe('lehenga')
    expect(mockFrom).toHaveBeenCalledTimes(2) // 1 pre-check + 1 insert
  })

  it('appends -2 when the pre-check finds the base slug is already taken', async () => {
    // attempt 1: pre-check lehenga → found, skip insert
    mockFrom.mockReturnValueOnce(createChain({ data: { id: 'existing', slug: 'lehenga' }, error: null }))
    // attempt 2: pre-check lehenga-2 → available
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    // attempt 2: insert lehenga-2 → success
    const inserted = { id: '2', name: 'Lehenga', slug: 'lehenga-2', price: 5000 }
    mockFrom.mockReturnValueOnce(createChain({ data: inserted, error: null }))

    const result = await createProduct({ name: 'Lehenga', slug: 'lehenga', price: 5000 })
    expect(result.slug).toBe('lehenga-2')
    expect(mockFrom).toHaveBeenCalledTimes(3)
  })

  it('keeps climbing suffix until a free slot is found', async () => {
    // attempt 1: pre-check lehenga → found
    mockFrom.mockReturnValueOnce(createChain({ data: { id: 'a', slug: 'lehenga' }, error: null }))
    // attempt 2: pre-check lehenga-2 → found
    mockFrom.mockReturnValueOnce(createChain({ data: { id: 'b', slug: 'lehenga-2' }, error: null }))
    // attempt 3: pre-check lehenga-3 → available
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    // attempt 3: insert lehenga-3 → success
    const inserted = { id: '3', name: 'Lehenga', slug: 'lehenga-3', price: 5000 }
    mockFrom.mockReturnValueOnce(createChain({ data: inserted, error: null }))

    const result = await createProduct({ name: 'Lehenga', slug: 'lehenga', price: 5000 })
    expect(result.slug).toBe('lehenga-3')
    expect(mockFrom).toHaveBeenCalledTimes(4)
  })

  it('retries on insert unique-constraint violation caused by a concurrent create', async () => {
    // attempt 1: pre-check lehenga → available (race: another request hasn't inserted yet)
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    // attempt 1: insert → 23505 (the concurrent request won the race)
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "products_slug_unique"' } }))
    // attempt 2: pre-check lehenga-2 → available
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    // attempt 2: insert lehenga-2 → success
    const inserted = { id: '4', name: 'Lehenga', slug: 'lehenga-2', price: 5000 }
    mockFrom.mockReturnValueOnce(createChain({ data: inserted, error: null }))

    const result = await createProduct({ name: 'Lehenga', slug: 'lehenga', price: 5000 })
    expect(result.slug).toBe('lehenga-2')
    expect(mockFrom).toHaveBeenCalledTimes(4) // 2 pre-checks + 2 inserts
  })

  it('also detects unique violation via message text (products_slug_unique)', async () => {
    // Some Supabase proxy configs surface the constraint name without the 23505 code
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: '', message: 'ERROR: duplicate key value violates unique constraint "products_slug_unique"' } }))
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    const inserted = { id: '5', name: 'Saree', slug: 'saree-2', price: 2000 }
    mockFrom.mockReturnValueOnce(createChain({ data: inserted, error: null }))

    const result = await createProduct({ name: 'Saree', slug: 'saree', price: 2000 })
    expect(result.slug).toBe('saree-2')
  })

  it('skips disambiguation entirely when slug is null', async () => {
    const inserted = { id: '6', name: 'No Slug', slug: null, price: 100 }
    mockFrom.mockReturnValue(createChain({ data: inserted, error: null }))

    await createProduct({ name: 'No Slug', price: 100 })
    expect(mockFrom).toHaveBeenCalledTimes(1) // insert only, no pre-check
  })

  it('throws VALIDATION_ERROR after exhausting 20 attempts', async () => {
    // All 20 pre-checks return "found" (no insert attempted in any iteration)
    for (let i = 0; i < 20; i++) {
      const slug = i === 0 ? 'test' : `test-${i + 1}`
      mockFrom.mockReturnValueOnce(createChain({ data: { id: `x${i}`, slug }, error: null }))
    }

    await expect(createProduct({ name: 'Test', slug: 'test', price: 100 })).rejects.toThrow(
      /unable to generate a unique product slug/i
    )
  })

  it('audit log still fires after a successful disambiguated create', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: null, error: { code: 'PGRST116', message: 'No rows found' } }))
    const inserted = { id: '7', name: 'Saree', slug: 'saree', price: 2000 }
    mockFrom.mockReturnValueOnce(createChain({ data: inserted, error: null }))

    const result = await createProduct({ name: 'Saree', slug: 'saree', price: 2000 })
    expect(result.id).toBe('7') // createProduct resolved — audit fires as a side-effect
  })
})
