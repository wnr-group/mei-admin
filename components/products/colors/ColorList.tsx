'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useProductColors } from '@/hooks/use-product-colors'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import ColorCard from './ColorCard'
import ColorFormDialog from './ColorFormDialog'
import DeleteColorDialog from './DeleteColorDialog'
import type { ProductColor } from '@/services/product-colors'

export default function ColorList({ productId }: { productId: string }) {
  const { data: colors, isLoading, error, refetch } = useProductColors(productId)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ProductColor | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<ProductColor | null>(null)

  function openCreate() { setEditTarget(undefined); setFormOpen(true) }
  function openEdit(c: ProductColor) { setEditTarget(c); setFormOpen(true) }
  function closeForm() { setFormOpen(false); setEditTarget(undefined) }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Colors</h3>
        <button type="button" onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f]">
          <Plus size={14} /> Add Color
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}
      {error && <ErrorState message="Could not load colors." onRetry={refetch} />}
      {!isLoading && !error && colors?.length === 0 && (
        <EmptyState message="No colors yet. Add a color to start managing variants." />
      )}
      {!isLoading && !error && colors && colors.length > 0 && (
        <div className="space-y-2">
          {colors.map(c => (
            <ColorCard key={c.id} color={c} onEdit={openEdit} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      <ColorFormDialog productId={productId} open={formOpen} onClose={closeForm} initialColor={editTarget} />
      <DeleteColorDialog productId={productId} color={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </section>
  )
}
