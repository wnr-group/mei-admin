'use client'

import { useState, useRef } from 'react'
import { useCreateColor, useUpdateColor } from '@/hooks/use-product-colors'
import type { ProductColor } from '@/services/product-colors'

interface Props {
  productId: string
  open: boolean
  onClose: () => void
  initialColor?: ProductColor
}

export default function ColorFormDialog({ productId, open, onClose, initialColor }: Props) {
  const [label, setLabel] = useState('')
  const [hexCode, setHexCode] = useState('')
  const [swatchUrl, setSwatchUrl] = useState('')

  const createColor = useCreateColor(productId)
  const updateColor = useUpdateColor(productId)
  const isPending = createColor.isPending || updateColor.isPending

  const prevOpenRef = useRef(open)
  const prevColorRef = useRef(initialColor)

  // Derived state during render: detect prop changes and call setState synchronously
  // React batches these state updates into a single re-render
  // eslint-disable-next-line react-hooks/refs
  if (prevOpenRef.current !== open || prevColorRef.current !== initialColor) {
    // eslint-disable-next-line react-hooks/refs
    prevOpenRef.current = open
    // eslint-disable-next-line react-hooks/refs
    prevColorRef.current = initialColor
    if (open) {
      setLabel(initialColor?.label ?? '')
      setHexCode(initialColor?.hex_code ?? '')
      setSwatchUrl(initialColor?.swatch_image_url ?? '')
      createColor.reset()
      updateColor.reset()
    }
  }

  if (!open) return null

  async function handleSave() {
    if (!label.trim()) return
    if (initialColor) {
      await updateColor.mutateAsync({ id: initialColor.id, input: { label, hex_code: hexCode || undefined, swatch_image_url: swatchUrl || undefined } })
    } else {
      await createColor.mutateAsync({ product_id: productId, label, hex_code: hexCode || undefined, swatch_image_url: swatchUrl || undefined })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{initialColor ? 'Edit Color' : 'Add Color'}</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="color-label" className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <input
              id="color-label"
              aria-label="Label"
              value={label}
              onChange={e => setLabel(e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
            />
          </div>
          <div>
            <label htmlFor="color-hex" className="block text-sm font-medium text-gray-700 mb-1">Hex Code</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={hexCode || '#c9a465'}
                onChange={e => setHexCode(e.target.value)}
                className="w-9 h-9 rounded border border-gray-300 cursor-pointer shrink-0 p-0.5 bg-white"
              />
              <input
                id="color-hex"
                aria-label="Hex Code"
                value={hexCode}
                onChange={e => setHexCode(e.target.value)}
                placeholder="#c9a465"
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
              />
            </div>
          </div>
          <div>
            <label htmlFor="color-swatch" className="block text-sm font-medium text-gray-700 mb-1">Swatch Image URL</label>
            <input
              id="color-swatch"
              aria-label="Swatch Image URL"
              value={swatchUrl}
              onChange={e => setSwatchUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
            />
          </div>
          {(createColor.error || updateColor.error) && (
            <p className="text-sm text-red-600">Failed to save color. Please try again.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={handleSave} disabled={isPending} className="px-4 py-2 bg-[#c9a465] text-white text-sm rounded hover:bg-[#b8934f] disabled:opacity-50">
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
