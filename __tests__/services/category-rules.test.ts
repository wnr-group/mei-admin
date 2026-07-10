import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { getCategoryRules, createCategoryRule, updateCategoryRule, deleteCategoryRule } = await import('@/services/category-rules')

interface MockChain extends Record<string, unknown> {
  then: (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
}

function createMockChain(finalValue: unknown): MockChain {
  const chain: MockChain = {} as MockChain
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single']
  methods.forEach((m) => { chain[m] = vi.fn(() => chain) })
  const promise = Promise.resolve(finalValue)
  chain.then = (onFulfilled, onRejected) => promise.then(onFulfilled, onRejected)
  mockFrom.mockReturnValue(chain)
  return chain
}

describe('getCategoryRules', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns rules for a category ordered by created_at', async () => {
    createMockChain({ data: [{ id: 'r1', category_id: 'c1', field: 'name', operator: 'contains', value: 'lehenga' }], error: null })
    const result = await getCategoryRules('c1')
    expect(result).toHaveLength(1)
    expect(mockFrom).toHaveBeenCalledWith('category_rules')
  })

  it('returns empty array when no data', async () => {
    createMockChain({ data: null, error: null })
    const result = await getCategoryRules('c1')
    expect(result).toEqual([])
  })

  it('throws on Supabase error', async () => {
    createMockChain({ data: null, error: { message: 'DB error' } })
    await expect(getCategoryRules('c1')).rejects.toThrow('DB error')
  })
})

describe('createCategoryRule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates and returns a rule', async () => {
    const inserted = { id: 'r1', category_id: 'c1', field: 'price', operator: 'greater_than', value: '1000' }
    createMockChain({ data: inserted, error: null })
    const result = await createCategoryRule({ category_id: 'c1', field: 'price', operator: 'greater_than', value: '1000' })
    expect(result).toEqual(inserted)
    expect(mockFrom).toHaveBeenCalledWith('category_rules')
  })

  it('throws on Supabase error', async () => {
    createMockChain({ data: null, error: { message: 'Insert failed' } })
    await expect(createCategoryRule({ category_id: 'c1', field: 'price', operator: 'is', value: '1' })).rejects.toThrow('Insert failed')
  })

  it('rejects an operator that is invalid for the field before calling Supabase', async () => {
    createMockChain({ data: null, error: null })
    await expect(
      createCategoryRule({ category_id: 'c1', field: 'name', operator: 'greater_than', value: 'x' })
    ).rejects.toThrow('greater_than')
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('updateCategoryRule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates and returns the rule', async () => {
    const updated = { id: 'r1', category_id: 'c1', field: 'name', operator: 'is', value: 'saree' }
    const chain = createMockChain({ data: updated, error: null })
    const result = await updateCategoryRule('r1', { field: 'name', operator: 'is', value: 'saree' })
    expect(result).toEqual(updated)
    expect(chain.eq).toHaveBeenCalledWith('id', 'r1')
  })

  it('throws on Supabase error', async () => {
    createMockChain({ data: null, error: { message: 'Update failed' } })
    await expect(updateCategoryRule('r1', { value: 'x' })).rejects.toThrow('Update failed')
  })

  it('rejects an operator that is invalid for the field before calling Supabase', async () => {
    createMockChain({ data: null, error: null })
    await expect(
      updateCategoryRule('r1', { field: 'work_types', operator: 'less_than', value: 'x' })
    ).rejects.toThrow('less_than')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('allows a partial update that only changes value, without needing field/operator', async () => {
    const updated = { id: 'r1', category_id: 'c1', field: 'name', operator: 'contains', value: 'saree' }
    createMockChain({ data: updated, error: null })
    const result = await updateCategoryRule('r1', { value: 'saree' })
    expect(result).toEqual(updated)
  })
})

describe('deleteCategoryRule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes the rule', async () => {
    const chain = createMockChain({ error: null })
    await deleteCategoryRule('r1')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'r1')
  })

  it('throws on Supabase error', async () => {
    createMockChain({ error: { message: 'Delete failed' } })
    await expect(deleteCategoryRule('r1')).rejects.toThrow('Delete failed')
  })
})
