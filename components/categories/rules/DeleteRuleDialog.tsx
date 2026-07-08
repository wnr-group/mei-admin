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
          Delete this condition? Run &ldquo;Re-evaluate All Products&rdquo; afterwards to remove product memberships that were matched only by this condition.
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
