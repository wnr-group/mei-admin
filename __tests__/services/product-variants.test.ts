import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { getProductVariants, createVariant, updateVariant, deleteVariant, getEffectivePrice } = await import('@/services/product-variants')

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

describe('getProductVariants', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns variants for a product', async () => {
    createMockChainForQuery({
      data: [
        {
          id: '1',
          product_id: 'prod-1',
          customization_type: 'SEMI_STITCHED',
          sku: 'TEST-SEMI-001',
          size_label: 'Large',
          stock_quantity: 10,
          track_inventory: false,
          allow_backorder: true,
          low_stock_threshold: 5,
          is_available: true,
          sort_order: 0,
          created_at: '2026-06-12T00:00:00Z',
          updated_at: '2026-06-12T00:00:00Z'
        }
      ],
      error: null
    })
    const variants = await getProductVariants('prod-1')
    expect(variants).toHaveLength(1)
    expect(variants[0].customization_type).toBe('SEMI_STITCHED')
  })

  it('returns empty array when no variants', async () => {
    createMockChainForQuery({ data: [], error: null })
    const variants = await getProductVariants('prod-1')
    expect(variants).toEqual([])
  })

  it('filters out deleted variants', async () => {
    const chain = createMockChainForQuery({ data: [], error: null })
    await getProductVariants('prod-1')
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('orders by sort_order', async () => {
    const chain = createMockChainForQuery({ data: [], error: null })
    await getProductVariants('prod-1')
    expect(chain.order).toHaveBeenCalledWith('sort_order')
  })

  it('throws on Supabase error', async () => {
    createMockChainForQuery({ data: null, error: { message: 'DB error' } })
    await expect(getProductVariants('prod-1')).rejects.toThrow('DB error')
  })
})

describe('createVariant', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates and returns new variant', async () => {
    const newVariant = {
      id: '1',
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED',
      sku: 'TEST-SEMI-001',
      size_label: 'Large',
      stock_quantity: 0,
      track_inventory: false,
      allow_backorder: true,
      low_stock_threshold: 5,
      is_available: true,
      sort_order: 0,
      created_at: '2026-06-12T00:00:00Z',
      updated_at: '2026-06-12T00:00:00Z'
    }
    createMockChainForQuery({ data: newVariant, error: null })
    const variant = await createVariant({
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED',
      sku: 'TEST-SEMI-001',
      size_label: 'Large'
    })
    expect(variant.id).toBe('1')
    expect(variant.customization_type).toBe('SEMI_STITCHED')
    expect(mockFrom).toHaveBeenCalledWith('product_variants')
  })

  it('defaults stock_quantity to 0', async () => {
    const newVariant = {
      id: '1',
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED',
      stock_quantity: 0,
      track_inventory: false,
      allow_backorder: true,
      low_stock_threshold: 5,
      is_available: true,
      sort_order: 0,
      created_at: '2026-06-12T00:00:00Z',
      updated_at: '2026-06-12T00:00:00Z'
    }
    const chain = createMockChainForQuery({ data: newVariant, error: null })
    await createVariant({
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED'
    })
    expect(chain.insert).toHaveBeenCalled()
    const insertCall = (chain.insert as any).mock.calls[0][0]
    expect(insertCall.stock_quantity).toBe(0)
  })

  it('defaults track_inventory to false', async () => {
    const newVariant = {
      id: '1',
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED',
      stock_quantity: 0,
      track_inventory: false,
      allow_backorder: true,
      low_stock_threshold: 5,
      is_available: true,
      sort_order: 0,
      created_at: '2026-06-12T00:00:00Z',
      updated_at: '2026-06-12T00:00:00Z'
    }
    const chain = createMockChainForQuery({ data: newVariant, error: null })
    await createVariant({
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED'
    })
    const insertCall = (chain.insert as any).mock.calls[0][0]
    expect(insertCall.track_inventory).toBe(false)
  })

  it('defaults allow_backorder to true', async () => {
    const newVariant = {
      id: '1',
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED',
      stock_quantity: 0,
      track_inventory: false,
      allow_backorder: true,
      low_stock_threshold: 5,
      is_available: true,
      sort_order: 0,
      created_at: '2026-06-12T00:00:00Z',
      updated_at: '2026-06-12T00:00:00Z'
    }
    const chain = createMockChainForQuery({ data: newVariant, error: null })
    await createVariant({
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED'
    })
    const insertCall = (chain.insert as any).mock.calls[0][0]
    expect(insertCall.allow_backorder).toBe(true)
  })

  it('defaults low_stock_threshold to 5', async () => {
    const newVariant = {
      id: '1',
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED',
      stock_quantity: 0,
      track_inventory: false,
      allow_backorder: true,
      low_stock_threshold: 5,
      is_available: true,
      sort_order: 0,
      created_at: '2026-06-12T00:00:00Z',
      updated_at: '2026-06-12T00:00:00Z'
    }
    const chain = createMockChainForQuery({ data: newVariant, error: null })
    await createVariant({
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED'
    })
    const insertCall = (chain.insert as any).mock.calls[0][0]
    expect(insertCall.low_stock_threshold).toBe(5)
  })

  it('defaults is_available to true', async () => {
    const newVariant = {
      id: '1',
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED',
      stock_quantity: 0,
      track_inventory: false,
      allow_backorder: true,
      low_stock_threshold: 5,
      is_available: true,
      sort_order: 0,
      created_at: '2026-06-12T00:00:00Z',
      updated_at: '2026-06-12T00:00:00Z'
    }
    const chain = createMockChainForQuery({ data: newVariant, error: null })
    await createVariant({
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED'
    })
    const insertCall = (chain.insert as any).mock.calls[0][0]
    expect(insertCall.is_available).toBe(true)
  })

  it('defaults sort_order to 0', async () => {
    const newVariant = {
      id: '1',
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED',
      stock_quantity: 0,
      track_inventory: false,
      allow_backorder: true,
      low_stock_threshold: 5,
      is_available: true,
      sort_order: 0,
      created_at: '2026-06-12T00:00:00Z',
      updated_at: '2026-06-12T00:00:00Z'
    }
    const chain = createMockChainForQuery({ data: newVariant, error: null })
    await createVariant({
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED'
    })
    const insertCall = (chain.insert as any).mock.calls[0][0]
    expect(insertCall.sort_order).toBe(0)
  })

  it('throws on Supabase error', async () => {
    createMockChainForQuery({ data: null, error: { message: 'Insert failed' } })
    await expect(createVariant({
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED'
    })).rejects.toThrow('Insert failed')
  })
})

describe('updateVariant', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates and returns variant', async () => {
    const updated = {
      id: '1',
      product_id: 'prod-1',
      customization_type: 'SEMI_STITCHED',
      sku: 'TEST-SEMI-001',
      stock_quantity: 0,
      track_inventory: false,
      allow_backorder: true,
      low_stock_threshold: 5,
      is_available: false,
      sort_order: 0,
      created_at: '2026-06-12T00:00:00Z',
      updated_at: '2026-06-12T00:00:00Z'
    }
    const chain = createMockChainForQuery({ data: updated, error: null })
    const result = await updateVariant('1', { is_available: false })
    expect(result.is_available).toBe(false)
    expect(chain.eq).toHaveBeenCalledWith('id', '1')
  })

  it('throws on Supabase error', async () => {
    createMockChainForQuery({ data: null, error: { message: 'Update failed' } })
    await expect(updateVariant('1', { is_available: false })).rejects.toThrow('Update failed')
  })
})

describe('deleteVariant', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft deletes variant', async () => {
    const chain = createMockChainForQuery({ error: null })
    await deleteVariant('1')
    expect(chain.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) })
    expect(chain.eq).toHaveBeenCalledWith('id', '1')
  })

  it('throws on Supabase error', async () => {
    createMockChainForQuery({ error: { message: 'Delete failed' } })
    await expect(deleteVariant('1')).rejects.toThrow('Delete failed')
  })
})

describe('getEffectivePrice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns price_override when available', async () => {
    const firstCall = createMockChainForQuery({
      data: { price_override: 5000, product_id: 'prod-1' },
      error: null
    })
    const price = await getEffectivePrice('var-1')
    expect(price).toBe(5000)
  })

  it('returns product price when no override', async () => {
    // First call for variant lookup
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({
        data: { price_override: null, product_id: 'prod-1' },
        error: null
      }),
      then: (onFulfilled?: any) => Promise.resolve({ data: { price_override: null, product_id: 'prod-1' }, error: null }).then(onFulfilled),
      catch: (onRejected?: any) => Promise.resolve({ data: { price_override: null, product_id: 'prod-1' }, error: null }).catch(onRejected),
      finally: (onFinally?: any) => Promise.resolve({ data: { price_override: null, product_id: 'prod-1' }, error: null }).finally(onFinally),
    })

    // Second call for product price
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({
        data: { price: 10000 },
        error: null
      }),
      then: (onFulfilled?: any) => Promise.resolve({ data: { price: 10000 }, error: null }).then(onFulfilled),
      catch: (onRejected?: any) => Promise.resolve({ data: { price: 10000 }, error: null }).catch(onRejected),
      finally: (onFinally?: any) => Promise.resolve({ data: { price: 10000 }, error: null }).finally(onFinally),
    })

    const price = await getEffectivePrice('var-1')
    expect(price).toBe(10000)
  })

  it('throws on Supabase error', async () => {
    createMockChainForQuery({ data: null, error: { message: 'Query failed' } })
    await expect(getEffectivePrice('var-1')).rejects.toThrow('Query failed')
  })
})
