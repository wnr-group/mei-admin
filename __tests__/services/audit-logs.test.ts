import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { getAuditLogs } = await import('@/services/audit-logs')

interface MockChain extends Record<string, unknown> {
  then: (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  finally: (onFinally?: (() => void) | null) => Promise<unknown>
}

// Does NOT auto-wire mockFrom — use mockReturnValueOnce at the call site
function createChain(finalValue: unknown): MockChain {
  const chain: MockChain = {} as MockChain
  const methods = ['select', 'eq', 'gte', 'lte', 'in', 'order', 'range']
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  const promise = Promise.resolve(finalValue)
  chain.then = (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => promise.then(onFulfilled, onRejected)
  chain.catch = (onRejected?: ((reason: unknown) => unknown) | null) => promise.catch(onRejected)
  chain.finally = (onFinally?: (() => void) | null) => promise.finally(onFinally)
  return chain
}

const sampleLog = { id: '1', action: 'CREATE', resource_type: 'product', resource_id: 'p1', admin_id: 'a1', created_at: '2026-06-16T10:00:00Z', old_data: null, new_data: null, user_agent: null, session_id: null }

describe('getAuditLogs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches from audit_logs table', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: [], count: 0, error: null }))
    await getAuditLogs()
    expect(mockFrom).toHaveBeenCalledWith('audit_logs')
  })

  it('returns logs and total count', async () => {
    mockFrom
      .mockReturnValueOnce(createChain({ data: [sampleLog], count: 1, error: null }))
      .mockReturnValueOnce(createChain({ data: [{ id: 'a1', full_name: 'Alice Admin' }], error: null }))
    const result = await getAuditLogs()
    expect(result.logs).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('resolves actor name from profiles', async () => {
    mockFrom
      .mockReturnValueOnce(createChain({ data: [sampleLog], count: 1, error: null }))
      .mockReturnValueOnce(createChain({ data: [{ id: 'a1', full_name: 'Alice Admin' }], error: null }))
    const result = await getAuditLogs()
    expect(result.logs[0].actor_name).toBe('Alice Admin')
  })

  it('falls back to "Admin" when profile full_name is null', async () => {
    mockFrom
      .mockReturnValueOnce(createChain({ data: [sampleLog], count: 1, error: null }))
      .mockReturnValueOnce(createChain({ data: [{ id: 'a1', full_name: null }], error: null }))
    const result = await getAuditLogs()
    expect(result.logs[0].actor_name).toBe('Admin')
  })

  it('falls back to "System" when admin_id is null', async () => {
    const systemLog = { ...sampleLog, admin_id: null }
    mockFrom.mockReturnValueOnce(createChain({ data: [systemLog], count: 1, error: null }))
    const result = await getAuditLogs()
    expect(result.logs[0].actor_name).toBe('System')
  })

  it('applies pagination', async () => {
    const chain = createChain({ data: [], count: 0, error: null })
    mockFrom.mockReturnValueOnce(chain)
    await getAuditLogs({ page: 3, limit: 10 })
    expect(chain.range).toHaveBeenCalledWith(20, 29)
  })

  it('filters by action', async () => {
    const chain = createChain({ data: [], count: 0, error: null })
    mockFrom.mockReturnValueOnce(chain)
    await getAuditLogs({ action: 'DELETE' })
    expect(chain.eq).toHaveBeenCalledWith('action', 'DELETE')
  })

  it('filters by resourceType', async () => {
    const chain = createChain({ data: [], count: 0, error: null })
    mockFrom.mockReturnValueOnce(chain)
    await getAuditLogs({ resourceType: 'order' })
    expect(chain.eq).toHaveBeenCalledWith('resource_type', 'order')
  })

  it('filters by adminId', async () => {
    const chain = createChain({ data: [], count: 0, error: null })
    mockFrom.mockReturnValueOnce(chain)
    await getAuditLogs({ adminId: 'admin-uuid-1' })
    expect(chain.eq).toHaveBeenCalledWith('admin_id', 'admin-uuid-1')
  })

  it('normalizes dateFrom to start of day (T00:00:00.000Z)', async () => {
    const chain = createChain({ data: [], count: 0, error: null })
    mockFrom.mockReturnValueOnce(chain)
    await getAuditLogs({ dateFrom: '2026-06-01' })
    expect(chain.gte).toHaveBeenCalledWith('created_at', '2026-06-01T00:00:00.000Z')
  })

  it('normalizes dateTo to end of day (T23:59:59.999Z)', async () => {
    const chain = createChain({ data: [], count: 0, error: null })
    mockFrom.mockReturnValueOnce(chain)
    await getAuditLogs({ dateTo: '2026-06-30' })
    expect(chain.lte).toHaveBeenCalledWith('created_at', '2026-06-30T23:59:59.999Z')
  })

  it('throws on Supabase error', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: null, count: null, error: { message: 'Access denied' } }))
    await expect(getAuditLogs()).rejects.toThrow('Access denied')
  })

  it('returns empty logs when no data', async () => {
    mockFrom.mockReturnValueOnce(createChain({ data: null, count: null, error: null }))
    const result = await getAuditLogs()
    expect(result.logs).toEqual([])
    expect(result.total).toBe(0)
  })
})
