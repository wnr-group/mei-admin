'use client'

import { useDeleteColor } from '@/hooks/use-product-colors'
import type { ProductColor } from '@/services/product-colors'

interface Props {
  productId: string
  color: ProductColor | null
  onClose: () => void
}

export default function DeleteColorDialog({ productId, color, onClose }: Props) {
  const deleteColor = useDeleteColor(productId)

  if (!color) return null

  async function handleConfirm() {
    await deleteColor.mutateAsync(color!.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-2">Delete Color</h2>
        <p className="text-sm text-gray-600 mb-4">
          Delete <strong>{color.label}</strong>? This will also remove associated variants and media.
        </p>
        {deleteColor.error && <p className="text-sm text-red-600 mb-3">Failed to delete. Please try again.</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
          <button onClick={handleConfirm} disabled={deleteColor.isPending} className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50">
            {deleteColor.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
