### Task 4: Category rules CRUD service

**Files:**
- Create: `services/category-rules.ts`
- Test: `__tests__/services/category-rules.test.ts`

**Interfaces:**
- Consumes: `CategoryRule`, `CategoryRuleInsert`, `CategoryRuleUpdate` from `@/types` (Task 2); `createClient` from `@/lib/supabase/client`; `toAppError`, `AppError` from `@/lib/errors`; `OPERATORS_BY_FIELD` from `@/lib/category-rules` (Task 3).
- Produces: `getCategoryRules(categoryId: string): Promise<CategoryRule[]>`, `createCategoryRule(rule: CategoryRuleInsert): Promise<CategoryRule>`, `updateCategoryRule(id: string, updates: CategoryRuleUpdate): Promise<CategoryRule>`, `deleteCategoryRule(id: string): Promise<void>`. Relied on by Task 7 hooks. `createCategoryRule`/`updateCategoryRule` validate the operator is legal for the field *before* hitting the database, throwing a clean `AppError('VALIDATION_ERROR', ...)` instead of surfacing the raw Postgres `category_rules_valid_operator_for_field` CHECK violation from Task 1 — that DB constraint is the backstop, this is the friendly first line of defense.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/services/category-rules.test.ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run __tests__/services/category-rules.test.ts`
Expected: FAIL — `Cannot find module '@/services/category-rules'`

- [ ] **Step 3: Write the implementation**

```ts
// services/category-rules.ts
import { createClient } from '@/lib/supabase/client'
import { toAppError, AppError } from '@/lib/errors'
import { OPERATORS_BY_FIELD } from '@/lib/category-rules'
import type { CategoryRule, CategoryRuleInsert, CategoryRuleUpdate } from '@/types'

// Only validates when both field and operator are present together (always true for
// createCategoryRule; for updateCategoryRule a value-only partial update skips this
// and relies on the category_rules_valid_operator_for_field DB CHECK from Task 1).
function assertValidOperatorForField(field?: CategoryRuleInsert['field'], operator?: CategoryRuleInsert['operator']) {
  if (!field || !operator) return
  if (!OPERATORS_BY_FIELD[field].includes(operator)) {
    throw new AppError('VALIDATION_ERROR', `Operator "${operator}" is not valid for field "${field}"`)
  }
}

export async function getCategoryRules(categoryId: string): Promise<CategoryRule[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('category_rules')
    .select('*')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: true })

  if (error) throw toAppError(new Error(error.message))
  return (data as CategoryRule[] | null) ?? []
}

export async function createCategoryRule(rule: CategoryRuleInsert): Promise<CategoryRule> {
  assertValidOperatorForField(rule.field, rule.operator)
  const supabase = createClient()
  const response = await supabase.from('category_rules').insert([rule] as never).select().single()
  const { data, error } = response as { data: CategoryRule | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))
  if (!data) throw new AppError('NOT_FOUND', 'Category rule not returned after insert')
  return data
}

export async function updateCategoryRule(id: string, updates: CategoryRuleUpdate): Promise<CategoryRule> {
  assertValidOperatorForField(updates.field, updates.operator)
  const supabase = createClient()
  const response = await supabase.from('category_rules').update(updates as never).eq('id', id).select().single()
  const { data, error } = response as { data: CategoryRule | null; error: { message: string } | null }
  if (error) throw toAppError(new Error(error.message))
  if (!data) throw new AppError('NOT_FOUND', 'Category rule not returned after update')
  return data
}

export async function deleteCategoryRule(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('category_rules').delete().eq('id', id)
  if (error) throw toAppError(new Error(error.message))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run __tests__/services/category-rules.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add services/category-rules.ts __tests__/services/category-rules.test.ts
git commit -m "feat(category-rules): add CRUD service for category rules"
```

---

