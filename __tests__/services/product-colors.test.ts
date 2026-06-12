import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { getProductColors, createColor, updateColor, deleteColor } = await import('@/services/product-colors')

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

describe('getProductColors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns colors for a product', async () => {
    createMockChainForQuery({
      data: [
        { id: '1', product_id: 'prod-1', label: 'Red', hex_code: '#FF0000', sort_order: 0, created_at: '2026-06-12T00:00:00Z' }
      ],
      error: null
    })
    const colors = await getProductColors('prod-1')
    expect(colors).toHaveLength(1)
    expect(colors[0].label).toBe('Red')
  })

  it('returns empty array when no colors', async () => {
    createMockChainForQuery({ data: [], error: null })
    const colors = await getProductColors('prod-1')
    expect(colors).toEqual([])
  })

  it('filters out deleted colors', async () => {
    const chain = createMockChainForQuery({ data: [], error: null })
    await getProductColors('prod-1')
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('orders by sort_order', async () => {
    const chain = createMockChainForQuery({ data: [], error: null })
    await getProductColors('prod-1')
    expect(chain.order).toHaveBeenCalledWith('sort_order')
  })

  it('throws on Supabase error', async () => {
    createMockChainForQuery({ data: null, error: { message: 'DB error' } })
    await expect(getProductColors('prod-1')).rejects.toThrow('DB error')
  })
})

describe('createColor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates and returns new color', async () => {
    const newColor = {
      id: '1',
      product_id: 'prod-1',
      label: 'Test Color',
      hex_code: '#FF0000',
      sort_order: 0,
      created_at: '2026-06-12T00:00:00Z'
    }
    createMockChainForQuery({ data: newColor, error: null })
    const color = await createColor({
      product_id: 'prod-1',
      label: 'Test Color',
      hex_code: '#FF0000',
      sort_order: 0
    })
    expect(color.id).toBe('1')
    expect(color.label).toBe('Test Color')
    expect(mockFrom).toHaveBeenCalledWith('product_colors')
  })

  it('defaults sort_order to 0', async () => {
    const newColor = {
      id: '1',
      product_id: 'prod-1',
      label: 'Test Color',
      sort_order: 0,
      created_at: '2026-06-12T00:00:00Z'
    }
    const chain = createMockChainForQuery({ data: newColor, error: null })
    await createColor({
      product_id: 'prod-1',
      label: 'Test Color'
    })
    expect(chain.insert).toHaveBeenCalled()
    const insertCall = (chain.insert as any).mock.calls[0][0]
    expect(insertCall.sort_order).toBe(0)
  })

  it('throws on Supabase error', async () => {
    createMockChainForQuery({ data: null, error: { message: 'Insert failed' } })
    await expect(createColor({
      product_id: 'prod-1',
      label: 'Bad'
    })).rejects.toThrow('Insert failed')
  })
})

describe('updateColor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates and returns color', async () => {
    const updated = {
      id: '1',
      product_id: 'prod-1',
      label: 'Updated Color',
      hex_code: '#00FF00',
      sort_order: 0,
      created_at: '2026-06-12T00:00:00Z'
    }
    const chain = createMockChainForQuery({ data: updated, error: null })
    const result = await updateColor('1', { label: 'Updated Color', hex_code: '#00FF00' })
    expect(result.label).toBe('Updated Color')
    expect(chain.eq).toHaveBeenCalledWith('id', '1')
  })

  it('throws on Supabase error', async () => {
    createMockChainForQuery({ data: null, error: { message: 'Update failed' } })
    await expect(updateColor('1', { label: 'Bad' })).rejects.toThrow('Update failed')
  })
})

describe('deleteColor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft deletes color', async () => {
    const chain = createMockChainForQuery({ error: null })
    await deleteColor('1')
    expect(chain.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) })
    expect(chain.eq).toHaveBeenCalledWith('id', '1')
  })

  it('throws on Supabase error', async () => {
    createMockChainForQuery({ error: { message: 'Delete failed' } })
    await expect(deleteColor('1')).rejects.toThrow('Delete failed')
  })
})
