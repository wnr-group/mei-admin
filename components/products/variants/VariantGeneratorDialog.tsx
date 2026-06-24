'use client'

import { useState } from 'react'
import { useProductColors } from '@/hooks/use-product-colors'
import { useBulkCreateVariants, type BulkVariantSpec } from '@/hooks/use-bulk-create-variants'
import type { CustomizationType } from '@/services/product-variants'

const CUSTOMIZATION_TYPES: CustomizationType[] = ['UNSTITCHED', 'SEMI_STITCHED', 'STANDARD_SIZE', 'CUSTOM_TAILORED']
const TYPE_LABELS: Record<CustomizationType, string> = {
  UNSTITCHED: 'Unstitched', SEMI_STITCHED: 'Semi Stitched', STANDARD_SIZE: 'Standard Size', CUSTOM_TAILORED: 'Custom Tailored',
}

interface Props {
  productId: string
  open: boolean
  onClose: () => void
}

export default function VariantGeneratorDialog({ productId, open, onClose }: Props) {
  const { data: colors } = useProductColors(productId)
  const bulk = useBulkCreateVariants(productId)
  const [colorId, setColorId] = useState('')
  const [custType, setCustType] = useState<CustomizationType>('STANDARD_SIZE')
  const [sizesRaw, setSizesRaw] = useState('34, 36, 38, 40, 42')

  if (!open) return null

  function buildSpecs(): BulkVariantSpec[] {
    const sizes = sizesRaw.split(',').map(s => s.trim()).filter(Boolean)
    return sizes.map(size => ({
      color_id: colorId || undefined,
      size_label: size,
      customization_type: custType,
    }))
  }

  async function handleGenerate() {
    const specs = buildSpecs()
    if (!specs.length) return
    await bulk.mutateAsync(specs)
    onClose()
  }

  const specs = buildSpecs()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Bulk Generate Variants</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color (optional)</label>
            <select value={colorId} onChange={e => setColorId(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]">
              <option value="">No color</option>
              {colors?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customization Type</label>
            <select value={custType} onChange={e => setCustType(e.target.value as CustomizationType)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]">
              {CUSTOMIZATION_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sizes (comma-separated)</label>
            <input value={sizesRaw} onChange={e => setSizesRaw(e.target.value)} placeholder="34, 36, 38, 40" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]" />
          </div>
          {specs.length > 0 && (
            <p className="text-xs text-gray-500">Will create {specs.length} variant{specs.length !== 1 ? 's' : ''}: {specs.map(s => s.size_label).join(', ')}</p>
          )}
          {bulk.error && <p className="text-sm text-red-600">Failed to generate variants.</p>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
          <button onClick={handleGenerate} disabled={bulk.isPending || !specs.length} className="px-4 py-2 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50">
            {bulk.isPending ? 'Generating…' : `Generate ${specs.length} Variant${specs.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
