'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { useProductVariants, useDeleteVariant } from '@/hooks/use-product-variants'
import { useProductColors } from '@/hooks/use-product-colors'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import VariantFormDialog from './VariantFormDialog'
import VariantGeneratorDialog from './VariantGeneratorDialog'
import VariantInventoryPanel from './VariantInventoryPanel'
import type { ProductVariant } from '@/services/product-variants'

export default function VariantTable({ productId }: { productId: string }) {
  const { data: variants, isLoading, error, refetch } = useProductVariants(productId)
  const { data: colors } = useProductColors(productId)
  const deleteVariant = useDeleteVariant(productId)

  const [formOpen, setFormOpen] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ProductVariant | undefined>()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const colorMap = Object.fromEntries((colors ?? []).map(c => [c.id, c.label]))

  function openEdit(v: ProductVariant) { setEditTarget(v); setFormOpen(true) }
  function closeForm() { setFormOpen(false); setEditTarget(undefined) }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Variants</h3>
        <div className="flex gap-2">
          <button onClick={() => setGenOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#c9a465] text-[#c9a465] text-sm rounded hover:bg-[#faf8f5]">
            <Zap size={14} /> Bulk Generate
          </button>
          <button onClick={() => { setEditTarget(undefined); setFormOpen(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f]">
            <Plus size={14} /> Add Variant
          </button>
        </div>
      </div>

      {isLoading && <TableSkeleton rows={4} />}
      {error && <ErrorState message="Could not load variants." onRetry={refetch} />}
      {!isLoading && !error && variants?.length === 0 && (
        <EmptyState message="No variants yet. Add a variant or use Bulk Generate." />
      )}
      {!isLoading && !error && variants && variants.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Color</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Size</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">SKU</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Price Override</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Stock</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Available</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {variants.map(v => (
                <>
                  <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">{v.color_id ? (colorMap[v.color_id] ?? '—') : '—'}</td>
                    <td className="px-3 py-2">{v.size_label ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{v.customization_type}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{v.sku ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{v.price_override != null ? `₹${v.price_override.toLocaleString()}` : '—'}</td>
                    <td className="px-3 py-2 text-center">{v.track_inventory ? v.stock_quantity : '∞'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${v.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {v.is_available ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setExpandedId(expandedId === v.id ? null : v.id)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Inventory controls">
                          {expandedId === v.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button onClick={() => openEdit(v)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Edit variant"><Pencil size={14} /></button>
                        <button onClick={() => deleteVariant.mutate(v.id)} className="p-1.5 rounded hover:bg-gray-100 text-red-500" title="Delete variant"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === v.id && (
                    <tr key={`${v.id}-inv`} className="bg-gray-50 border-b border-gray-100">
                      <td colSpan={8} className="px-6 py-3">
                        <VariantInventoryPanel productId={productId} variant={v} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VariantFormDialog productId={productId} open={formOpen} onClose={closeForm} initialVariant={editTarget} />
      <VariantGeneratorDialog productId={productId} open={genOpen} onClose={() => setGenOpen(false)} />
    </section>
  )
}
