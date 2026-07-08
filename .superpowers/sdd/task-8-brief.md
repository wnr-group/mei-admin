### Task 8: Conditions panel UI components

**Files:**
- Create: `components/categories/rules/RuleFormDialog.tsx`
- Create: `components/categories/rules/DeleteRuleDialog.tsx`
- Create: `components/categories/rules/RuleList.tsx`
- Test: `__tests__/components/categories/rules/RuleFormDialog.test.tsx`
- Test: `__tests__/components/categories/rules/RuleList.test.tsx`

**Interfaces:**
- Consumes: hooks from Task 7; `OPERATORS_BY_FIELD` from `@/lib/category-rules` (Task 3); `CategoryRule`, `RuleField`, `RuleOperator` from `@/types`; `EmptyState`, `ErrorState`, `Skeleton` from `@/components/ui/*`.
- Produces: `<RuleList categoryId matchType onMatchTypeChange />` — the single component Task 9 embeds into the category edit page. `matchType: 'ALL' | 'ANY'`, `onMatchTypeChange: (mt: 'ALL' | 'ANY') => void` are controlled by the parent, matching how the rest of `CategoryForm` batches field state.

- [ ] **Step 1: Write the failing test for `RuleFormDialog`**

```tsx
// __tests__/components/categories/rules/RuleFormDialog.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/category-rules', () => ({
  createCategoryRule: vi.fn().mockResolvedValue({ id: '1', category_id: 'c1', field: 'name', operator: 'contains', value: 'lehenga' }),
  updateCategoryRule: vi.fn().mockResolvedValue({ id: '1', category_id: 'c1', field: 'name', operator: 'contains', value: 'lehenga' }),
  getCategoryRules: vi.fn().mockResolvedValue([]),
  deleteCategoryRule: vi.fn(),
}))

const { default: RuleFormDialog } = await import('@/components/categories/rules/RuleFormDialog')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('RuleFormDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <RuleFormDialog categoryId="c1" open={false} onClose={() => {}} />,
      { wrapper }
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows Field, Operator, and Value inputs when open', () => {
    render(<RuleFormDialog categoryId="c1" open={true} onClose={() => {}} />, { wrapper })
    expect(screen.getByLabelText('Field')).toBeInTheDocument()
    expect(screen.getByLabelText('Operator')).toBeInTheDocument()
    expect(screen.getByLabelText('Value')).toBeInTheDocument()
  })

  it('restricts operator options to those valid for the selected field', () => {
    render(<RuleFormDialog categoryId="c1" open={true} onClose={() => {}} />, { wrapper })
    fireEvent.change(screen.getByLabelText('Field'), { target: { value: 'price' } })
    const operatorSelect = screen.getByLabelText('Operator') as HTMLSelectElement
    const optionValues = Array.from(operatorSelect.options).map((o) => o.value)
    expect(optionValues).toEqual(['is', 'greater_than', 'less_than'])
  })

  it('calls onClose when Cancel clicked', () => {
    const onClose = vi.fn()
    render(<RuleFormDialog categoryId="c1" open={true} onClose={onClose} />, { wrapper })
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows Edit Condition title when initialRule provided', () => {
    render(
      <RuleFormDialog
        categoryId="c1"
        open={true}
        onClose={() => {}}
        initialRule={{ id: '1', category_id: 'c1', field: 'name', operator: 'contains', value: 'lehenga', created_at: '', updated_at: '' }}
      />,
      { wrapper }
    )
    expect(screen.getByText('Edit Condition')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Write the failing test for `RuleList`**

```tsx
// __tests__/components/categories/rules/RuleList.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/services/category-rules', () => ({
  getCategoryRules: vi.fn().mockResolvedValue([
    { id: '1', category_id: 'c1', field: 'name', operator: 'contains', value: 'lehenga', created_at: '', updated_at: '' },
  ]),
  createCategoryRule: vi.fn(),
  updateCategoryRule: vi.fn(),
  deleteCategoryRule: vi.fn(),
}))
vi.mock('@/services/product-categories', () => ({
  reevaluateAllProducts: vi.fn().mockResolvedValue({ evaluated: 0 }),
}))

const { default: RuleList } = await import('@/components/categories/rules/RuleList')

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children)
}

describe('RuleList', () => {
  it('renders existing rules once loaded', async () => {
    render(<RuleList categoryId="c1" matchType="ALL" onMatchTypeChange={() => {}} />, { wrapper })
    expect(await screen.findByText(/lehenga/)).toBeInTheDocument()
  })

  it('shows the Add Condition button', async () => {
    render(<RuleList categoryId="c1" matchType="ALL" onMatchTypeChange={() => {}} />, { wrapper })
    expect(await screen.findByText('Add Condition')).toBeInTheDocument()
  })

  it('shows the Re-evaluate All Products action', async () => {
    render(<RuleList categoryId="c1" matchType="ALL" onMatchTypeChange={() => {}} />, { wrapper })
    expect(await screen.findByText('Re-evaluate All Products')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run __tests__/components/categories/rules`
Expected: FAIL — `Cannot find module '@/components/categories/rules/RuleFormDialog'` (and `RuleList`)

- [ ] **Step 4: Write `components/categories/rules/RuleFormDialog.tsx`**

```tsx
'use client'

import { useState, useRef } from 'react'
import { useCreateCategoryRule, useUpdateCategoryRule } from '@/hooks/use-category-rules'
import { OPERATORS_BY_FIELD } from '@/lib/category-rules'
import type { CategoryRule, RuleField, RuleOperator } from '@/types'

interface Props {
  categoryId: string
  open: boolean
  onClose: () => void
  initialRule?: CategoryRule
}

const FIELD_LABELS: Record<RuleField, string> = { name: 'Name', work_types: 'Work Type', price: 'Price' }
const OPERATOR_LABELS: Record<RuleOperator, string> = {
  contains: 'Contains',
  is: 'Is',
  greater_than: 'Greater Than',
  less_than: 'Less Than',
}

export default function RuleFormDialog({ categoryId, open, onClose, initialRule }: Props) {
  const [field, setField] = useState<RuleField>('name')
  const [operator, setOperator] = useState<RuleOperator>('contains')
  const [value, setValue] = useState('')

  const createRule = useCreateCategoryRule(categoryId)
  const updateRule = useUpdateCategoryRule(categoryId)
  const isPending = createRule.isPending || updateRule.isPending

  const prevOpenRef = useRef(open)
  const prevRuleRef = useRef(initialRule)

  // eslint-disable-next-line react-hooks/refs
  if (prevOpenRef.current !== open || prevRuleRef.current !== initialRule) {
    // eslint-disable-next-line react-hooks/refs
    prevOpenRef.current = open
    // eslint-disable-next-line react-hooks/refs
    prevRuleRef.current = initialRule
    if (open) {
      setField(initialRule?.field ?? 'name')
      setOperator(initialRule?.operator ?? 'contains')
      setValue(initialRule?.value ?? '')
    }
  }

  if (!open) return null

  const availableOperators = OPERATORS_BY_FIELD[field]

  function handleFieldChange(next: RuleField) {
    setField(next)
    if (!OPERATORS_BY_FIELD[next].includes(operator)) {
      setOperator(OPERATORS_BY_FIELD[next][0])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    if (initialRule) {
      await updateRule.mutateAsync({ id: initialRule.id, updates: { field, operator, value: value.trim() } })
    } else {
      await createRule.mutateAsync({ category_id: categoryId, field, operator, value: value.trim() })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{initialRule ? 'Edit Condition' : 'Add Condition'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="rule-field" className="block text-sm font-medium text-gray-700 mb-1">Field</label>
            <select
              id="rule-field"
              aria-label="Field"
              value={field}
              onChange={(e) => handleFieldChange(e.target.value as RuleField)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
            >
              {(Object.keys(FIELD_LABELS) as RuleField[]).map((f) => (
                <option key={f} value={f}>{FIELD_LABELS[f]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rule-operator" className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
            <select
              id="rule-operator"
              aria-label="Operator"
              value={operator}
              onChange={(e) => setOperator(e.target.value as RuleOperator)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
            >
              {availableOperators.map((op) => (
                <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rule-value" className="block text-sm font-medium text-gray-700 mb-1">Value</label>
            <input
              id="rule-value"
              aria-label="Value"
              type={field === 'price' ? 'number' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
            />
          </div>
          {(createRule.error || updateRule.error) && (
            <p className="text-sm text-red-600">Failed to save condition. Please try again.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isPending} className="px-4 py-2 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50">
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write `components/categories/rules/DeleteRuleDialog.tsx`**

```tsx
'use client'

import { useDeleteCategoryRule } from '@/hooks/use-category-rules'
import type { CategoryRule } from '@/types'

interface Props {
  categoryId: string
  rule: CategoryRule | null
  onClose: () => void
}

export default function DeleteRuleDialog({ categoryId, rule, onClose }: Props) {
  const deleteRule = useDeleteCategoryRule(categoryId)

  if (!rule) return null

  async function handleConfirm() {
    await deleteRule.mutateAsync(rule!.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-2">Delete Condition</h2>
        <p className="text-sm text-gray-600 mb-4">
          Delete this condition? Products matched only through it will be unlinked from this category.
        </p>
        {deleteRule.error && <p className="text-sm text-red-600 mb-3">Failed to delete. Please try again.</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
          <button onClick={handleConfirm} disabled={deleteRule.isPending} className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50">
            {deleteRule.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Write `components/categories/rules/RuleList.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useCategoryRules } from '@/hooks/use-category-rules'
import { useReevaluateAllProducts } from '@/hooks/use-product-categories'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import RuleFormDialog from './RuleFormDialog'
import DeleteRuleDialog from './DeleteRuleDialog'
import type { CategoryRule, RuleField, RuleOperator, CategoryMatchType } from '@/types'

const FIELD_LABELS: Record<RuleField, string> = { name: 'Name', work_types: 'Work Type', price: 'Price' }
const OPERATOR_LABELS: Record<RuleOperator, string> = {
  contains: 'contains', is: 'is', greater_than: '>', less_than: '<',
}

interface Props {
  categoryId: string
  matchType: CategoryMatchType
  onMatchTypeChange: (matchType: CategoryMatchType) => void
}

export default function RuleList({ categoryId, matchType, onMatchTypeChange }: Props) {
  const { data: rules, isLoading, error, refetch } = useCategoryRules(categoryId)
  const reevaluate = useReevaluateAllProducts()
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CategoryRule | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<CategoryRule | null>(null)

  function openCreate() { setEditTarget(undefined); setFormOpen(true) }
  function openEdit(r: CategoryRule) { setEditTarget(r); setFormOpen(true) }
  function closeForm() { setFormOpen(false); setEditTarget(undefined) }

  async function handleReevaluate() {
    if (!confirm('Re-evaluate all products against every category’s conditions? This may take a moment.')) return
    const result = await reevaluate.mutateAsync()
    alert(`Re-evaluated ${result.evaluated} products.`)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Conditions</h3>
        <button type="button" onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f]">
          <Plus size={14} /> Add Condition
        </button>
      </div>

      {rules && rules.length > 0 && (
        <div className="flex items-center gap-4 text-[12px] text-zinc-700">
          <span className="font-medium">Match:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="match-type" checked={matchType === 'ALL'} onChange={() => onMatchTypeChange('ALL')} />
            All conditions
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="match-type" checked={matchType === 'ANY'} onChange={() => onMatchTypeChange('ANY')} />
            Any condition
          </label>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      )}
      {error && <ErrorState message="Could not load conditions." onRetry={refetch} />}
      {!isLoading && !error && rules?.length === 0 && (
        <EmptyState message="No conditions yet. Products stay manually assigned until you add one." />
      )}
      {!isLoading && !error && rules && rules.length > 0 && (
        <ul className="divide-y divide-[#E8E0D5] border border-[#E8E0D5]">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-[12px]">
              <span>
                <strong>{FIELD_LABELS[r.field]}</strong> {OPERATOR_LABELS[r.operator]} &quot;{r.value}&quot;
              </span>
              <span className="space-x-3 text-[10px] font-bold tracking-widest">
                <button type="button" onClick={() => openEdit(r)} className="text-[#B38B5D] hover:text-[#A37B4D] uppercase">EDIT</button>
                <button type="button" onClick={() => setDeleteTarget(r)} className="text-red-600 hover:text-red-700 uppercase">DELETE</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2">
        <button
          type="button"
          onClick={handleReevaluate}
          disabled={reevaluate.isPending}
          className="text-[10px] font-bold tracking-widest text-zinc-500 hover:text-zinc-800 uppercase disabled:opacity-50"
        >
          {reevaluate.isPending ? 'Re-evaluating…' : 'Re-evaluate All Products'}
        </button>
      </div>

      <RuleFormDialog categoryId={categoryId} open={formOpen} onClose={closeForm} initialRule={editTarget} />
      <DeleteRuleDialog categoryId={categoryId} rule={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </section>
  )
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run __tests__/components/categories/rules`
Expected: PASS (8 tests)

- [ ] **Step 8: Commit**

```bash
git add components/categories/rules __tests__/components/categories/rules
git commit -m "feat(category-rules): add Conditions panel UI components"
```

---

