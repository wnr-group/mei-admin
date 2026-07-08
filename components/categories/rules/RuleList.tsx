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
