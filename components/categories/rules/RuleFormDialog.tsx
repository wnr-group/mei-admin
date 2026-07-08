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
