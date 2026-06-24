'use client'

import { useState } from 'react'
import { useUpdateVariant } from '@/hooks/use-product-variants'
import type { ProductVariant } from '@/services/product-variants'

interface Props {
  productId: string
  variant: ProductVariant
}

export default function VariantInventoryPanel({ productId, variant }: Props) {
  const update = useUpdateVariant(productId)
  const [qty, setQty] = useState(variant.stock_quantity.toString())

  async function saveQty() {
    const q = parseInt(qty, 10)
    if (isNaN(q) || q === variant.stock_quantity) return
    await update.mutateAsync({ id: variant.id, input: { stock_quantity: q } })
  }

  async function toggleTrack() {
    await update.mutateAsync({ id: variant.id, input: { track_inventory: !variant.track_inventory } })
  }

  async function toggleAvailable() {
    await update.mutateAsync({ id: variant.id, input: { is_available: !variant.is_available } })
  }

  async function toggleBackorder() {
    await update.mutateAsync({ id: variant.id, input: { allow_backorder: !variant.allow_backorder } })
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <label className="text-gray-600 w-28 shrink-0">Stock qty</label>
        <input
          type="number"
          min="0"
          value={qty}
          onChange={e => setQty(e.target.value)}
          onBlur={saveQty}
          disabled={!variant.track_inventory}
          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465] disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={variant.track_inventory} onChange={toggleTrack} className="accent-[#c9a465]" />
        <span className="text-gray-600">Track inventory</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={variant.allow_backorder} onChange={toggleBackorder} className="accent-[#c9a465]" />
        <span className="text-gray-600">Allow backorder</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={variant.is_available} onChange={toggleAvailable} className="accent-[#c9a465]" />
        <span className="text-gray-600">Available</span>
      </label>
      {update.isPending && <p className="text-xs text-gray-400">Saving…</p>}
    </div>
  )
}
