import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'test-admin-id' } } })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom, auth: { getUser: mockGetUser } }),
}))

const { getEnquiries, replyToEnquiry, closeEnquiry, deleteEnquiry } = await import('@/services/enquiries')

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

describe('getEnquiries', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters out soft-deleted enquiries', async () => {
    const chain = createMockChain({ data: [], count: 0, error: null })
    await getEnquiries()
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('returns enquiries and total count', async () => {
    createMockChain({ data: [{ id: '1', name: 'Alice', email: 'a@b.com', message: 'Hi' }], count: 1, error: null })
    const result = await getEnquiries()
    expect(result.enquiries).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('filters by status', async () => {
    const chain = createMockChain({ data: [], count: 0, error: null })
    await getEnquiries({ status: 'NEW' })
    expect(chain.eq).toHaveBeenCalledWith('status', 'NEW')
  })

  it('applies pagination', async () => {
    const chain = createMockChain({ data: [], count: 0, error: null })
    await getEnquiries({ page: 3, limit: 5 })
    expect(chain.range).toHaveBeenCalledWith(10, 14)
  })

  it('throws on Supabase error', async () => {
    createMockChain({ data: null, count: null, error: { message: 'DB error' } })
    await expect(getEnquiries()).rejects.toThrow('DB error')
  })
})

describe('replyToEnquiry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies deleted_at IS NULL guard to prevent replying to soft-deleted enquiries', async () => {
    const chain = createMockChain({ data: { id: '1', status: 'REPLIED' }, error: null })
    await replyToEnquiry('1', 'Hello')
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('throws when enquiry is soft-deleted or not found', async () => {
    createMockChain({ data: null, error: { message: 'Row not found' } })
    await expect(replyToEnquiry('deleted-id', 'Hello')).rejects.toThrow('Row not found')
  })
})

describe('closeEnquiry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies deleted_at IS NULL guard to prevent closing soft-deleted enquiries', async () => {
    const chain = createMockChain({ data: { id: '1', status: 'CLOSED' }, error: null })
    await closeEnquiry('1')
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('throws when enquiry is soft-deleted or not found', async () => {
    createMockChain({ data: null, error: { message: 'Row not found' } })
    await expect(closeEnquiry('deleted-id')).rejects.toThrow('Row not found')
  })
})

describe('deleteEnquiry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft deletes enquiry by setting deleted_at', async () => {
    const chain = createMockChain({ error: null })
    await deleteEnquiry('enquiry-1')
    expect(chain.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) })
    expect(chain.eq).toHaveBeenCalledWith('id', 'enquiry-1')
  })

  it('throws on Supabase error', async () => {
    createMockChain({ error: { message: 'Delete failed' } })
    await expect(deleteEnquiry('enquiry-1')).rejects.toThrow('Delete failed')
  })

  it('does not access audit_logs when DB update fails', async () => {
    createMockChain({ error: { message: 'Delete failed' } })
    await expect(deleteEnquiry('enquiry-1')).rejects.toThrow('Delete failed')
    expect(mockFrom).not.toHaveBeenCalledWith('audit_logs')
  })
})
