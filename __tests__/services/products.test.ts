import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { getProducts, createProduct, updateProduct, deleteProduct } = await import('@/services/products')

function createMockChainForQuery(finalValue: unknown) {
  const chain: Record<string, any> = {}
  const methods = ['select', 'insert', 'update', 'is', 'eq', 'ilike', 'order', 'range', 'single', 'limit']

  methods.forEach(m => {
    chain[m] = vi.fn(() => chain)
  })

  // Make it thenable with proper Promise behavior
  const promise = Promise.resolve(finalValue)
  chain.then = (onFulfilled: any, onRejected?: any) => promise.then(onFulfilled, onRejected)
  chain.catch = (onRejected: any) => promise.catch(onRejected)
  chain.finally = (onFinally: any) => promise.finally(onFinally)

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
