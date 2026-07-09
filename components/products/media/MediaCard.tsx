'use client'

import { Trash2, Star, ChevronUp, ChevronDown } from 'lucide-react'
import type { ProductMedia } from '@/lib/services/product-media'

interface Props {
  media: ProductMedia
  onDelete: (id: string) => void
  onSetPrimary: (id: string) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  isFirst: boolean
  isLast: boolean
}

export default function MediaCard({ media, onDelete, onSetPrimary, onMoveUp, onMoveDown, isFirst, isLast }: Props) {
  return (
    <div className={`relative group border-2 ${media.is_primary ? 'border-[#c9a465]' : 'border-gray-200'}`}>
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media.url} alt={media.alt_text ?? ''} className="w-full h-full object-cover" />
      </div>
      {media.is_primary && (
        <div className="absolute top-1 left-1 bg-[#c9a465] text-white text-xs px-1.5 py-0.5 font-medium z-10">Primary</div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors">
        <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isFirst && <button onClick={onMoveUp} className="p-1 bg-white rounded shadow text-gray-700 hover:bg-gray-100"><ChevronUp size={12} /></button>}
          {!isLast && <button onClick={onMoveDown} className="p-1 bg-white rounded shadow text-gray-700 hover:bg-gray-100"><ChevronDown size={12} /></button>}
          {!media.is_primary && <button onClick={() => onSetPrimary(media.id)} title="Set as primary" className="p-1 bg-white rounded shadow text-yellow-600 hover:bg-yellow-50"><Star size={12} /></button>}
          <button onClick={() => onDelete(media.id)} title="Delete media" className="p-1 bg-white rounded shadow text-red-600 hover:bg-red-50"><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  )
}
