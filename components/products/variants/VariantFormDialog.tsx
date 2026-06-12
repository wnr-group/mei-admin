'use client'

import { useState, useEffect } from 'react'
import { useCreateVariant, useUpdateVariant } from '@/hooks/use-product-variants'
import { useProductColors } from '@/hooks/use-product-colors'
import type { ProductVariant, ProductVariantInsert, CustomizationType } from '@/services/product-variants'

const CUSTOMIZATION_TYPES: CustomizationType[] = ['UNSTITCHED', 'SEMI_STITCHED', 'STANDARD_SIZE', 'CUSTOM_TAILORED']
const TYPE_LABELS: Record<CustomizationType, string> = {
  UNSTITCHED: 'Unstitched',
  SEMI_STITCHED: 'Semi Stitched',
  STANDARD_SIZE: 'Standard Size',
  CUSTOM_TAILORED: 'Custom Tailored',
}

interface Props {
  productId: string
  open: boolean
  onClose: () => void
  initialVariant?: ProductVariant
}

export default function VariantFormDialog({ productId, open, onClose, initialVariant }: Props) {
  const { data: colors } = useProductColors(productId)
  const createVariant = useCreateVariant(productId)
  const updateVariant = useUpdateVariant(productId)

  const [colorId, setColorId] = useState('')
  const [sizeLabel, setSizeLabel] = useState('')
  const [custType, setCustType] = useState<CustomizationType>('STANDARD_SIZE')
  const [priceOverride, setPriceOverride] = useState('')
  const [stockQty, setStockQty] = useState('0')
  const [trackInventory, setTrackInventory] = useState(false)
  const [isAvailable, setIsAvailable] = useState(true)

  useEffect(() => {
    if (open && initialVariant) {
      setColorId(initialVariant.color_id ?? '')
      setSizeLabel(initialVariant.size_label ?? '')
      setCustType(initialVariant.customization_type)
      setPriceOverride(initialVariant.price_override?.toString() ?? '')
      setStockQty(initialVariant.stock_quantity.toString())
      setTrackInventory(initialVariant.track_inventory)
      setIsAvailable(initialVariant.is_available)
    } else if (open) {
      setColorId(''); setSizeLabel(''); setCustType('STANDARD_SIZE')
      setPriceOverride(''); setStockQty('0'); setTrackInventory(false); setIsAvailable(true)
    }
  }, [open, initialVariant])

  if (!open) return null

  const isPending = createVariant.isPending || updateVariant.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input: ProductVariantInsert = {
      product_id: productId,
      color_id: colorId || undefined,
      size_label: sizeLabel || undefined,
      customization_type: custType,
      price_override: priceOverride ? parseFloat(priceOverride) : undefined,
      stock_quantity: parseInt(stockQty, 10),
      track_inventory: trackInventory,
      is_available: isAvailable,
    }
    if (initialVariant) {
      await updateVariant.mutateAsync({ id: initialVariant.id, input })
    } else {
      await createVariant.mutateAsync(input)
    }
    onClose()
  }

  const inputCls = "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a465]"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{initialVariant ? 'Edit Variant' : 'Add Variant'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="v-color" className={labelCls}>Color</label>
            <select id="v-color" value={colorId} onChange={e => setColorId(e.target.value)} className={inputCls}>
              <option value="">No color</option>
              {colors?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="v-size" className={labelCls}>Size Label</label>
            <input id="v-size" aria-label="Size Label" value={sizeLabel} onChange={e => setSizeLabel(e.target.value)} placeholder="e.g. 38, Free Size" className={inputCls} />
          </div>
          <div>
            <label htmlFor="v-type" className={labelCls}>Customization Type</label>
            <select id="v-type" aria-label="Customization Type" value={custType} onChange={e => setCustType(e.target.value as CustomizationType)} className={inputCls}>
              {CUSTOMIZATION_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="v-price" className={labelCls}>Price Override (₹)</label>
            <input id="v-price" type="number" min="0" step="0.01" value={priceOverride} onChange={e => setPriceOverride(e.target.value)} placeholder="Leave blank to use product price" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="v-stock" className={labelCls}>Stock Quantity</label>
              <input id="v-stock" type="number" min="0" value={stockQty} onChange={e => setStockQty(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-2 pt-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={trackInventory} onChange={e => setTrackInventory(e.target.checked)} className="accent-[#c9a465]" />
                Track inventory
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={isAvailable} onChange={e => setIsAvailable(e.target.checked)} className="accent-[#c9a465]" />
                Available
              </label>
            </div>
          </div>
          {(createVariant.error || updateVariant.error) && (
            <p className="text-sm text-red-600">Failed to save variant.</p>
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
