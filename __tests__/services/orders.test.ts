import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { getOrders, updateOrderStatus, deleteOrder } = await import('@/services/orders')

interface MockChain extends Record<string, unknown> {
  then: (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  finally: (onFinally?: (() => void) | null) => Promise<unknown>
}

function createMockChain(finalValue: unknown): MockChain {
  const chain: MockChain = {} as MockChain
  const methods = ['select', 'insert', 'update', 'is', 'eq', 'order', 'range', 'single']
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  const promise = Promise.resolve(finalValue)
  chain.then = (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => promise.then(onFulfilled, onRejected)
  chain.catch = (onRejected?: ((reason: unknown) => unknown) | null) => promise.catch(onRejected)
  chain.finally = (onFinally?: (() => void) | null) => promise.finally(onFinally)
  mockFrom.mockReturnValue(chain)
  return chain
}

describe('getOrders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters out soft-deleted orders', async () => {
    const chain = createMockChain({ data: [], count: 0, error: null })
    await getOrders()
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('returns orders and total count', async () => {
    createMockChain({ data: [{ id: '1', order_number: '#ORD-9000', total: 5000 }], count: 1, error: null })
    const result = await getOrders()
    expect(result.orders).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('filters by status', async () => {
    const chain = createMockChain({ data: [], count: 0, error: null })
    await getOrders({ status: 'PENDING' })
    expect(chain.eq).toHaveBeenCalledWith('status', 'PENDING')
  })

  it('applies pagination', async () => {
    const chain = createMockChain({ data: [], count: 0, error: null })
    await getOrders({ page: 2, limit: 10 })
    expect(chain.range).toHaveBeenCalledWith(10, 19)
  })

  it('throws on Supabase error', async () => {
    createMockChain({ data: null, count: null, error: { message: 'DB error' } })
    await expect(getOrders()).rejects.toThrow('DB error')
  })
})

describe('updateOrderStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies deleted_at IS NULL guard to prevent updating soft-deleted orders', async () => {
    const chain = createMockChain({ data: { id: '1', status: 'CONFIRMED' }, error: null })
    await updateOrderStatus('1', 'CONFIRMED')
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('throws when order is soft-deleted or not found', async () => {
    createMockChain({ data: null, error: { message: 'Row not found' } })
    await expect(updateOrderStatus('deleted-id', 'CONFIRMED')).rejects.toThrow('Row not found')
  })
})

describe('deleteOrder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft deletes order by setting deleted_at', async () => {
    const chain = createMockChain({ error: null })
    await deleteOrder('order-1')
    expect(chain.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) })
    expect(chain.eq).toHaveBeenCalledWith('id', 'order-1')
  })

  it('throws on Supabase error', async () => {
    createMockChain({ error: { message: 'Delete failed' } })
    await expect(deleteOrder('order-1')).rejects.toThrow('Delete failed')
  })

  it('does not access audit_logs when DB update fails', async () => {
    createMockChain({ error: { message: 'Delete failed' } })
    await expect(deleteOrder('order-1')).rejects.toThrow('Delete failed')
    expect(mockFrom).not.toHaveBeenCalledWith('audit_logs')
  })
})
