'use client'

import { Pencil, Trash2 } from 'lucide-react'
import type { ProductColor } from '@/services/product-colors'

interface Props {
  color: ProductColor
  onEdit: (color: ProductColor) => void
  onDelete: (color: ProductColor) => void
}

export default function ColorCard({ color, onEdit, onDelete }: Props) {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
      <div
        className="w-10 h-10 rounded-full border border-gray-200 shrink-0 bg-gray-100"
        style={color.hex_code ? { backgroundColor: color.hex_code } : undefined}
      >
        {color.swatch_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={color.swatch_image_url} alt={color.label} className="w-full h-full rounded-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{color.label}</p>
        {color.hex_code && <p className="text-xs text-gray-500">{color.hex_code}</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <button title="Edit color" onClick={() => onEdit(color)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
          <Pencil size={14} />
        </button>
        <button title="Delete color" onClick={() => onDelete(color)} className="p-1.5 rounded hover:bg-gray-100 text-red-500">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
